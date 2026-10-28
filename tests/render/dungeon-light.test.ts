import { describe, expect, it } from 'vitest';
import {
  darkness,
  dieReach,
  lightView,
  MAX_DARK,
  poolAt,
  POOL_SPREAD,
  walkLight,
} from '../../src/render/dungeon-light.ts';
import type { Member, World } from '../../src/game/world/types.ts';
import { below } from '../game/dungeon/helpers.ts';
import { data, member, world } from '../game/world/helpers.ts';

/** Fizzwick with these arts, as in tests/game/world/arts.test.ts. */
function gift(w: World, arts: string[], classId = 'blood-priest-partial-warrior'): Member {
  const m = member(w, 'Fizzwick');
  m.character = {
    ...m.character,
    classes: { current: classId, levels: { [classId]: 3 } },
    skills: { ...m.character.skills, pray: 1, heal: 1, magic: 1 },
    arts,
    spells: { known: [], prepared: [] },
  };
  return m;
}

describe('the light in the first-person view', () => {
  it('shows nothing on the surface or when the party is blind', () => {
    expect(lightView(world(), data)).toBeNull();
    const w = below();
    w.light.lit = null;
    expect(lightView(w, data)).toBeNull();
  });

  it('flickers a torch, reaching less as its die steps down', () => {
    const w = below();
    w.light.lit = 'torch';
    w.light.torch = 6;
    expect(lightView(w, data)).toMatchObject({ source: 'torch', flicker: true, reach: 2.5 });
    w.light.torch = 4;
    expect(lightView(w, data)?.reach).toBe(2);
  });

  it('burns a lantern steady and further', () => {
    const w = below();
    w.light.lit = 'lantern';
    w.light.lantern = 12;
    expect(lightView(w, data)).toMatchObject({ source: 'lantern', flicker: false, reach: 4 });
  });

  it('lights pale and still by Light of Faith, and cold and short by sight alone', () => {
    const w = below();
    w.light.lit = null;
    gift(w, ['the-light-of-faith']);
    expect(lightView(w, data)).toMatchObject({ source: 'faith', reach: 3.5, flicker: false });
    const dark = below();
    dark.light.lit = null;
    gift(dark, ['flamesight'], 'full-elementalist');
    expect(lightView(dark, data)).toMatchObject({ source: 'sight', reach: 2 });
  });

  it('gives the test walk a fresh torch', () => {
    expect(walkLight()).toMatchObject({ source: 'torch', reach: dieReach(6) });
  });

  it('is clear over the nearer half of its reach and darkest a cell past it', () => {
    const torch = walkLight();
    expect(darkness(torch, 0)).toBe(0);
    expect(darkness(torch, 1.25)).toBe(0);
    expect(darkness(torch, 2.375)).toBeCloseTo(MAX_DARK / 2);
    expect(darkness(torch, 3.5)).toBe(MAX_DARK);
    expect(darkness(torch, 9)).toBe(MAX_DARK);
  });

  it('pools at the party’s feet, easing off over the nearer part of its reach', () => {
    const torch = walkLight();
    expect(poolAt(torch, 0)).toBe(torch.pool);
    expect(poolAt(torch, 0.5)).toBeLessThan(torch.pool);
    expect(poolAt(torch, 0.5)).toBeGreaterThan(poolAt(torch, 1));
    expect(poolAt(torch, torch.reach * POOL_SPREAD)).toBe(0);
    expect(poolAt(torch, 9)).toBe(0);
    // A guttering torch pools less far.
    const low = { ...torch, reach: dieReach(2) };
    expect(poolAt(low, 1)).toBeLessThan(poolAt(torch, 1));
  });

  it('casts no pool by sight alone', () => {
    const dark = below();
    dark.light.lit = null;
    gift(dark, ['flamesight'], 'full-elementalist');
    const sight = lightView(dark, data);
    expect(sight?.pool).toBe(0);
    if (sight) expect(poolAt(sight, 0)).toBe(0);
    expect(walkLight().pool).toBeGreaterThan(0);
  });
});
