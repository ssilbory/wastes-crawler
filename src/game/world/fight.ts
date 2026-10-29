// Overland encounters fought with the combat engine. Fights carry the party's wounds, Frailty,
// strain, and the day's spent spells and Effort in and out (SRD 2.5.1, 4.2.0); a lost fight sends
// the party back to the last town (docs/plan.md, Combat → Town). The line-up is battle-setup.ts.
import type { BattleResult } from '../combat/battle.ts';
import type { Battle } from '../combat/types.ts';
import type { GameData } from '../character/context.ts';
import { battleFrom, fighters, partySetup, riders, type PartySetup } from './battle-setup.ts';
import { difficultyTier, type Difficulty } from './difficulty.ts';
import { note } from './members.ts';
import { moraleAfterFight, removeNpc } from './npcs.ts';
import { carryBack, lastStandBack, npcsBack } from './carry-back.ts';
import { ammoBack } from './ammo.ts';
import { ailmentsBack } from './ailments.ts';
import { winnings } from './winnings.ts';
import { calmWarMounts, mountsBack } from './mount-fights.ts';
import { emit } from './bus.ts';
import { vigor } from './arts.ts';
import { atGuardedHoard } from '../dungeon/ruins.ts';
import { recordFallen } from './healer.ts';
import { leaveCorpses } from './necromancy.ts';
import { endPacts } from './pacts.ts';
import { freeCaptive } from './rescue.ts';
import { wipe } from './town.ts';
import type { Member, Npc, World } from './types.ts';
import { keepSummons } from './summons.ts';
import { companionsBack, unbound } from './companion-fight.ts';
import { riddenBack } from './companion-rider-fight.ts';
import { unseat } from './companion-mounts.ts';

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
    lastStandBack(w, m, c);
    ammoBack(w, data, m, c);
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
