import { describe, expect, it } from 'vitest';
import { findPath, pathToward, regionMap } from '../../../src/game/world/region.ts';
import { hexKey, type Hex } from '../../../src/rules/hex.ts';
import { data } from './helpers.ts';

const map = regionMap(data, 'borderlands');
const keys = (path: Hex[] | null) => path?.map(hexKey) ?? null;
const known = (...list: string[]) => new Set(list);

describe('keeping to roads', () => {
  // Row 8 is the road from column 3 to 20, through open plain on every side.
  const plain = new Set<string>();
  for (let col = 2; col <= 12; col++)
    for (let row = 5; row <= 11; row++) plain.add(`${col},${row}`);
  const onRoad = (path: Hex[] | null) => (path ?? []).every((h) => map.dangerAt(h) === 'road');

  it('takes the road over a cross-country route that costs the same', () => {
    const from = { col: 3, row: 8 };
    const to = { col: 10, row: 8 };
    const hike = pathToward(map, from, to, plain);
    expect(onRoad(hike)).toBe(true);
    expect(hike).toHaveLength(7);
    // Unexplored, it heads for the nearest known hex the same way.
    expect(onRoad(pathToward(map, from, { col: 14, row: 8 }, plain))).toBe(true);
  });

  it('never takes a slower road: it leaves the road where the plain is shorter', () => {
    // 10,5 is off the road to the north; the route costs what the plain alone would.
    const from = { col: 3, row: 8 };
    const to = { col: 10, row: 5 };
    const hike = pathToward(map, from, to, plain);
    expect(hike).toHaveLength((findPath(map, from, to, plain) as Hex[]).length);
    expect(hike?.at(-1)).toEqual(to);
    expect(onRoad(hike)).toBe(false);
  });

  it('leaves the other route finders as they were', () => {
    const from = { col: 3, row: 8 };
    const to = { col: 10, row: 8 };
    expect(findPath(map, from, to, plain)).toHaveLength(7);
    expect(findPath(map, from, to, plain, new Set(), true)).toEqual(
      pathToward(map, from, to, plain),
    );
  });
});

describe('heading toward a hex', () => {
  it('takes the full route once the hex is known', () => {
    const line = known('3,8', '4,8', '5,8', '6,8');
    const from = { col: 3, row: 8 };
    const to = { col: 6, row: 8 };
    expect(pathToward(map, from, to, line)).toEqual(findPath(map, from, to, line));
    expect(keys(pathToward(map, from, to, line))).toEqual(['4,8', '5,8', '6,8']);
  });

  it('stops at the known hex nearest an unexplored one, never stepping into fog', () => {
    const line = known('3,8', '4,8', '5,8', '6,8');
    expect(keys(pathToward(map, { col: 3, row: 8 }, { col: 10, row: 8 }, line))).toEqual([
      '4,8',
      '5,8',
      '6,8',
    ]);
  });

  it('takes the cheaper route when known hexes tie for nearest', () => {
    // Every hex in column 6 from row 1 to 15 is 14 hexes from 20,8.
    const land = known('5,8', '6,8', '5,9', '5,10', '6,10');
    expect(keys(pathToward(map, { col: 5, row: 8 }, { col: 20, row: 8 }, land))).toEqual(['6,8']);
  });

  it('goes around avoided hexes', () => {
    const line = known('3,8', '4,8', '5,8', '6,8');
    const from = { col: 3, row: 8 };
    expect(keys(pathToward(map, from, { col: 10, row: 8 }, line, known('5,8')))).toEqual(['4,8']);
  });

  it('is null when no known hex is nearer, or the known hex cannot be reached', () => {
    const line = known('3,8', '4,8', '5,8', '6,8');
    expect(pathToward(map, { col: 6, row: 8 }, { col: 10, row: 8 }, line)).toBeNull();
    // The lake at 6,4 is known, so findPath's answer stands.
    expect(pathToward(map, { col: 6, row: 7 }, { col: 6, row: 4 }, known('6,7', '6,4'))).toBeNull();
  });
});
