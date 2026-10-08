// The party stash's weight (docs/rules-adaptation.md, Inventory in Phase 17: Party stash): loot
// dice and components carried in common fill spare Stowed room, porters, pack beasts, and mounts
// first, then the PCs with the most room, then their Overloaded margins (the Encumbrance and
// Overloaded house rules, after vendor/wwn-srd/2.0 The Rules of the Game/2.9.0 Encumbrance.md).
import type { LootDice } from '../../data/schemas/index.ts';
import { carryLoad, type Load } from '../../rules/encumbrance.ts';
import type { GameData } from '../character/context.ts';
import { componentName } from './components.ts';
import { load } from './mounts.ts';
import { carriers } from './loads.ts';
import { alive, memberSheet, note } from './members.ts';
import type { TownResult } from './services.ts';
import type { Member, World } from './types.ts';

export interface PartyLoad {
  /** The stash's weight in Stowed items. */
  weight: number;
  /** Who carries how much of it, by member, NPC, or mount id. */
  shares: Record<string, number>;
  /** Weight past every PC's Overloaded margin, also counted in a PC's share. */
  overflow: number;
}

const count = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

/** The stash's weight: loot dice and components at their content weights. */
export function stashWeight(w: World, data: GameData): number {
  const { lootDie, component } = data.content.equipmentRules.stash;
  const dice = w.loot.reduce((sum, d) => sum + d.count, 0);
  return dice * lootDie + count(w.components) * component;
}

/** A member's own load, from their gear alone. */
const ownLoad = (data: GameData, m: Member) => memberSheet(data, m).equipment.load;

/** Spreads the stash's weight over the party, in the order the house rule gives. */
export function partyLoad(w: World, data: GameData): PartyLoad {
  const weight = stashWeight(w, data);
  const shares: Record<string, number> = {};
  let left = weight;
  const give = (id: string, room: number) => {
    const share = Math.min(left, Math.max(0, room));
    if (share <= 0) return;
    shares[id] = (shares[id] ?? 0) + share;
    left -= share;
  };
  for (const c of carriers(w, data)) give(c.holder.id, c.capacity - load(data, c.holder));
  const pcs = alive(w).map((m) => ({ m, l: ownLoad(data, m) }));
  const byRoom = [...pcs].sort(
    (a, b) => b.l.stowedLimit - b.l.stowed - (a.l.stowedLimit - a.l.stowed),
  );
  for (const { m, l } of byRoom) give(m.id, l.stowedLimit - l.stowed);
  // The Overloaded margin is half Strength, less what the PC's own gear already takes of it.
  const margin = ({ m, l }: (typeof pcs)[number]) =>
    Math.floor(memberSheet(data, m).scores.str / 2) - l.excess;
  const byMargin = [...pcs].sort((a, b) => margin(b) - margin(a));
  for (const pc of byMargin) give(pc.m.id, margin(pc));
  const overflow = left;
  const strongest = byMargin[0];
  if (overflow > 0 && strongest) shares[strongest.m.id] = (shares[strongest.m.id] ?? 0) + overflow;
  return { weight, shares, overflow };
}

/** A member's load with their share of the stash. */
export function memberLoad(w: World, data: GameData, m: Member, party = partyLoad(w, data)): Load {
  const l = ownLoad(data, m);
  const str = memberSheet(data, m).scores.str;
  return carryLoad(l.readied, l.stowed + (party.shares[m.id] ?? 0), str, l.stowedLimit - str);
}

type Stash = { loot: LootDice[]; components: Record<string, number> };
const snapshot = (w: World): Stash => ({
  loot: w.loot.map((d) => ({ ...d })),
  components: { ...w.components },
});

/** Loot dice and component ids gained since `before`. */
function gained(w: World, before: Stash): { dice: number[]; components: string[] } {
  const was = (sides: number) => before.loot.find((d) => d.sides === sides)?.count ?? 0;
  const dice = w.loot.flatMap((d) =>
    Array<number>(Math.max(0, d.count - was(d.sides))).fill(d.sides),
  );
  const components = Object.entries(w.components).flatMap(([id, n]) =>
    Array<string>(Math.max(0, n - (before.components[id] ?? 0))).fill(id),
  );
  return { dice: dice.sort((a, b) => a - b), components };
}

function dropDie(w: World, sides: number): void {
  w.loot = w.loot
    .map((d) => (d.sides === sides ? { ...d, count: d.count - 1 } : d))
    .filter((d) => d.count > 0);
}

function dropComponent(w: World, id: string): void {
  const n = (w.components[id] ?? 0) - 1;
  w.components = Object.fromEntries(
    Object.entries({ ...w.components, [id]: n }).filter(([, v]) => v > 0),
  );
}

/**
 * Runs `gain`, which adds loot dice or components to the stash, then leaves behind what the party
 * can't carry of what it gained: the smallest dice first, then components. Weight the party was
 * already too heavy by before stays. Returns the loot dice kept from the gain.
 */
export function pickUp(w: World, data: GameData, gain: () => void): LootDice[] {
  const before = snapshot(w);
  const already = partyLoad(w, data).overflow;
  gain();
  const got = gained(w, before);
  const { lootDie, component } = data.content.equipmentRules.stash;
  let excess = partyLoad(w, data).overflow - already;
  const left: string[] = [];
  const dice = [...got.dice];
  while (excess > 0 && dice.length > 0) {
    const sides = dice.shift() as number;
    dropDie(w, sides);
    left.push(`a d${sides}`);
    excess -= lootDie;
  }
  for (const id of got.components) {
    if (excess <= 0) break;
    dropComponent(w, id);
    left.push(componentName(data, id).toLowerCase());
    excess -= component;
  }
  if (left.length > 0)
    note(w, `Too laden to carry it all, the party leaves behind ${left.join(', ')}.`);
  const kept = new Map<number, number>();
  for (const sides of dice) kept.set(sides, (kept.get(sides) ?? 0) + 1);
  return [...kept].map(([sides, n]) => ({ count: n, sides }));
}

/** Whether one more of a component fits without leaving anything behind. */
export function roomFor(w: World, data: GameData, id: string): boolean {
  const before = partyLoad(w, data).overflow;
  const was = w.components;
  w.components = { ...was, [id]: (was[id] ?? 0) + 1 };
  const after = partyLoad(w, data).overflow;
  w.components = was;
  return after <= before;
}

/** Leaves one loot die of a size behind for good. */
export function leaveDie(w: World, sides: number): TownResult {
  if (!w.loot.some((d) => d.sides === sides))
    return { ok: false, reason: `No d${sides} to leave.` };
  dropDie(w, sides);
  return { ok: true };
}

/** Leaves one component behind for good. */
export function leaveComponent(w: World, data: GameData, id: string): TownResult {
  if (!w.components[id])
    return { ok: false, reason: `No ${componentName(data, id).toLowerCase()} to leave.` };
  dropComponent(w, id);
  return { ok: true };
}
