import { describe, expect, it } from 'vitest';
import type { Terrain } from '../../../src/data/schemas/index.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { endOfDay } from '../../../src/game/world/day.ts';
import { FIREWOOD, gatherFirewood } from '../../../src/game/world/firewood.ts';
import { suggestPlan } from '../../../src/game/world/plans.ts';
import { regionMap } from '../../../src/game/world/region.ts';
import { WORLD_MIGRATIONS } from '../../../src/game/world/save-migrations.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import type { World } from '../../../src/game/world/types.ts';
import { drinkForDay, waterListener } from '../../../src/game/world/water.ts';
import type { Hex } from '../../../src/rules/hex.ts';
import { scriptedThen } from '../../helpers/scripted-rng.ts';
import { place } from '../dungeon/helpers.ts';
import { data, member, world } from './helpers.ts';

/** The first hex of the Dust Fringe whose terrain passes the test, with the party on it. */
function onTerrain(w: World, test: (t: Terrain) => boolean, region = 'wastes-fringe'): Hex {
  const map = regionMap(data, region);
  for (let row = 0; row < map.height; row++)
    for (let col = 0; col < map.width; col++) {
      const h = { col, row };
      if (test(map.terrainAt(h)) && !map.siteAt(h)) {
        w.region = region;
        w.position = h;
        return h;
      }
    }
  throw new Error('no such hex');
}
const dry = (t: Terrain) => t.dry === true;
const wet = (t: Terrain) => t.water && t.movement !== 'impassable';
/** The next die rolls these faces, then the world's own stream goes on. */
const rolls = (w: World, faces: number[]) => (w.rng = scriptedThen(faces, w.rng));

describe('water (Sam’s calls: Water and fuel)', () => {
  it('fills at a water hex or a town, and marks a day touched by dry land', () => {
    const w = world();
    w.water = 4;
    onTerrain(w, wet);
    emit(w, data, { kind: 'hex-entered' });
    expect(w.water).toBe(12);
    expect(w.log.at(-1)).toContain('fills its water');
    expect(w.dryDay).toBe(false);
    onTerrain(w, dry);
    emit(w, data, { kind: 'hex-entered' });
    expect(w.dryDay).toBe(true);
    // In a town the water fills, and the day is not dried by it.
    const town = world();
    town.water = 6;
    emit(town, data, { kind: 'town-entered', town: 'westhold' });
    expect(town).toMatchObject({ water: 12, dryDay: false });
    // Other events, and the world underground, leave it alone.
    const still = world();
    still.water = 6;
    waterListener(still, data, { kind: 'day-passed' });
    place(Object.assign(still, { dungeon: {} as World['dungeon'] }), 'x', 0, 0, 'n');
    waterListener(still, data, { kind: 'hex-entered' });
    expect(still.water).toBe(6);
  });

  it('is drunk only on a dry day outside town, a 1 or 2 stepping it down', () => {
    const w = world();
    expect(drinkForDay(w, data, false)).toBe(false);
    expect(w.water).toBe(12);
    onTerrain(w, dry);
    expect(drinkForDay(w, data, true)).toBe(false);
    expect(w.water).toBe(12);
    rolls(w, [5]);
    expect(drinkForDay(w, data, false)).toBe(false);
    expect(w).toMatchObject({ water: 12, dryDay: false });
    rolls(w, [2]);
    drinkForDay(w, data, false);
    expect(w.water).toBe(10);
    expect(w.log.at(-1)).toContain('The water runs low.');
    w.water = 4;
    rolls(w, [1]);
    expect(drinkForDay(w, data, false)).toBe(false);
    expect(w.water).toBe(0);
    expect(w.log.at(-1)).toContain('The last of the water is gone.');
    expect(drinkForDay(w, data, false)).toBe(true);
    expect(w.log.at(-1)).toContain('There is no water left.');
  });

  it('leaves the dry and waterless Thirsty: strain within the shared cap, and no recovery', () => {
    const w = world();
    onTerrain(w, dry);
    w.water = 0;
    w.rations = 0;
    const snag = member(w, 'Snag');
    const before = snag.character.strain.value;
    endOfDay(w, data);
    expect(snag).toMatchObject({ thirsty: true, hungry: true });
    expect(w.log.join('\n')).toContain('Snag is Hungry, Thirsty');
    // Hungry and Thirsty together cost the one point a day.
    expect(snag.character.strain.value).toBe(before + 1);
    // A wet day ends the thirst.
    onTerrain(w, wet);
    emit(w, data, { kind: 'hex-entered' });
    endOfDay(w, data);
    expect(member(w, 'Snag').thirsty).toBe(false);
  });

  it('keeps the water die and the thirsty in a save; older saves start full', () => {
    const w = world();
    Object.assign(w, { water: 6, dryDay: true });
    member(w, 'Grukk').thirsty = true;
    const back = parseWorld(serializeWorld(w), data);
    if (!back.ok) throw new Error(back.errors.join('; '));
    expect(back.world).toMatchObject({ water: 6, dryDay: true });
    expect(back.world.members.find((m) => m.id === member(w, 'Grukk').id)?.thirsty).toBe(true);
    const up = WORLD_MIGRATIONS[45] as (raw: Record<string, unknown>) => Record<string, unknown>;
    expect(up({ schemaVersion: 45, members: [{ id: 'a' }], benched: [] })).toEqual({
      schemaVersion: 46,
      water: 12,
      dryDay: false,
      members: [{ id: 'a', thirsty: false }],
      benched: [],
    });
    expect(up({ schemaVersion: 45 })).toMatchObject({ water: 12, members: undefined });
  });
});

describe('fuel in treeless land (Sam’s call)', () => {
  it('finds no wood to gather, and the evening plan sends no one to look', () => {
    const w = world();
    w.light.kitsReady = false;
    onTerrain(w, (t) => t.treeless === true && t.movement !== 'impassable');
    const lirael = member(w, 'Lirael');
    expect(gatherFirewood(w, data, [lirael], 6)).toBe(false);
    expect(w.log.at(-1)).toContain('Lirael finds no wood in this treeless land.');
    expect(lirael.character.inventory.some((e) => e.id === FIREWOOD)).toBe(false);
    expect(w.light.kitsReady).toBe(false);
    w.quarter = 2;
    const plan = suggestPlan(w, data);
    expect(plan.kind === 'camp' && Object.values(plan.activities)).not.toContain('firewood');
    // Out of the desert, someone goes for wood again.
    onTerrain(w, (t) => !t.treeless && !t.water && t.movement !== 'impassable');
    const green = suggestPlan(w, data);
    expect(green.kind === 'camp' && Object.values(green.activities)).toContain('firewood');
  });
});
