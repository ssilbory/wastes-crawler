import { describe, expect, it } from 'vitest';
import { enterDungeon } from '../../src/game/dungeon/explore.ts';
import type { World } from '../../src/game/world/types.ts';
import { automapDark } from '../../src/render/automap-view.ts';
import { BRAZIER_REACH, lightView } from '../../src/render/dungeon-light.ts';
import { dungeonView } from '../../src/render/dungeon-view.ts';
import { lightText } from '../../src/render/light-view.ts';
import { data, world } from '../game/world/helpers.ts';

/** The party in the Old Barrow with nothing lit, at `at` on `level`. */
function dark(at: { x: number; y: number }, level = 'barrow-upper'): World {
  const w = world();
  w.position = { col: 5, row: 10 };
  enterDungeon(w, data);
  Object.assign(w.dungeon as NonNullable<World['dungeon']>, { level, at });
  w.light.lit = null;
  return w;
}

describe('a brazier lights its square in the view (Sam’s call)', () => {
  it('shows the view by the brazier’s warm, short light, and says so in the bar', () => {
    const w = dark({ x: 7, y: 3 });
    expect(lightView(w, data)).toMatchObject({
      source: 'brazier',
      reach: BRAZIER_REACH,
      flicker: true,
    });
    expect(dungeonView(w, data).length).toBeGreaterThan(0);
    expect(lightText(w, data)).toMatch(/^No light but the brazier here;/);
    // Off the brazier's square it is pitch dark again.
    const off = dark({ x: 8, y: 3 });
    expect(lightView(off, data)).toBeNull();
    expect(lightText(off, data)).toMatch(/^No light;/);
    expect(lightText(off)).toMatch(/^No light;/);
  });
});

describe('the map on a square of magical darkness (Sam’s call)', () => {
  it('goes dark for a party that can’t see there, and only there', () => {
    // The Old Barrow's lower level has its square of darkness at 6,4.
    expect(automapDark(dark({ x: 6, y: 4 }, 'barrow-lower'), data)).toBe(true);
    expect(automapDark(dark({ x: 6, y: 3 }, 'barrow-lower'), data)).toBe(false);
    // A torch is swallowed by the darkness too.
    const lit = dark({ x: 6, y: 4 }, 'barrow-lower');
    lit.light.lit = 'torch';
    expect(automapDark(lit, data)).toBe(true);
    // Apprehending the Arcane Form sees in it, so the map still reads.
    const seen = dark({ x: 6, y: 4 }, 'barrow-lower');
    const s = seen.dungeon as NonNullable<World['dungeon']>;
    s.sight = { member: (seen.members[0] as World['members'][number]).id, until: s.turn + 5 };
    expect(automapDark(seen, data)).toBe(false);
    expect(automapDark(world(), data)).toBe(false);
  });
});
