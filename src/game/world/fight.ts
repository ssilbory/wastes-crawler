// Overland encounters fought with the combat engine. Fights carry the party's wounds, Frailty,
// strain, and the day's spent spells and Effort in and out (SRD 2.5.1, 4.2.0); a lost fight sends
// the party back to the last town (docs/plan.md, Combat → Town).
import { componentDrops } from './components.ts';
import { createBattle, type BattleResult, type NpcSetup } from '../combat/battle.ts';
import { pcCombatant } from '../combat/combatants.ts';
import type { Battle, CasterState } from '../combat/types.ts';
import type { Character } from '../../data/schemas/index.ts';
import type { Rng } from '../../rules/rng.ts';
import type { GameData } from '../character/context.ts';
import { difficultyTier, type Difficulty } from './difficulty.ts';
import { alive, note, setHp } from './members.ts';
import { accrueShares, fights, moraleAfterFight, npcMonster, removeNpc, typeOf } from './npcs.ts';
import { emit } from './bus.ts';
import { faithLit, inDark } from '../dungeon/light.ts';
import { FAITH_LIGHT, userOf, vigor } from './arts.ts';
import { onSpecial } from '../dungeon/specials.ts';
import { butcher } from './butcher.ts';
import { recordFallen } from './healer.ts';
import { leaveCorpses } from './necromancy.ts';
import { freeCaptive } from './rescue.ts';
import { addLoot } from './shop.ts';
import { wipe } from './town.ts';
import type { Member, Npc, World } from './types.ts';
import { keepSummons } from './summons.ts';

export interface WorldBattle {
  battle: Battle;
  /** Member ids in the order of the battle's pc-N combatants. */
  memberIds: string[];
  /** NPC ids in the order of the battle's npc-N combatants. */
  npcIds: string[];
  /** The line-up the XP simulation replays. */
  setup: PartySetup;
  /** The encounter's enemy rows, for loot. */
  enemies: string[][];
  /** A captive the enemy holds, freed by a win. */
  captive: string | null;
  /** The quest whose fixed encounter this is. */
  quest: string | null;
  /** The garrison post these enemies hold, if any. */
  garrison: string | null;
  /** The faction patrol they are, as faction:uid, if any (Phase 13b). */
  patrol: string | null;
}

function npcSetup(data: GameData, n: Npc): NpcSetup {
  const physician = typeOf(data, n)?.role === 'physician';
  return {
    monster: npcMonster(data, n).id,
    name: n.name,
    row: n.row,
    column: n.column,
    hp: n.hp,
    maxHp: n.maxHp,
    noncombatant: !fights(data, n),
    ...(physician ? { healer: data.content.npcRules.skillBonus } : {}),
  };
}

const fighters = (w: World) => alive(w).filter((m) => m.character.hp.current > 0 && !m.reviving);

export function encounterBattle(w: World, data: GameData): WorldBattle {
  if (!w.encounter) throw new Error('no encounter to fight');
  const fight = partyBattle(w, data, w.encounter.enemies, true, w.encounter.captive);
  return {
    ...fight,
    quest: w.encounter.quest,
    garrison: w.encounter.garrison ?? null,
    patrol: w.encounter.patrol ?? null,
  };
}

/** A fight's starting line-up as plain data, so the XP simulation can replay it in a worker. */
export interface PartySetup {
  party: {
    character: Character;
    row: number;
    column: number;
    frail: boolean;
    spellsCast: number;
    effortDay: number;
    /** Limited art uses since the last rest (Phase 15). */
    artUses: Record<string, number>;
    /** Effort already committed: Light of Faith lighting the way (Phase 15). */
    committed: number;
  }[];
  npcs: NpcSetup[];
  enemies: string[][];
  /** The party fights without light. */
  dark: boolean;
  /** The fight is on an anti-magic square. */
  antiMagic: boolean;
  /** The fight is underground. */
  indoors: boolean;
}

/** The conscious party as it stands, and its NPCs if `withNpcs`, against enemy rows. */
export function partySetup(
  w: World,
  data: GameData,
  enemies: string[][],
  withNpcs: boolean,
): PartySetup {
  const faith = faithLit(w, data) ? userOf(w, data, FAITH_LIGHT) : undefined;
  return {
    party: fighters(w).map((m) => ({
      character: m.character,
      row: m.row,
      column: m.column,
      frail: m.frail,
      spellsCast: m.spellsCast,
      effortDay: m.effortDay,
      artUses: { ...m.artUses },
      committed: m === faith ? 1 : 0,
    })),
    npcs: withNpcs ? w.npcs.filter((n) => n.hp > 0).map((n) => npcSetup(data, n)) : [],
    enemies,
    dark: inDark(w, data),
    antiMagic: onSpecial(w, data, 'anti-magic'),
    indoors: w.dungeon !== null,
  };
}

/** A battle from a line-up, carrying in each PC's Frailty and the day's spent spells and Effort. */
export function battleFrom(data: GameData, rng: Rng, setup: PartySetup, log: boolean): Battle {
  const battle = createBattle({
    data,
    rng,
    party: setup.party.map((p) => ({ character: p.character, row: p.row, column: p.column })),
    npcs: setup.npcs,
    enemies: setup.enemies.map((r) => [...r]),
    dark: setup.dark,
    antiMagic: setup.antiMagic,
    indoors: setup.indoors,
    log,
  });
  setup.party.forEach((p, i) => {
    const c = battle.combatants[i] as Battle['combatants'][number];
    c.frail = p.frail;
    if (c.caster) {
      c.caster.spellsLeft = Math.max(0, c.caster.spellsLeft - p.spellsCast);
      c.caster.effortDay = Math.min(c.caster.effortMax, p.effortDay);
      c.caster.effortUsed = Math.min(c.caster.effortMax, c.caster.effortDay + p.committed);
      c.caster.uses = { ...p.artUses };
    }
  });
  return battle;
}

/** The conscious party, and its NPCs if `withNpcs`, against enemy rows. */
export function partyBattle(
  w: World,
  data: GameData,
  enemies: string[][],
  withNpcs: boolean,
  captive: string | null,
): WorldBattle {
  const setup = partySetup(w, data, enemies, withNpcs);
  const npcs = withNpcs ? w.npcs.filter((n) => n.hp > 0) : [];
  return {
    battle: battleFrom(data, w.rng, setup, true),
    setup,
    memberIds: fighters(w).map((m) => m.id),
    npcIds: npcs.map((n) => n.id),
    enemies,
    captive,
    quest: null,
    garrison: null,
    patrol: null,
  };
}

export function carryBack(data: GameData, m: Member, c: Battle['combatants'][number]): void {
  // Gear readied or stowed mid-fight stays where it was put, even by the fallen.
  if (c.character) m.character = { ...m.character, inventory: c.character.inventory };
  if (c.status === 'dead') {
    m.dead = true;
    setHp(m, 0);
    return;
  }
  // SRD 2.5.1: the stabilized wake ten minutes later with 1 HP and Frail.
  if (c.status === 'stable') {
    setHp(m, 1);
    m.frail = true;
  } else {
    setHp(m, Math.max(1, c.hp));
    m.frail = c.frail;
  }
  if (c.strain) {
    m.character = { ...m.character, strain: { value: c.strain.strain, broken: c.strain.broken } };
  }
  if (c.caster) {
    // The same character fights as a caster outside the battle too.
    const fresh = pcCombatant(data, m.character).caster as CasterState;
    m.spellsCast = Math.max(0, fresh.spellsLeft - c.caster.spellsLeft);
    m.effortDay = c.caster.effortDay;
    m.artUses = { ...c.caster.uses };
  }
}

/** The loot dice and components the defeated enemies drop (docs/rules-adaptation.md, Loot dice). */
function winnings(w: World, data: GameData, enemies: readonly (readonly string[])[]): void {
  const dice = enemies.flatMap((row) =>
    row.flatMap((id) => {
      const loot = data.content.monsterCombat.find((m) => m.id === id)?.loot;
      return loot ? [loot] : [];
    }),
  );
  componentDrops(w, data, enemies.flat());
  butcher(w, data, enemies.flat());
  if (dice.length === 0) return;
  addLoot(w, dice);
  accrueShares(w, data, dice);
  const total = new Map<number, number>();
  for (const d of dice) total.set(d.sides, (total.get(d.sides) ?? 0) + d.count);
  const text = [...total].map(([sides, count]) => `${count}d${sides}`).join(' + ');
  note(w, `The party takes ${text} of loot.`);
}

/** Every PC who fought gets the award; the dead receive it when raised (docs/rules-adaptation.md). */
function award(w: World, data: GameData, fight: WorldBattle, difficulty: Difficulty): void {
  const tier = difficultyTier(data, difficulty);
  note(w, `A ${tier.name} fight: ${tier.xp} XP each.`);
  if (tier.xp === 0) return;
  for (const id of fight.memberIds) {
    const m = w.members.find((x) => x.id === id) as Member;
    if (m.dead) m.pendingXp += tier.xp;
    else m.character = { ...m.character, xp: m.character.xp + tier.xp };
  }
}

/**
 * Writes a concluded battle back to the party and clears the encounter. A win pays loot dice and,
 * given the simulation's verdict, XP; a draw or a loss pays nothing.
 */
export function applyBattle(
  w: World,
  data: GameData,
  fight: WorldBattle,
  result: BattleResult,
  difficulty: Difficulty | null,
): void {
  fight.memberIds.forEach((id, i) => {
    const m = w.members.find((x) => x.id === id) as Member;
    carryBack(data, m, fight.battle.combatants[i] as Battle['combatants'][number]);
  });
  recordFallen(w, fight.memberIds, fight.battle);
  // Tireless Vigor: a Healer regains a hit point after each fight (Phase 15).
  vigor(w, data, 1);
  const npcLost = npcsBack(w, data, fight);
  keepSummons(w, data, fight);
  w.encounter = null;
  if (result.outcome === 'enemy') {
    for (const n of w.npcs.filter((x) => x.kind !== 'hireling')) {
      removeNpc(w, n.id);
      note(w, `${n.name} is taken captive${n.kind === 'captive' ? ' again' : ''}.`);
      if (n.kind === 'escort') emit(w, data, { kind: 'npc-died', npc: n });
    }
    wipe(w, data);
    return;
  }
  if (result.outcome === 'draw')
    note(
      w,
      fight.battle.escaped
        ? 'The party shelters in the Invincible Citadel until its foes give up.'
        : 'The fight breaks off.',
    );
  else {
    note(w, `The party wins after ${result.rounds} round${result.rounds === 1 ? '' : 's'}.`);
    winnings(w, data, fight.enemies);
    leaveCorpses(w, data, fight.enemies);
    if (difficulty) award(w, data, fight, difficulty);
    if (fight.captive) freeCaptive(w, data, fight.captive);
    emit(w, data, {
      kind: 'fight-won',
      quest: fight.quest,
      garrison: fight.garrison,
      patrol: fight.patrol,
    });
  }
  const tier = difficulty && difficultyTier(data, difficulty).name;
  const dangerous = tier !== null && data.content.npcRules.moraleTiers.includes(tier);
  if (dangerous || npcLost || result.deaths > 0) moraleAfterFight(w, data);
}

/** NPC hit points come back from the fight; the dead are gone. True if anyone died. */
function npcsBack(w: World, data: GameData, fight: WorldBattle): boolean {
  let lost = false;
  fight.npcIds.forEach((id, i) => {
    const c = fight.battle.combatants[fight.memberIds.length + i] as Battle['combatants'][number];
    const n = w.npcs.find((x) => x.id === id) as Npc;
    if (c.status !== 'dead') {
      n.hp = c.hp;
      return;
    }
    lost = true;
    removeNpc(w, id);
    note(w, n.kind === 'captive' ? `${n.name} is killed; the rescue is lost.` : `${n.name} dies.`);
    emit(w, data, { kind: 'npc-died', npc: n });
  });
  return lost;
}
