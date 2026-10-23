// Overland encounters fought with the combat engine. Fights carry the party's wounds, Frailty,
// strain, and the day's spent spells and Effort in and out (SRD 2.5.1, 4.2.0); a lost fight sends
// the party back to the last town (docs/plan.md, Combat → Town).
import {
  createBattle,
  type BattleResult,
  type MountSetup,
  type NpcSetup,
} from '../combat/battle.ts';
import type { Battle, WaitingCompanion } from '../combat/types.ts';
import type { Character, Element } from '../../data/schemas/index.ts';
import type { Rng } from '../../rules/rng.ts';
import type { GameData } from '../character/context.ts';
import { difficultyTier, type Difficulty } from './difficulty.ts';
import { alive, note } from './members.ts';
import { fights, isServant, moraleAfterFight, npcMonster, removeNpc, typeOf } from './npcs.ts';
import { carryBack, npcsBack } from './carry-back.ts';
import { ailPenalty } from './ailing.ts';
import { ailmentsBack } from './ailments.ts';
import { winnings } from './winnings.ts';
import { calmWarMounts, mountSetups, mountsBack } from './mount-fights.ts';
import { emit } from './bus.ts';
import { faithLit, inDark } from '../dungeon/light.ts';
import { FAITH_LIGHT, userOf, vigor } from './arts.ts';
import { onSpecial } from '../dungeon/specials.ts';
import { atGuardedHoard } from '../dungeon/ruins.ts';
import { recordFallen } from './healer.ts';
import { leaveCorpses } from './necromancy.ts';
import { endPacts, pactOf } from './pacts.ts';
import { freeCaptive } from './rescue.ts';
import { wipe } from './town.ts';
import type { Member, Mount, Npc, World } from './types.ts';
import { keepSummons } from './summons.ts';
import { BIND, companionOf } from './companion-sync.ts';
import { companionsBack, companionSetup, unbound, waitingSetup } from './companion-fight.ts';
import { riddenBack } from './companion-rider-fight.ts';
import { riddenBy, unseat } from './companion-mounts.ts';

export interface WorldBattle {
  battle: Battle;
  /** Member ids in the order of the battle's pc-N combatants. */
  memberIds: string[];
  /** NPC ids in the order of the battle's npc-N combatants. */
  npcIds: string[];
  /** Members whose ridden companions follow the NPCs, in order (Mounts: Sam's call). */
  riddenIds: string[];
  /** War mount ids in the order of the battle's mount-N combatants. */
  mountIds: string[];
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

function npcSetup(data: GameData, n: Npc, party: readonly Member[]): NpcSetup {
  const physician = typeOf(data, n)?.role === 'physician';
  const master = party.findIndex((m) => n.kind === 'companion' && m.id === n.master);
  const m = party[master];
  return {
    ...(m ? { companion: companionSetup(data, m, n, master) } : {}),
    monster: npcMonster(data, n).id,
    name: n.name,
    row: n.row,
    column: n.column,
    hp: n.hp,
    maxHp: n.maxHp,
    noncombatant: !fights(data, n),
    servant: isServant(n),
    ...(physician ? { healer: data.content.npcRules.skillBonus } : {}),
  };
}

/** Fighters carried by a living companion, which fights from their slot above ground. */
const riders = (w: World, party: readonly Member[]) =>
  party.filter((m) => (riddenBy(w, m)?.hp ?? 0) > 0);

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
    pointsSpent: number;
    /** The alternate form worn into the fight (1.5.15). */
    form: number | null;
    effortDay: number;
    /** Limited art uses since the last rest (Phase 15). */
    artUses: Record<string, number>;
    /** Effort already committed: Light of Faith lighting the way (Phase 15). */
    committed: number;
    /** The element of a Pact of Stone and Sea on them, if any. */
    pact: Element | null;
    /** Poisoned, and the penalty their poison and disease bring into the fight. */
    poisoned: boolean;
    ailPenalty: number;
    /** May bind a beast among the foes, and a companion sent away to howl for (1.5.4). */
    canBind: boolean;
    waiting: WaitingCompanion | null;
  }[];
  npcs: NpcSetup[];
  /** War mounts under their riders (docs/rules-adaptation.md, Mounts). */
  mounts: MountSetup[];
  enemies: string[][];
  /** The party fights without light. */
  dark: boolean;
  /** The fight is on an anti-magic square. */
  antiMagic: boolean;
  /** The fight is underground. */
  indoors: boolean;
}

/**
 * The conscious party as it stands (or `party`), its NPCs if `withNpcs`, and war mounts, against
 * enemy rows.
 */
export function partySetup(
  w: World,
  data: GameData,
  enemies: string[][],
  withNpcs: boolean,
  mounts: readonly Mount[] = [],
  party: readonly Member[] = fighters(w),
): PartySetup {
  const faith = faithLit(w, data) ? userOf(w, data, FAITH_LIGHT) : undefined;
  return {
    party: party.map((m) => ({
      character: m.character,
      row: m.row,
      column: m.column,
      frail: m.frail,
      spellsCast: m.spellsCast,
      pointsSpent: m.pointsSpent,
      form: m.form,
      effortDay: m.effortDay,
      artUses: { ...m.artUses },
      committed: m === faith ? 1 : 0,
      pact: pactOf(w, m.id) ?? null,
      poisoned: m.poisoned,
      ailPenalty: ailPenalty(data, m),
      canBind: m.character.arts.includes(BIND) && !companionOf(w, m),
      waiting: waitingSetup(data, m),
    })),
    npcs: withNpcs
      ? [
          ...w.npcs.filter((n) => n.hp > 0).map((n) => npcSetup(data, n, party)),
          ...riders(w, party).map((m) => ({
            ...npcSetup(data, riddenBy(w, m) as Npc, party),
            rider: party.indexOf(m),
          })),
        ]
      : [],
    mounts: mountSetups(w, data, party, mounts),
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
    party: setup.party.map((p) => ({
      character: p.character,
      row: p.row,
      column: p.column,
      form: p.form,
      canBind: p.canBind,
      waiting: p.waiting,
    })),
    npcs: setup.npcs,
    mounts: setup.mounts,
    enemies: setup.enemies.map((r) => [...r]),
    dark: setup.dark,
    antiMagic: setup.antiMagic,
    indoors: setup.indoors,
    log,
  });
  setup.party.forEach((p, i) => {
    const c = battle.combatants[i] as Battle['combatants'][number];
    c.frail = p.frail;
    c.pact = p.pact;
    c.poisoned = p.poisoned;
    c.ailPenalty = p.ailPenalty;
    if (c.caster) {
      c.caster.spellsLeft = Math.max(0, c.caster.spellsLeft - p.spellsCast);
      c.caster.pointsLeft = Math.max(0, c.caster.pointsLeft - p.pointsSpent);
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
  const mounts = withNpcs ? calmWarMounts(w, data, fighters(w)) : [];
  const setup = partySetup(w, data, enemies, withNpcs, mounts);
  const npcs = withNpcs ? w.npcs.filter((n) => n.hp > 0) : [];
  return {
    battle: battleFrom(data, w.rng, setup, true),
    setup,
    memberIds: fighters(w).map((m) => m.id),
    npcIds: npcs.map((n) => n.id),
    riddenIds: withNpcs ? riders(w, fighters(w)).map((m) => m.id) : [],
    mountIds: mounts.map((m) => m.id),
    enemies,
    captive,
    quest: null,
    garrison: null,
    patrol: null,
  };
}

/** What a won fight of this difficulty is worth, as the journal and the fight log tell it. */
export function xpText(data: GameData, difficulty: Difficulty): string {
  const tier = difficultyTier(data, difficulty);
  return `A ${tier.name} fight: ${tier.xp} XP each.`;
}

/** Every PC who fought gets the award; the dead receive it when raised (docs/rules-adaptation.md). */
function award(w: World, data: GameData, fight: WorldBattle, difficulty: Difficulty): void {
  const tier = difficultyTier(data, difficulty);
  note(w, xpText(data, difficulty));
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
    const c = fight.battle.combatants[i] as Battle['combatants'][number];
    carryBack(data, m, c);
    ailmentsBack(w, data, m, c);
  });
  recordFallen(w, fight.memberIds, fight.battle);
  // The fight ends the scene, and any Pact of Stone and Sea with it.
  endPacts(w);
  // Tireless Vigor: a Healer regains a hit point after each fight (Phase 15).
  vigor(w, data, 1);
  const npcLost = npcsBack(w, data, fight);
  riddenBack(w, data, fight);
  mountsBack(w, fight);
  keepSummons(w, data, fight);
  companionsBack(w, data, fight);
  w.encounter = null;
  if (result.outcome === 'enemy') {
    // Pack beasts come back with the party, like mounts (docs/rules-adaptation.md, Mounts).
    for (const n of w.npcs.filter((x) => x.kind !== 'hireling' && x.kind !== 'pack')) {
      removeNpc(w, n.id);
      // A companion runs for the wilds, to be called again (The Beastmaster, Sam's call).
      const master = w.members.find((m) => n.kind === 'companion' && m.id === n.master);
      if (master) {
        master.companion = { ...n, hp: Math.max(n.chosen ? 0 : 1, n.hp) };
        note(w, `${n.name} flees into the wilds.`);
        continue;
      }
      note(w, `${n.name} is taken captive${n.kind === 'captive' ? ' again' : ''}.`);
      if (n.kind === 'escort') emit(w, data, { kind: 'npc-died', npc: n });
    }
    for (const m of w.members.filter((x) => x.companion?.ridden)) {
      unseat(m.companion as Npc);
      note(w, `${(m.companion as Npc).name} flees into the wilds.`);
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
    // A beast bound mid-fight is neither loot nor a corpse (1.5.4).
    const slain = unbound(fight);
    const xp = difficulty ? difficultyTier(data, difficulty).xp : 0;
    winnings(w, data, slain, { xp, boss: fight.quest !== null || atGuardedHoard(w, data) });
    leaveCorpses(w, data, slain);
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
