import { describe, expect, it } from 'vitest';
import type { DungeonState } from '../../src/data/schemas/index.ts';
import type { World } from '../../src/game/world/types.ts';
import { CELL_SHOWN, occupantsOf, placeIn } from '../../src/render/dungeon-occupants.ts';
import { dungeonView } from '../../src/render/dungeon-view.ts';
import { data, world } from '../game/world/helpers.ts';

function at(
  dungeon: string,
  level: string,
  x: number,
  y: number,
  facing: DungeonState['facing'],
): World {
  const w = world();
  w.dungeon = {
    dungeon,
    level,
    at: { x, y },
    facing,
    seen: {},
    turn: 0,
    steps: 0,
    found: {},
    dug: {},
    glimpsed: {},
    traps: {},
    read: {},
    sight: null,
    sensed: {},
  };
  w.light.lit = 'torch';
  w.light.torch = 6;
  return w;
}

describe('who stands in the cells ahead', () => {
  it('shows a held captive among their guards until freed', () => {
    const w = at('old-barrow', 'barrow-upper', 9, 0, 'w');
    const held = occupantsOf(w, data).get('6,0');
    expect(held).toMatchObject({ kind: 'captive' });
    expect(held?.title).toContain('held by guards');
    expect(held?.figures.length).toBeGreaterThan(1);
    expect(held?.figures.length).toBeLessThanOrEqual(CELL_SHOWN);
    // The captive stands among the guards, not as one of them.
    expect(held?.figures.filter((f) => !f.foe)).toHaveLength(1);
    expect(held?.figures[0]?.foe).toBe(true);
    // In view three cells down the room.
    expect(dungeonView(w, data).some((p) => p.key === 'occupant-3-0')).toBe(true);
    w.rescues.push('old-barrow/barrow-upper/6,0');
    expect(occupantsOf(w, data).has('6,0')).toBe(false);
  });

  it('shows a garrison post until beaten or its order ends', () => {
    const w = at('ashgate-keep', 'ashgate-ward', 4, 9, 'n');
    const post = occupantsOf(w, data).get('4,5');
    expect(post).toMatchObject({ kind: 'garrison', title: 'A garrison post' });
    expect(post?.figures.every((f) => f.foe)).toBe(true);
    w.beaten.push('ashgate-keep/ashgate-ward/4,5');
    expect(occupantsOf(w, data).has('4,5')).toBe(false);
    const order = data.content.dungeons
      .find((d) => d.id === 'ashgate-keep')
      ?.levels.find((l) => l.id === 'ashgate-ward')
      ?.garrisons.find((g) => g.at.y === 1)?.order as string;
    w.ordersEnded.push(order);
    expect(occupantsOf(w, data).has('4,1')).toBe(false);
  });

  it('shows a quest’s guardians and the item it wants, only while that step is current', () => {
    const w = at('old-barrow', 'barrow-lower', 0, 0, 's');
    expect(occupantsOf(w, data).has('7,3')).toBe(false);
    w.quests['barrow-torc'] = { status: 'active', step: 1, acceptedDay: 0 };
    expect(occupantsOf(w, data).get('7,3')).toMatchObject({ kind: 'guardian' });
    w.quests['barrow-torc'] = { status: 'active', step: 2, acceptedDay: 0 };
    expect(occupantsOf(w, data).has('7,3')).toBe(false);
    const up = at('old-barrow', 'barrow-upper', 1, 8, 'n');
    up.quests['barrow-torc'] = { status: 'active', step: 2, acceptedDay: 0 };
    const item = occupantsOf(up, data).get('5,0');
    expect(item).toMatchObject({ kind: 'item', figures: [] });
    up.quests['barrow-torc'] = { status: 'done', step: 3, acceptedDay: 0 };
    expect(occupantsOf(up, data).has('5,0')).toBe(false);
    expect(occupantsOf(world(), data).size).toBe(0);
  });

  it('stands figures side by side in their cell, a lone one or an item in the middle', () => {
    const foe = {
      figure: { kind: 'monster' as const, shape: 'beast' as const, large: false },
      foe: true,
    };
    const one = placeIn({ kind: 'garrison', title: '', figures: [foe] }, 1, 0);
    expect(one[0]?.x).toBeCloseTo(160 - (one[0]?.size ?? 0) / 2);
    const three = placeIn({ kind: 'garrison', title: '', figures: [foe, foe, foe] }, 1, 0);
    expect(three.map((p) => p.x)).toEqual([...three.map((p) => p.x)].sort((a, b) => a - b));
    expect((three[0]?.size ?? 0) < (one[0]?.size ?? 0)).toBe(true);
    const chest = placeIn({ kind: 'item', title: '', figures: [] }, 1, 0);
    expect(chest).toEqual([expect.objectContaining({ figure: null, foe: false })]);
  });
});
