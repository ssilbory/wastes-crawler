// Read-only views of a battle for the arena UI: each side's slots with HP and conditions. Nothing
// here changes the battle.
import { describe } from '../game/combat/commands.ts';
import { inSlot } from '../game/combat/mounted.ts';
import type { Battle, Combatant, Outcome, SideId } from '../game/combat/types.ts';
import { ROW_SLOTS } from '../rules/formation.ts';

export interface SlotView {
  id: string;
  label: string;
  hp: number;
  maxHp: number;
  /** HP as a share of the maximum, 0–100. */
  hpPercent: number;
  ac: number;
  status: Combatant['status'];
  /** Short condition tags for display, such as "asleep" or "warded". */
  conditions: string[];
  /** Out of the fight for good: dead, fled, or enthralled. */
  gone: boolean;
  /** The war mount fighting from this slot under its rider (docs/rules-adaptation.md, Mounts). */
  mount?: SlotView;
}

export interface SideView {
  side: SideId;
  /** The side's name as a heading, such as "The party". */
  title: string;
  /** Front row first; null marks an empty slot. */
  rows: (SlotView | null)[][];
  rowNames: string[];
}

const STATUS_TAGS: Partial<Record<Combatant['status'], string>> = {
  asleep: 'asleep',
  dying: 'dying',
  stable: 'stable',
  dead: 'dead',
  fled: 'fled',
  out: 'out of the fight',
};

export function conditions(c: Combatant): string[] {
  const tags: string[] = [];
  const status = STATUS_TAGS[c.status];
  if (status) tags.push(status);
  if (c.frail) tags.push('frail');
  if (c.stunned) tags.push('stunned');
  if (c.blindRounds > 0) tags.push('blind');
  if (c.wardRounds > 0) tags.push('warded');
  if (c.totalDefense) tags.push('defending');
  if (c.instinctive) tags.push('on instinct');
  if (c.acBonus > 0) tags.push(`AC +${c.acBonus}`);
  if (c.heldRounds > 0) tags.push('paralyzed');
  if (c.rootedRounds > 0) tags.push('rooted');
  if (c.misted) tags.push('mist');
  if (c.sanctified) tags.push('sanctified');
  if (c.berserk) tags.push('mad');
  if (c.compelled > 0) tags.push('compelled');
  if (c.mergedWith) tags.push('merged');
  if (c.amber) tags.push('frozen in amber');
  if (c.fleet) tags.push('fleet');
  if (c.finalDeath) tags.push('final death');
  if (c.strain?.broken) tags.push('broken');
  return tags;
}

export function slotView(c: Combatant): SlotView {
  return {
    id: c.id,
    label: describe(c),
    hp: c.hp,
    maxHp: c.maxHp,
    hpPercent: c.maxHp > 0 ? Math.round((Math.max(0, c.hp) / c.maxHp) * 100) : 0,
    ac: c.ac,
    status: c.status,
    conditions: conditions(c),
    gone: c.status === 'dead' || c.status === 'fled' || c.status === 'out',
  };
}

/**
 * A side's grid. The party formation is always two rows of four; monster rows show three rows as
 * wide as the widest one, so empty rows keep their place as the rows advance.
 */
export function sideView(b: Battle, side: SideId): SideView {
  const members = b.combatants.filter((c) => c.side === side);
  const formation = b.layout[side] === 'formation';
  const rowCount = formation ? 2 : 3;
  const width = formation ? ROW_SLOTS : Math.max(1, ...members.map((c) => c.column + 1));
  const rows = Array.from({ length: rowCount }, (_, row) =>
    Array.from({ length: width }, (_, column) => {
      // Fallen monsters keep their slot; a living one that advanced takes precedence.
      const here = members.filter((c) => c.row === row && c.column === column && inSlot(c));
      const shown = here.find((c) => c.status === 'active' || c.status === 'asleep') ?? here[0];
      if (!shown) return null;
      const mount = members.find((c) => c.rider === shown.id);
      return mount ? { ...slotView(shown), mount: slotView(mount) } : slotView(shown);
    }),
  );
  const rowNames = formation ? ['Front', 'Rear'] : ['Front', 'Second', 'Third'];
  return { side, title: capitalize(b.sideNames[side]), rows, rowNames };
}

const capitalize = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;

/** A headline for a finished battle. */
export function outcomeText(b: Battle, outcome: Outcome): string {
  if (b.escaped) return `${capitalize(b.sideNames.party)} escapes behind the Invincible Citadel.`;
  return outcome === 'draw' ? 'The fight is a draw.' : `${capitalize(b.sideNames[outcome])} wins.`;
}

export const roundsText = (n: number) => `${n} ${n === 1 ? 'round' : 'rounds'}`;
