import { describe, expect, it } from 'vitest';
import { apprehend, ARCANE_FORM } from '../../src/game/dungeon/arcane-sight.ts';
import { LITHIC, PALLID_GATE } from '../../src/game/dungeon/stonework.ts';
import { adoptVisage, PALANQUIN, raisePalanquin, VISAGE } from '../../src/game/world/guises.ts';
import { sorceryView } from '../../src/render/sorcery-view.ts';
import { below, place, state } from '../game/dungeon/helpers.ts';
import { highMage } from '../game/world/helpers-mage.ts';
import { data, encounter, world } from '../game/world/helpers.ts';

const ALL = [VISAGE, PALANQUIN, ARCANE_FORM, LITHIC, PALLID_GATE];

describe('sorcery view', () => {
  it('shows nothing without the spells prepared', () => {
    expect(sorceryView(world(), data)).toBeNull();
  });

  it('offers the overland spells above ground, and says what is in force', () => {
    const w = world();
    const m = highMage(w, ALL);
    expect(sorceryView(w, data)).toEqual({
      status: [],
      casters: [
        {
          id: m.id,
          name: 'Fizzwick',
          visage: true,
          palanquin: true,
          sight: false,
          dissolve: false,
          gates: [],
        },
      ],
    });
    adoptVisage(w, data, m.id);
    raisePalanquin(w, data, m.id);
    expect(sorceryView(w, data)).toMatchObject({
      status: [
        'The party wears the seeming of the bound until dawn.',
        "A jade palanquin carries the party's packs.",
      ],
      casters: [{ palanquin: false }],
    });
    w.encounter = encounter([['thug-or-militia']]);
    expect(sorceryView(w, data)?.casters).toEqual([]);
  });

  it('lists a caster for any one spell they can cast here, and none for the rest', () => {
    for (const spell of [ARCANE_FORM, LITHIC, VISAGE]) {
      const w = below();
      highMage(w, [spell]);
      expect(sorceryView(w, data)?.casters).toHaveLength(1);
    }
    const g = place(below(), 'barrow-upper', 4, 0, 's');
    highMage(g, [PALLID_GATE]);
    state(g).seen['barrow-upper'] = ['9,0'];
    expect(sorceryView(g, data)?.casters).toHaveLength(1);
    const p = below();
    highMage(p, [PALANQUIN, PALLID_GATE]);
    expect(sorceryView(p, data)).toBeNull();
  });

  it('offers the dungeon spells below, with rifts to seen stairs and safe squares', () => {
    const w = place(below(), 'barrow-upper', 4, 0, 's');
    const m = highMage(w, ALL);
    state(w).seen['barrow-upper'] = ['4,0', '9,0', '1,8', '5,1'];
    const c = sorceryView(w, data)?.casters[0];
    expect(c).toMatchObject({ visage: true, palanquin: false, sight: true, dissolve: true });
    expect(c?.gates.map((g) => g.label)).toEqual([
      'the way out (1,8)',
      'the stairs to The Lower Barrow (9,0)',
      'the safe square (5,1)',
    ]);
    w.light.lit = null;
    apprehend(w, data, m.id);
    expect(sorceryView(w, data)?.status).toEqual(['Arcane sight lights the dark.']);
  });
});
