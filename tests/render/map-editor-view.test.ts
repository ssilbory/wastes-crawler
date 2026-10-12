import { describe, expect, it } from 'vitest';
import type { Region } from '../../src/data/schemas/index.ts';
import { regionMapOf } from '../../src/game/world/region.ts';
import { editorHexCells } from '../../src/render/map-editor-view.ts';
import { data } from '../game/world/helpers.ts';

const lands: Region = {
  id: 'lands',
  name: 'Lands',
  terrain: ['pph', 'ppL'],
  overlay: ['=.!', '...'],
  sites: [
    { id: 'a', name: 'Ash', kind: 'town', size: 'town', col: 0, row: 0 },
    { id: 'b', name: 'Bone', kind: 'town', size: 'village', col: 1, row: 1 },
  ],
  start: 'a',
  exits: [{ name: 'the east road', col: 1, row: 0, to: { region: 'x', col: 0, row: 0 } }],
  garrisons: [],
  encounters: {},
};
const map = regionMapOf(data.content.terrains, lands);

describe('the map editor’s hexes', () => {
  const cells = editorHexCells(
    map,
    [
      { col: 2, row: 0, name: 'Pit' },
      { col: 2, row: 0, name: 'Hole' },
    ],
    { col: 1, row: 1 },
    10,
  );
  const at = (key: string) => cells.find((c) => c.key === key);

  it('shows every hex, with its settlement, road, and the start', () => {
    expect(cells).toHaveLength(6);
    expect(at('0,0')).toMatchObject({ terrain: 'plains', site: 'Ash', road: true, visited: true });
    expect(at('0,0')?.label).toBe('Ash (town, where a party starts), Plains, road (0,0)');
    expect(at('1,1')?.label).toBe('Bone (village), Plains, ordinary (1,1)');
  });

  it('dims dangerous hexes and lists the dungeons on a hex', () => {
    expect(at('2,0')).toMatchObject({ visited: false, dungeon: 'Pit, Hole' });
    expect(at('2,0')?.label).toBe('Hills, dangerous, Pit, Hole (2,0)');
    expect(at('1,0')).toMatchObject({ exit: 'the east road', dungeon: null });
  });

  it('marks the selected hex, or none', () => {
    expect(cells.filter((c) => c.destination).map((c) => c.key)).toEqual(['1,1']);
    expect(editorHexCells(map, [], null, 10).some((c) => c.destination)).toBe(false);
  });
});
