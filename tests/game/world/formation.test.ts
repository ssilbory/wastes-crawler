import { describe, expect, it } from 'vitest';
import { moveToSlot } from '../../../src/game/world/formation.ts';
import { addNpc } from '../../../src/game/world/npcs.ts';
import { data, member, world } from './helpers.ts';

const at = (x: { row: number; column: number }) => [x.row, x.column];

describe('rearranging the formation', () => {
  it('moves a PC to an empty slot, leaving their old slot empty', () => {
    const w = world();
    const snag = member(w, 'Snag');
    expect(moveToSlot(w, snag.id, 1, 3)).toBe(true);
    expect(at(snag)).toEqual([1, 3]);
    expect([...w.members, ...w.npcs].some((x) => x.row === 0 && x.column === 0)).toBe(false);
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
