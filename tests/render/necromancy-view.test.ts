import { describe, expect, it } from 'vitest';
import { leaveCorpses } from '../../src/game/world/necromancy.ts';
import { necromancyView } from '../../src/render/necromancy-view.ts';
import { data, member, world } from '../game/world/helpers.ts';

describe('necromancy view (Phase 14b)', () => {
  it('shows nothing without a necromantic spell prepared', () => {
    expect(necromancyView(world(), data)).toBeNull();
  });

  it('lists each caster, spells left, what they can cast, and their hurt raised dead', () => {
    const w = world();
    const m = member(w, 'Fizzwick');
    m.character = {
      ...m.character,
      classes: { current: 'full-necromancer', levels: { 'full-necromancer': 3 } },
      spells: { known: ['raise-corpse'], prepared: ['raise-corpse'] },
    };
    m.spellsCast = 1;
    leaveCorpses(w, data, [['thug-or-militia', 'thug-or-militia']]);
    const npc = (id: string, type: string, master: string, hp: number) => ({
      id,
      kind: 'undead' as const,
      type,
      name: id,
      hp,
      maxHp: 5,
      row: 1,
      column: 2,
      quitting: false,
      inventory: [],
      owed: 0,
      refund: 0,
      master,
    });
    w.npcs = [
      npc('a', 'raised-zombie', m.id, 2),
      npc('b', 'raised-skeleton', m.id, 5),
      npc('c', 'zombie', m.id, 1),
      npc('d', 'raised-zombie', 'other', 1),
    ];
    expect(necromancyView(w, data)).toEqual({
      corpses: 2,
      casters: [
        {
          id: m.id,
          name: 'Fizzwick',
          spellsLeft: 1,
          raise: true,
          knight: false,
          command: false,
          mend: [{ id: 'a', name: 'a' }],
        },
      ],
    });
    m.character = {
      ...m.character,
      spells: { known: ['command-the-dead'], prepared: ['command-the-dead'] },
    };
    m.spellsCast = 9;
    expect(necromancyView(w, data)?.casters[0]).toMatchObject({
      spellsLeft: 0,
      raise: false,
      command: true,
      mend: [],
    });
    m.dead = true;
    expect(necromancyView(w, data)).toBeNull();
  });
});
