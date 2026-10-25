// Drawing data for the overland map editor: every hex in plain view, with its settlement, the
// dungeons on it, and the hex being edited. Pure; drawn by the game's own hex map.
import type { RegionMap } from '../game/world/region.ts';
import { hexKey, type Hex } from '../rules/hex.ts';
import { hexCenter, hexPoints, type HexCell } from './hex-view.ts';

export function editorHexCells(
  map: RegionMap,
  dungeons: readonly (Hex & { name: string })[],
  selected: Hex | null,
  size: number,
): HexCell[] {
  const ways = new Map<string, string[]>();
  for (const d of dungeons) ways.set(hexKey(d), [...(ways.get(hexKey(d)) ?? []), d.name]);
  const cells: HexCell[] = [];
  for (let row = 0; row < map.height; row++)
    for (let col = 0; col < map.width; col++) {
      const h = { col, row };
      const key = hexKey(h);
      const terrain = map.terrainAt(h);
      const site = map.siteAt(h);
      const here = ways.get(key) ?? [];
      const { x, y } = hexCenter(h, size);
      const start = site && site.id === map.start.id ? ', where a party starts' : '';
      cells.push({
        key,
        col,
        row,
        points: hexPoints(h, size),
        cx: x,
        cy: y,
        terrain: terrain.id,
        label: `${site ? `${site.name} (${site.size}${start}), ` : ''}${terrain.name}, ${map.dangerAt(h)}${
          here.length > 0 ? `, ${here.join(', ')}` : ''
        } (${key})`,
        road: map.dangerAt(h) === 'road',
        visited: map.dangerAt(h) !== 'dangerous',
        site: site?.name ?? null,
        party: false,
        destination: selected !== null && key === hexKey(selected),
        route: false,
        quest: false,
        dungeon: here.length > 0 ? here.join(', ') : null,
        exit: map.exitAt(h)?.name ?? null,
        grove: null,
        lair: null,
      });
    }
  return cells;
}
