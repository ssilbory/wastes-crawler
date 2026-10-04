import { describe, expect, it } from 'vitest';
import type { DungeonState } from '../../src/data/schemas/index.ts';
import type { World } from '../../src/game/world/types.ts';
import { automap } from '../../src/render/automap-view.ts';
import { dungeonView, shade } from '../../src/render/dungeon-view.ts';
import { lightText, turnText } from '../../src/render/light-view.ts';
import { data, world } from '../game/world/helpers.ts';

function at(x: number, y: number, facing: DungeonState['facing'], seen: string[] = []): World {
  const w = world();
  w.dungeon = {
    dungeon: 'old-barrow',
    level: 'barrow-upper',
    at: { x, y },
    facing,
    seen: { 'barrow-upper': seen },
    turn: 0,
    steps: 0,
    found: {},
    glimpsed: {},
    traps: {},
    read: {},
  };
  w.light.lit = 'torch';
  w.light.torch = 6;
  return w;
}
const find = (w: World, key: string) => dungeonView(w, data).find((p) => p.key === key);

describe('first-person dungeon view', () => {
  it('draws nothing on the surface', () => {
    expect(dungeonView(world(), data)).toEqual([]);
    expect(automap(world(), data)).toBeNull();
  });

  it('frames a door straight ahead and paints it last among the far walls', () => {
    const w = at(1, 3, 'n');
    const panels = dungeonView(w, data);
    const door = panels.find((p) => p.key === 'front-0-0');
    expect(door).toMatchObject({
      kind: 'door',
      points: '80.0,60.0 240.0,60.0 240.0,180.0 80.0,180.0',
      frame: '120.0,84.0 200.0,84.0 200.0,180.0 120.0,180.0',
    });
    // The corridor walls beside the party are the last things drawn.
    expect(panels.at(-1)).toMatchObject({ key: 'right-0-0', kind: 'wall', frame: null });
    expect(panels.at(-2)?.key).toBe('left-0-0');
    expect(panels.findIndex((p) => p.key === 'front-0-0')).toBeGreaterThan(
      panels.findIndex((p) => p.key.endsWith('-1-0')),
    );
  });

  it('shows open floor ahead, a door further on, and a secret door as a plain wall', () => {
    const hall = at(1, 8, 'e');
    expect(find(hall, 'front-0-0')).toBeUndefined();
    expect(find(hall, 'front-1-0')?.kind).toBe('door');
    expect(find(at(3, 1, 'e'), 'front-0-0')).toMatchObject({ kind: 'wall', frame: null });
  });

  it('marks stairs on the floor going down and on the ceiling going up', () => {
    const up = find(at(1, 6, 's'), 'up-2-0');
    expect(up?.kind).toBe('up');
    const [, top] = (up?.points.split(' ')[0] as string).split(',').map(Number);
    expect(top).toBeLessThan(120);
    const down = find(at(9, 2, 'n'), 'down-2-0');
    const [, bottom] = (down?.points.split(' ')[0] as string).split(',').map(Number);
    expect(bottom).toBeGreaterThan(120);
  });

  it('keeps to the level at its edges', () => {
    const corner = dungeonView(at(0, 9, 'w'), data);
    expect(corner.map((p) => p.key)).toEqual(['front-0-1', 'front-0-0', 'left-0-0']);
  });

  it('shades by distance and face, never darker than the floor of the scale', () => {
    expect(shade('wall', 0, false)).toBe('hsl(32 10% 60%)');
    expect(shade('wall', 1, true)).toBe('hsl(32 10% 35%)');
    expect(shade('door', 0, false)).toBe('hsl(28 42% 52%)');
    expect(shade('down', 0, false)).toBe('hsl(42 30% 46%)');
    expect(shade('wall', 10, false)).toBe('hsl(32 10% 8%)');
  });
});

describe('dungeon automap', () => {
  it('draws seen cells, their walls and doors once each, and the party', () => {
    const w = at(2, 8, 'e', ['2,8', '3,8']);
    const m = automap(w, data);
    expect(m).toMatchObject({ width: 160, height: 160 });
    expect(m?.cells).toEqual([
      { key: '2,8', x: 2, y: 8, kind: 'floor' },
      { key: '3,8', x: 3, y: 8, kind: 'floor' },
    ]);
    const doors = m?.lines.filter((l) => l.kind === 'door');
    expect(doors).toEqual([
      { key: '48,128,48,144', x1: 48, y1: 128, x2: 48, y2: 144, kind: 'door' },
    ]);
    expect(m?.party).toBe('45.6,136.0 34.4,140.5 34.4,131.5');
  });

  it('shows a secret door as a wall, the stairs, and a party facing north', () => {
    const m = automap(at(1, 8, 'n', ['3,1', '1,8']), data);
    expect(m?.lines.find((l) => l.key === '64,16,64,32')?.kind).toBe('wall');
    expect(m?.cells[1]?.kind).toBe('up');
    expect(m?.party).toBe('24.0,130.4 28.5,141.6 19.5,141.6');
  });

  it('starts blank on a level not yet seen', () => {
    const w = at(1, 8, 'n');
    w.dungeon = { ...(w.dungeon as DungeonState), seen: {} };
    expect(automap(w, data)?.cells).toEqual([]);
  });
});

describe('light and time underground', () => {
  it('shows nothing in the dark', () => {
    const w = at(1, 3, 'n');
    w.light.lit = null;
    expect(dungeonView(w, data)).toEqual([]);
  });

  it('describes the light and what is left', () => {
    const w = at(1, 8, 'n');
    w.light.lit = null;
    expect(lightText(w)).toBe('No light; 0 torches spare');
    w.light = { ...w.light, lit: 'torch', torch: 4, kitTorches: 1 };
    expect(lightText(w)).toBe('Torch (d4); 1 torch spare');
    const snag = w.members[0] as World['members'][number];
    snag.character = {
      ...snag.character,
      inventory: [
        ...snag.character.inventory,
        { id: 'lantern', quantity: 1, location: 'stowed' },
        { id: 'oil-one-pint', quantity: 1, location: 'stowed' },
      ],
    };
    w.light = { ...w.light, lit: 'lantern', lantern: 12 };
    expect(lightText(w)).toBe('Lantern (d12); 1 torch spare, 1 pint of oil');
    expect(turnText(w)).toBe('Turn 1, step 1 of 12');
    expect(turnText(world())).toBe('');
  });
});

describe('found secrets and known traps', () => {
  it('draws a found secret door as a door, on the view and the map', () => {
    const w = at(3, 1, 'e', ['3,1']);
    expect(find(w, 'front-0-0')?.kind).toBe('wall');
    (w.dungeon as DungeonState).found = { 'barrow-upper': ['4,1,w'] };
    expect(find(w, 'front-0-0')?.kind).toBe('door');
    expect(automap(w, data)?.lines.find((l) => l.key === '64,16,64,32')?.kind).toBe('door');
  });

  it('shows a trap only once the party knows of it, and not once disarmed', () => {
    const w = at(4, 8, 'n', ['4,6']);
    expect(find(w, 'trap-2-0')).toBeUndefined();
    expect(automap(w, data)?.cells[0]?.kind).toBe('floor');
    (w.dungeon as DungeonState).traps = { 'barrow-upper': { '4,6': 'noticed' } };
    expect(find(w, 'trap-2-0')).toMatchObject({ kind: 'trap', fill: shade('trap', 2, false) });
    expect(automap(w, data)?.cells[0]?.kind).toBe('trap');
    (w.dungeon as DungeonState).traps = { 'barrow-upper': { '4,6': 'disarmed' } };
    expect(find(w, 'trap-2-0')).toBeUndefined();
    expect(shade('trap', 0, false)).toBe('hsl(2 60% 48%)');
  });
});
