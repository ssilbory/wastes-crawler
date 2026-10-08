// What a Beastmaster's arts make of the companion and the master (vendor/wwn-srd/1.0 Character
// Creation/1.5.0 Class List/1.5.4 The Beastmaster.md): Shared Vitality's hit dice, and Feral
// Toughness's hit points from the companion's natural hit dice. Both follow the companion as it is
// bound, released, or lost, and the master as they level.
import { sharedHitDice } from '../../rules/beastmaster.ts';
import { rollDie } from '../../rules/dice.ts';
import { characterLevel } from '../../rules/progression.ts';
import type { GameData } from '../character/context.ts';
import { artUsable, note } from './members.ts';
import { monsterOf, removeNpc } from './npcs.ts';
import type { Member, Npc, World } from './types.ts';

/** The art that binds a companion. */
export const BIND = 'bind-companion';

/** The member's companion, with the party or sent away. */
export const companionOf = (w: World, m: Member): Npc | null =>
  w.npcs.find((n) => n.kind === 'companion' && n.master === m.id) ?? m.companion;

/** The companion's natural hit dice, before Shared Vitality. */
export const naturalHitDice = (data: GameData, n: Npc): number => monsterOf(data, n.type).hitDice;

/** Shared Vitality, which a Chosen Friend has without the art (1.5.4). */
export const sharesVitality = (m: Member, n: Npc): boolean =>
  n.chosen === true || m.character.arts.includes('shared-vitality');

/**
 * Shared Vitality: the companion's hit dice rise to the master's level; each new hit die rolls
 * 1d8 more hit points (SRD 5.0, Monster and NPC Stats), as a level gained would.
 */
export function syncCompanion(w: World, data: GameData, m: Member): void {
  const n = companionOf(w, m);
  if (!n) return;
  const natural = naturalHitDice(data, n);
  const want = sharesVitality(m, n)
    ? sharedHitDice(natural, characterLevel(m.character.classes))
    : natural;
  const now = n.hitDice ?? natural;
  if (want <= now) return;
  let extra = 0;
  for (let i = now; i < want; i++) extra += rollDie(w.rng, 8);
  n.maxHp += extra;
  if (n.hp > 0) n.hp += extra;
  n.hitDice = want;
}

/**
 * Feral Toughness: the maximum hit points rise by the companion's natural hit dice while one is
 * bound. Losing them never fells the conscious (as Feral Prowess, Sam's call).
 */
export function syncToughness(w: World, data: GameData, m: Member): void {
  const n = companionOf(w, m);
  const want = m.character.arts.includes('feral-toughness') && n ? naturalHitDice(data, n) : 0;
  const change = want - m.toughness;
  if (change === 0) return;
  const hp = m.character.hp;
  const max = hp.max + change;
  const floor = hp.current > 0 ? 1 : 0;
  const current = Math.min(max, Math.max(floor, hp.current + change));
  m.character = { ...m.character, hp: { max, current } };
  m.toughness = want;
}

/**
 * Runs `step` on the member without Feral Toughness's hit points, so levelling and training roll
 * and keep their own; the art's hit points (and a companion's Shared Vitality) follow after.
 */
export function untoughened<T>(w: World, data: GameData, m: Member, step: () => T): T {
  const { max, current } = m.character.hp;
  const floor = current > 0 ? 1 : 0;
  m.character = {
    ...m.character,
    hp: { max: max - m.toughness, current: Math.max(floor, current - m.toughness) },
  };
  m.toughness = 0;
  try {
    return step();
  } finally {
    syncToughness(w, data, m);
    syncCompanion(w, data, m);
  }
}

/** A companion leaves the party with its master, to wait until called (Sam's call). */
export function followMaster(w: World, m: Member): void {
  const n = w.npcs.find((x) => x.kind === 'companion' && x.master === m.id);
  if (!n) return;
  removeNpc(w, n.id);
  m.companion = n;
  note(w, `${n.name} goes with ${m.character.name}.`);
}

/** A companion with the party whose master can commit Effort to Eyes of the Beast (1.5.4). */
export function sharedEyes(w: World, data: GameData): Npc | undefined {
  return w.npcs.find(
    (n) =>
      n.kind === 'companion' &&
      n.hp > 0 &&
      w.members.some((m) => m.id === n.master && artUsable(data, m, 'eyes-of-the-beast')),
  );
}
