import { describe, expect, it } from 'vitest';
import { addNpc } from '../../src/game/world/npcs.ts';
import { formationView } from '../../src/render/formation-view.ts';
import { data, member, world } from '../game/world/helpers.ts';

describe('the formation view', () => {
  it('lays out two rows of four slots with their occupants', () => {
    const w = world();
    const view = formationView(w);
    const ids = view.rows.map((r) => r.slots.map((s) => s.id));
    const id = (name: string) => member(w, name).id;
    expect(view.rows.map((r) => r.name)).toEqual(['Front row', 'Rear row']);
    expect(ids).toEqual([
      [id('Snag'), id('Grukk'), null, null],
      [id('Lirael'), id('Fizzwick'), null, null],
    ]);
    expect(view.rows[1]?.slots[3]).toEqual({ row: 1, column: 3, id: null });
  });

  it('lists PCs then NPCs, marking the dead', () => {
    const w = world();
    member(w, 'Grukk').dead = true;
    const npc = addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'Hob', true);
    if (!npc) throw new Error('no room for the NPC');
    expect(formationView(w).people.map((p) => p.name)).toEqual([
      'Snag',
      'Grukk (dead)',
      'Lirael',
      'Fizzwick',
      'Hob',
    ]);
  });
});
