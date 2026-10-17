import { describe, expect, it } from 'vitest';
import { encounterBattle } from '../../../src/game/world/fight.ts';
import { addNpc } from '../../../src/game/world/npcs.ts';
import type { World } from '../../../src/game/world/types.ts';
import { data, encounter, member, world } from './helpers.ts';

const at = (x: { row: number; column: number }) => [x.row, x.column];

/** The starters with Lirael and Fizzwick moved up: a full front row, an empty rear. */
function fullFront(): World {
  const w = world();
  Object.assign(member(w, 'Lirael'), { row: 0, column: 2 });
  Object.assign(member(w, 'Fizzwick'), { row: 0, column: 3 });
  return w;
}

const setHp = (w: World, name: string, current: number) => {
  const m = member(w, name);
  m.character = { ...m.character, hp: { max: Math.max(m.character.hp.max, current), current } };
};

describe('servants joining the party take the front where they can', () => {
  it('take a free front slot, moving no one', () => {
    const w = world();
    const zombie = addNpc(w, data, 'undead', 'zombie', 'zombie', 'Rotter', true);
    expect(zombie && at(zombie)).toEqual([0, 2]);
    expect(w.members.map(at)).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
  });

  it('with the front full, the PC with the fewest HP steps back behind them', () => {
    const w = fullFront();
    setHp(w, 'Lirael', 1);
    const beast = addNpc(w, data, 'beast', 'herd-beast', 'herd-beast', 'Ox', true);
    expect(beast && at(beast)).toEqual([0, 2]);
    expect(at(member(w, 'Lirael'))).toEqual([1, 2]);
    expect(w.log.at(-1)).toMatch(/Lirael steps back for Ox\./);
  });

  it('never moves another servant, and leaves hirelings to the old rule', () => {
    const w = fullFront();
    for (const [name, hp] of [
      ['Snag', 5],
      ['Grukk', 9],
      ['Lirael', 8],
      ['Fizzwick', 2],
    ] as const)
      setHp(w, name, hp);
    const ox = addNpc(w, data, 'beast', 'herd-beast', 'herd-beast', 'Ox', true);
    if (!ox) throw new Error('no room for the ox');
    expect(at(ox)).toEqual([0, 3]);
    ox.hp = 1;
    setHp(w, 'Snag', 3);
    const rotter = addNpc(w, data, 'undead', 'zombie', 'zombie', 'Rotter', true);
    expect(rotter && at(rotter)).toEqual([0, 0]);
    expect(at(member(w, 'Snag'))).toEqual([1, 0]);
    expect(at(ox)).toEqual([0, 3]);
    const guard = fullFront();
    const hired = addNpc(guard, data, 'hireling', 'guard', 'thug-or-militia', 'Hob', true);
    expect(hired && at(hired)).toEqual([1, 0]);
    expect(guard.members.filter((m) => m.row === 0)).toHaveLength(4);
  });

  it('never move the dead or the unconscious, only the weakest one awake', () => {
    const w = fullFront();
    setHp(w, 'Snag', 0);
    member(w, 'Snag').dead = true;
    setHp(w, 'Grukk', 0);
    member(w, 'Grukk').reviving = true;
    setHp(w, 'Lirael', 4);
    setHp(w, 'Fizzwick', 6);
    const ox = addNpc(w, data, 'beast', 'herd-beast', 'herd-beast', 'Ox', true);
    expect(ox && at(ox)).toEqual([0, 2]);
    expect([member(w, 'Snag'), member(w, 'Grukk'), member(w, 'Lirael')].map(at)).toEqual([
      [0, 0],
      [0, 1],
      [1, 2],
    ]);
  });

  it('find no slot once the NPC slots are full', () => {
    const w = fullFront();
    addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'A', true);
    addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'B', true);
    const before = w.members.map(at);
    expect(addNpc(w, data, 'undead', 'zombie', 'zombie', 'Rotter', true)).toBeNull();
    expect(w.members.map(at)).toEqual(before);
  });

  it('can move a hireling back like a PC', () => {
    const w = world();
    Object.assign(member(w, 'Lirael'), { row: 0, column: 2 });
    const hob = addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'Hob', true);
    if (!hob) throw new Error('no room for Hob');
    expect(at(hob)).toEqual([0, 3]);
    hob.hp = 1;
    const ox = addNpc(w, data, 'beast', 'herd-beast', 'herd-beast', 'Ox', true);
    expect(ox && at(ox)).toEqual([0, 3]);
    expect(at(hob)).toEqual([1, 3]);
    expect(w.log.at(-1)).toMatch(/Hob steps back for Ox\./);
  });

  it('find no slot when every formation slot is taken', () => {
    const w = fullFront();
    addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'Hob', true);
    for (const column of [1, 2, 3])
      w.members.push({ ...member(w, 'Snag'), id: `x-${column}`, row: 1, column });
    expect(addNpc(w, data, 'undead', 'zombie', 'zombie', 'Rotter', true)).toBeNull();
  });

  it('fight marked as servants, unlike hirelings', () => {
    const w = world();
    addNpc(w, data, 'undead', 'zombie', 'zombie', 'Rotter', true);
    addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'Hob', true);
    w.encounter = encounter([['thug-or-militia']]);
    const npcs = encounterBattle(w, data).battle.combatants.filter((c) => c.id.startsWith('npc-'));
    expect(npcs.map((c) => [c.name, c.servant])).toEqual([
      ['Rotter', true],
      ['Hob', false],
    ]);
  });
});
