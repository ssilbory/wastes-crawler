import { describe, expect, it } from 'vitest';
import { apprehend, ARCANE_FORM, sightTurns } from '../../../src/game/dungeon/arcane-sight.ts';
import { arcaneSeer, blind } from '../../../src/game/dungeon/light.ts';
import type { GameData } from '../../../src/game/character/context.ts';
import { automap } from '../../../src/render/automap-view.ts';
import { fail, highMage } from '../world/helpers-mage.ts';
import { data, encounter, world } from '../world/helpers.ts';
import { below, place, state } from './helpers.ts';

describe('Apprehending the Arcane Form', () => {
  it('lasts a turn and a half per caster level, rounded down', () => {
    expect([1, 2, 3, 10].map(sightTurns)).toEqual([1, 3, 4, 15]);
  });

  it('shows the level’s magical squares on the map', () => {
    const w = place(below(), 'barrow-lower', 0, 0, 's');
    const m = highMage(w, [ARCANE_FORM], 2);
    expect(apprehend(w, data, m.id)).toEqual({ ok: true });
    expect(m.spellsCast).toBe(1);
    expect(state(w).sensed['barrow-lower']).toEqual(['6,1', '6,4', '6,5', '5,7', '7,7']);
    expect(state(w).sight).toEqual({ member: m.id, until: state(w).turn + 3 });
    expect(w.log.at(-1)).toContain('5 workings of magic glow on this level.');
    expect(automap(w, data)?.sensed).toContainEqual({ key: '7,7', x: 7, y: 7 });
    const up = below();
    const n = highMage(up, [ARCANE_FORM], 1);
    apprehend(up, data, n.id);
    expect(up.log.at(-1)).toContain('No working of magic shows on this level.');
    expect(automap(up, data)?.sensed).toEqual([]);
    const one: GameData = {
      ...data,
      content: {
        ...data.content,
        dungeons: data.content.dungeons.map((d) => ({
          ...d,
          levels: d.levels.map((l) => ({
            ...l,
            specials: l.specials
              .filter((x) => x.kind !== 'teleporter' || l.id !== 'barrow-lower')
              .filter((x) => l.id !== 'barrow-lower' || ['spinner', 'message'].includes(x.kind)),
          })),
        })),
      },
    };
    const v = place(below(), 'barrow-lower', 0, 0, 's');
    apprehend(v, one, highMage(v, [ARCANE_FORM], 1).id);
    expect(v.log.at(-1)).toContain('1 working of magic glow on this level.');
  });

  it('lets the party see in the dark while the caster is awake and the sight lasts', () => {
    const w = below();
    const m = highMage(w, [ARCANE_FORM], 1);
    w.light.lit = null;
    expect(blind(w, data)).toBe(true);
    apprehend(w, data, m.id);
    expect(arcaneSeer(w)).toBe(true);
    expect(blind(w, data)).toBe(false);
    m.character.hp.current = 0;
    expect(blind(w, data)).toBe(true);
    m.character.hp.current = 1;
    state(w).turn += 1;
    expect(arcaneSeer(w)).toBe(false);
    expect(blind(w, data)).toBe(true);
  });

  it('is cast only underground, out of an encounter', () => {
    const w = world();
    const m = highMage(w, [ARCANE_FORM]);
    expect(apprehend(w, data, m.id)).toEqual(fail('There is nothing here for the sight to find.'));
    expect(arcaneSeer(w)).toBe(false);
    const d = below();
    const n = highMage(d, [ARCANE_FORM]);
    d.encounter = encounter([['thug-or-militia']]);
    expect(apprehend(d, data, n.id)).toEqual(fail('Settle the encounter first.'));
    d.encounter = null;
    n.spellsCast = 99;
    expect(apprehend(d, data, n.id)).toEqual(fail('Fizzwick has no spells left today.'));
  });
});
