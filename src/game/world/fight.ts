// Overland encounters fought with the combat engine. Fights carry the party's wounds, Frailty,
// strain, and the day's spent spells and Effort in and out (SRD 2.5.1, 4.2.0); a lost fight sends
// the party back to the last town (docs/plan.md, Combat → Town).
import { createBattle, type BattleResult } from '../combat/battle.ts';
import { pcCombatant } from '../combat/combatants.ts';
import type { Battle, CasterState } from '../combat/types.ts';
import type { GameData } from '../character/context.ts';
import { difficultyTier, type Difficulty } from './difficulty.ts';
import { alive, note, setHp } from './members.ts';
import { addLoot } from './shop.ts';
import { wipe } from './town.ts';
import type { Member, World } from './types.ts';

export interface WorldBattle {
  battle: Battle;
  /** Member ids in the order of the battle's pc-N combatants. */
  memberIds: string[];
  /** The encounter's enemy rows, for loot and the XP benchmark. */
  enemies: string[][];
}

const fighters = (w: World) => alive(w).filter((m) => m.character.hp.current > 0);

export function encounterBattle(w: World, data: GameData): WorldBattle {
  if (!w.encounter) throw new Error('no encounter to fight');
  const members = fighters(w);
  const battle = createBattle({
    data,
    rng: w.rng,
    party: members.map((m) => ({ character: m.character, row: m.row, column: m.column })),
    enemies: w.encounter.enemies,
    log: true,
  });
  members.forEach((m, i) => {
    const c = battle.combatants[i] as Battle['combatants'][number];
    c.frail = m.frail;
    if (c.caster) {
      c.caster.spellsLeft = Math.max(0, c.caster.spellsLeft - m.spellsCast);
      c.caster.effortDay = Math.min(c.caster.effortMax, m.effortDay);
      c.caster.effortUsed = c.caster.effortDay;
    }
  });
  return { battle, memberIds: members.map((m) => m.id), enemies: w.encounter.enemies };
}

function carryBack(data: GameData, m: Member, c: Battle['combatants'][number]): void {
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
  }
}

/** The loot dice the defeated enemies drop (docs/rules-adaptation.md, Loot dice). */
function winnings(w: World, data: GameData, enemies: readonly (readonly string[])[]): void {
  const dice = enemies.flatMap((row) =>
    row.flatMap((id) => {
      const loot = data.content.monsterCombat.find((m) => m.id === id)?.loot;
      return loot ? [loot] : [];
    }),
  );
  if (dice.length === 0) return;
  addLoot(w, dice);
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
 * given the benchmark's verdict, XP; a draw or a loss pays nothing.
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
  w.encounter = null;
  if (result.outcome === 'enemy') wipe(w, data);
  else if (result.outcome === 'draw') note(w, 'The fight breaks off.');
  else {
    note(w, `The party wins after ${result.rounds} round${result.rounds === 1 ? '' : 's'}.`);
    winnings(w, data, fight.enemies);
    if (difficulty) award(w, data, fight, difficulty);
  }
}
