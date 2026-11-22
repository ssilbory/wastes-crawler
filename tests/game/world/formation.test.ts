import { describe, expect, it } from 'vitest';
import { emit } from '../../../src/game/world/bus.ts';
import { closeRanks, moveToSlot } from '../../../src/game/world/formation.ts';
import { addNpc, removeNpc } from '../../../src/game/world/npcs.ts';
import { data, encounter, member, world } from './helpers.ts';

const at = (x: { row: number; column: number }) => [x.row, x.column];

describe('rearranging the formation', () => {
  it('moves a PC to an empty slot, then each row closes up to the left (Sam’s call)', () => {
    const w = world();
    const snag = member(w, 'Snag');
    expect(moveToSlot(w, snag.id, 1, 3)).toBe(true);
    // Rear: Lirael, Fizzwick, then Snag in the first free slot; Grukk slides into Snag's old one.
    expect(at(snag)).toEqual([1, 2]);
    expect(at(member(w, 'Grukk'))).toEqual([0, 0]);
    expect([...w.members, ...w.npcs].some((x) => x.row === 0 && x.column === 1)).toBe(false);
  });

  it('swaps two PCs', () => {
    const w = world();
    const snag = member(w, 'Snag');
    const lirael = member(w, 'Lirael');
    expect(moveToSlot(w, lirael.id, 0, 0)).toBe(true);
    expect(at(lirael)).toEqual([0, 0]);
    expect(at(snag)).toEqual([1, 0]);
  });

  it('swaps a PC with an NPC, either way round', () => {
    const w = world();
    const npc = addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'Hob', true);
    if (!npc) throw new Error('no room for the NPC');
    const fizzwick = member(w, 'Fizzwick');
    const npcSlot = at(npc);
    expect(moveToSlot(w, npc.id, 1, 1)).toBe(true);
    expect(at(npc)).toEqual([1, 1]);
    expect(at(fizzwick)).toEqual(npcSlot);
    expect(moveToSlot(w, fizzwick.id, 1, 1)).toBe(true);
    expect(at(fizzwick)).toEqual([1, 1]);
    expect(at(npc)).toEqual(npcSlot);
  });

  it('moves the dead like anyone else', () => {
    const w = world();
    const grukk = member(w, 'Grukk');
    grukk.dead = true;
    expect(moveToSlot(w, grukk.id, 1, 2)).toBe(true);
    expect(at(grukk)).toEqual([1, 2]);
  });

  it('leaves everyone in place when moving to their own slot', () => {
    const w = world();
    const snag = member(w, 'Snag');
    expect(moveToSlot(w, snag.id, 0, 0)).toBe(true);
    expect(w.members.map(at)).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
  });

  it('refuses an unknown id or a slot off the grid, changing nothing', () => {
    const w = world();
    const before = w.members.map(at);
    const snag = member(w, 'Snag');
    expect(moveToSlot(w, 'nobody', 0, 2)).toBe(false);
    expect(moveToSlot(w, snag.id, 2, 0)).toBe(false);
    expect(moveToSlot(w, snag.id, -1, 0)).toBe(false);
    expect(moveToSlot(w, snag.id, 0, 4)).toBe(false);
    expect(moveToSlot(w, snag.id, 0, -1)).toBe(false);
    expect(moveToSlot(w, snag.id, 0.5, 0)).toBe(false);
    expect(w.members.map(at)).toEqual(before);
  });
});

describe('rearranging the formation, edge cases', () => {
  /** True when no two of the party's PCs and NPCs share a slot. */
  const noSharing = (w: ReturnType<typeof world>) =>
    new Set([...w.members, ...w.npcs].map((x) => `${x.row}-${x.column}`)).size ===
    w.members.length + w.npcs.length;

  it('moves an NPC to an empty slot, and swaps with a dead occupant', () => {
    const w = world();
    const npc = addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'Hob', true);
    if (!npc) throw new Error('no room for the NPC');
    expect(moveToSlot(w, npc.id, 1, 3)).toBe(true);
    expect(at(npc)).toEqual([1, 2]);
    const grukk = member(w, 'Grukk');
    grukk.dead = true;
    expect(moveToSlot(w, npc.id, 0, 1)).toBe(true);
    expect(at(npc)).toEqual([0, 1]);
    expect(at(grukk)).toEqual([1, 2]);
    expect(noSharing(w)).toBe(true);
  });

  it('refuses a benched member and slots that are not whole numbers', () => {
    const w = world();
    const snag = member(w, 'Snag');
    w.benched = [snag];
    w.members = w.members.filter((m) => m !== snag);
    expect(moveToSlot(w, snag.id, 1, 3)).toBe(false);
    const lirael = member(w, 'Lirael');
    for (const [row, column] of [
      [Number.NaN, 0],
      [0, Number.NaN],
      [Number.POSITIVE_INFINITY, 0],
      [0, Number.NEGATIVE_INFINITY],
    ] as const)
      expect(moveToSlot(w, lirael.id, row, column)).toBe(false);
    expect(at(lirael)).toEqual([1, 0]);
  });

  it('leaves the servant rule working from the new line-up', () => {
    const w = world();
    // Fill the front row by moving the rear pair up; Lirael has the fewest HP.
    moveToSlot(w, member(w, 'Lirael').id, 0, 2);
    moveToSlot(w, member(w, 'Fizzwick').id, 0, 3);
    const ox = addNpc(w, data, 'beast', 'herd-beast', 'herd-beast', 'Ox', true);
    expect(ox && at(ox)).toEqual([0, 2]);
    // Lirael steps back behind her slot, then slides left into the empty rear row.
    expect(at(member(w, 'Lirael'))).toEqual([1, 0]);
    expect(noSharing(w)).toBe(true);
  });
});

describe('closing ranks outside combat (Sam’s call)', () => {
  it('slides each row left on its own, keeping its order', () => {
    const w = world();
    Object.assign(member(w, 'Snag'), { row: 0, column: 3 });
    Object.assign(member(w, 'Grukk'), { row: 0, column: 1 });
    Object.assign(member(w, 'Lirael'), { row: 1, column: 2 });
    Object.assign(member(w, 'Fizzwick'), { row: 1, column: 3 });
    closeRanks(w);
    expect(w.members.map((m) => [m.character.name, ...at(m)])).toEqual([
      ['Snag', 0, 1],
      ['Grukk', 0, 0],
      ['Lirael', 1, 0],
      ['Fizzwick', 1, 1],
    ]);
  });

  it('leaves the slots as they are during an encounter, and closes them once the fight is over', () => {
    const w = world();
    const hob = addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'Hob', true);
    const ned = addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'Ned', true);
    if (!hob || !ned) throw new Error('no room for the NPCs');
    expect([at(hob), at(ned)]).toEqual([
      [0, 2],
      [0, 3],
    ]);
    w.encounter = encounter([['thug-or-militia']]);
    removeNpc(w, hob.id);
    expect(at(ned)).toEqual([0, 3]);
    w.encounter = null;
    emit(w, data, { kind: 'fight-over', won: true, siege: null });
    expect(at(ned)).toEqual([0, 2]);
    // Out of a fight, a dismissal closes the gap at once.
    const al = addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'Al', true);
    if (!al) throw new Error('no room for Al');
    expect(at(al)).toEqual([0, 3]);
    removeNpc(w, ned.id);
    expect(at(al)).toEqual([0, 2]);
  });
});
