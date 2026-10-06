// The party's two rows of four slots, for rearranging outside combat (docs/rules-adaptation.md,
// Formation rules: Rearranging).
import { ROW_SLOTS } from '../rules/formation.ts';
import type { World } from '../game/world/types.ts';

export interface FormationView {
  rows: { name: string; slots: { row: number; column: number; id: string | null }[] }[];
  /** Every PC and NPC who holds a slot, in party order. */
  people: { id: string; name: string }[];
}

const ROW_NAMES = ['Front row', 'Rear row'];

export function formationView(w: World): FormationView {
  const people = [
    ...w.members.map((m) => ({ ...m, name: m.character.name + (m.dead ? ' (dead)' : '') })),
    ...w.npcs,
  ];
  return {
    rows: ROW_NAMES.map((name, row) => ({
      name,
      slots: Array.from({ length: ROW_SLOTS }, (_, column) => ({
        row,
        column,
        id: people.find((p) => p.row === row && p.column === column)?.id ?? null,
      })),
    })),
    people: people.map((p) => ({ id: p.id, name: p.name })),
  };
}
