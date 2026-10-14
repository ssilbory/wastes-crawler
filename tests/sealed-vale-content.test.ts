import { describe, expect, it } from 'vitest';
import { contentReferenceErrors, loadContent } from '../src/data/content.ts';
import { parseLevelMap } from '../src/data/dungeon-map.ts';
import { loadSrd } from '../src/data/load.ts';
import type { Region } from '../src/data/schemas/index.ts';
import { neighbors } from '../src/rules/hex.ts';

const srd = loadSrd();
const content = loadContent();
const vale = {
  map: content.regions.find((r) => r.id === 'sealed-vale') as Region,
  dungeons: content.dungeons.filter((d) => d.region === 'sealed-vale'),
};
const terrainAt = (col: number, row: number) =>
  content.terrains.find((t) => t.glyph === vale.map.terrain[row]?.[col]);

describe('the Sealed Vale as a realm (Sam’s call)', () => {
  it('is a realm of one map, checked with the rest of the content', () => {
    expect(contentReferenceErrors(srd, content)).toEqual([]);
    expect(content.realms.find((r) => r.id === 'sealed-vale')).toMatchObject({
      name: 'The Sealed Vale',
      regions: ['sealed-vale'],
      start: 'sealed-vale',
    });
  });

  it('keeps every map’s towns apart by id', () => {
    const town = content.regions[0]?.sites[0];
    if (!town) throw new Error('missing content');
    const regions = content.regions.map((r) =>
      r.id === 'sealed-vale' ? { ...r, sites: [town], start: town.id } : r,
    );
    expect(contentReferenceErrors(srd, { ...content, regions })).toContain(
      `regions: two maps have a town with the id ${town.id}`,
    );
  });
});

describe('the Sealed Vale', () => {
  it('has one town and one way down', () => {
    expect(vale.map.sites.map((s) => s.name)).toEqual(['Lastward']);
    expect(vale.dungeons.map((d) => d.name)).toEqual(['Harrowmere']);
  });

  it('is ringed by impassable peaks, open only through the pass', () => {
    const width = vale.map.terrain[0]?.length as number;
    const height = vale.map.terrain.length;
    const edge: string[] = [];
    for (let row = 0; row < height; row++)
      for (let col = 0; col < width; col++) {
        const border = row === 0 || col === 0 || row === height - 1 || col === width - 1;
        if (border && terrainAt(col, row)?.movement !== 'impassable') edge.push(`${col},${row}`);
      }
    // The pass reaches the eastern edge, and nowhere else does open land.
    expect(edge).toEqual([`${width - 1},8`]);
    // From the town, open land reaches the map's edge only through the pass's last hex.
    const start = vale.map.sites[0] as { col: number; row: number };
    const seen = new Set([`${start.col},${start.row}`]);
    const queue = [start];
    while (queue.length > 0) {
      const h = queue.shift() as { col: number; row: number };
      for (const n of neighbors(h)) {
        const k = `${n.col},${n.row}`;
        const t = terrainAt(n.col, n.row);
        if (!t || t.movement === 'impassable' || seen.has(k)) continue;
        seen.add(k);
        queue.push(n);
      }
    }
    expect([...seen].filter((k) => edge.includes(k))).toEqual(edge);
  });

  it('holds the pass with five posts, each worse than the last', () => {
    const posts = vale.map.garrisons;
    expect(posts.map((g) => `${g.col},${g.row}`)).toEqual(['19,8', '20,8', '21,8', '22,8', '23,8']);
    expect(new Set(posts.map((g) => g.order))).toEqual(new Set(['hold-the-throat']));
    // Each post's strongest member outranks the last post's.
    const strongest = (rows: string[][]) =>
      Math.max(
        ...rows.flat().map((id) => {
          const base = content.settingMonsters.find((s) => s.id === id)?.base ?? id;
          return [...srd.monsters, ...content.monsters].find((m) => m.id === base)?.hitDice ?? 0;
        }),
      );
    const top = posts.map((g) => strongest(g.enemies));
    expect(top).toEqual([3, 4, 8, 10, 12]);
  });

  it('runs from the streets down three sewers and up six tower floors, guarded and trapped', () => {
    const [d] = vale.dungeons;
    expect(d?.levels.map((l) => l.id)).toEqual([
      'hm-streets',
      'hm-sewer-1',
      'hm-sewer-2',
      'hm-sewer-3',
      'hm-tower-1',
      'hm-tower-2',
      'hm-tower-3',
      'hm-tower-4',
      'hm-tower-5',
      'hm-tower-6',
    ]);
    const streets = d?.levels[0];
    const parsed = parseLevelMap(streets?.map ?? []);
    expect(parsed.ok && parsed.map.width * parsed.map.height).toBeGreaterThanOrEqual(200);
    for (const l of d?.levels.filter((x) => x.id.startsWith('hm-tower')) ?? []) {
      expect(l.traps.length, l.id).toBeGreaterThanOrEqual(4);
      const guards = l.garrisons.length + l.specials.filter((s) => 'guards' in s).length;
      expect(guards, l.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps a place to rest within eight steps of every square', () => {
    const step = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] } as const;
    for (const l of vale.dungeons[0]?.levels ?? []) {
      const parsed = parseLevelMap(l.map);
      if (!parsed.ok) throw new Error(l.id);
      const { map } = parsed;
      const far = new Map(l.safe.map((c) => [`${c.x},${c.y}`, 0]));
      const queue = [...l.safe];
      while (queue.length > 0) {
        const c = queue.shift() as { x: number; y: number };
        const d = far.get(`${c.x},${c.y}`) as number;
        for (const side of ['n', 'e', 's', 'w'] as const) {
          if (map.edge(c, side) === 'wall') continue;
          const n = { x: c.x + step[side][0], y: c.y + step[side][1] };
          if (far.has(`${n.x},${n.y}`)) continue;
          far.set(`${n.x},${n.y}`, d + 1);
          queue.push(n);
        }
      }
      for (let y = 0; y < map.height; y++)
        for (let x = 0; x < map.width; x++) {
          const open = (['n', 'e', 's', 'w'] as const).some(
            (s) => map.edge({ x, y }, s) !== 'wall',
          );
          if (open) expect(far.get(`${x},${y}`) ?? 99, `${l.id} ${x},${y}`).toBeLessThanOrEqual(8);
        }
    }
  });
});
