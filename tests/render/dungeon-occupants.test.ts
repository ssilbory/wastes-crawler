import { describe, expect, it } from 'vitest';
import type { DungeonState } from '../../src/data/schemas/index.ts';
import type { World } from '../../src/game/world/types.ts';
import { CELL_SHOWN, occupantsOf, placeIn } from '../../src/render/dungeon-occupants.ts';
import { dungeonView } from '../../src/render/dungeon-view.ts';
import { generateRuin, ruinDungeonId } from '../../src/game/dungeon/generate.ts';
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

  it('shows a hoard’s guards, the level’s boss, over its chest until beaten, then the chest', () => {
    const w = at('buried-waterworks', 'buried-waterworks-1', 5, 5, 'n');
    const hoard = occupantsOf(w, data).get('1,0');
    expect(hoard).toMatchObject({ kind: 'hoard', title: 'A hoard and its guards', chest: true });
    expect(hoard?.figures.length).toBeGreaterThan(0);
    expect(hoard?.figures.length).toBeLessThanOrEqual(CELL_SHOWN - 1);
    expect(hoard?.figures.every((f) => f.foe)).toBe(true);
    // A cache with no guards is left to be found.
    expect(occupantsOf(w, data).has('9,3')).toBe(false);
    w.beaten.push('buried-waterworks/buried-waterworks-1/1,0');
    expect(occupantsOf(w, data).get('1,0')).toMatchObject({ title: 'A hoard', figures: [] });
    w.caches.push('buried-waterworks/buried-waterworks-1/1,0');
    expect(occupantsOf(w, data).has('1,0')).toBe(false);
  });

  it('names a warlord over their hoard, and stands a hoard’s guards down when their order ends', () => {
    const lord = at('scrap-kings-pumpworks', 'scrap-kings-pumpworks-2', 5, 5, 'n');
    expect(occupantsOf(lord, data).get('6,0')?.title).toBe('The Scrap King, over a hoard');
    const warden = at('harrowmere', 'hm-tower-6', 0, 0, 'n');
    expect(occupantsOf(warden, data).get('3,2')?.figures.length).toBeGreaterThan(0);
    warden.ordersEnded.push('warden-seal');
    expect(occupantsOf(warden, data).get('3,2')).toMatchObject({ title: 'A hoard', figures: [] });
  });

  it('shows a ruin’s vault with its guards', () => {
    const ruin = data.content.ruins.find((r) => r.id === 'gallows-crypts');
    if (!ruin) throw new Error('no ruin');
    const last = generateRuin(ruin, 7, data.content.ruinTraps).levels.at(-1);
    const vault = last?.specials.find((x) => x.kind === 'cache' && x.vault);
    if (!last || !vault) throw new Error('no vault');
    const w = at(ruinDungeonId(ruin, 7), last.id, 0, 0, 'n');
    const key = `${vault.at.x},${vault.at.y}`;
    expect(occupantsOf(w, data).get(key)).toMatchObject({
      kind: 'hoard',
      title: 'A vault and its guards',
      chest: true,
    });
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
    // A hoard's chest stands behind its guards, drawn first: beside one guard, between two.
    const lone = placeIn({ kind: 'hoard', title: '', figures: [foe], chest: true }, 1, 0);
    expect(lone.map((p) => p.figure === null)).toEqual([true, false]);
    expect((lone[0]?.x ?? 0) > (lone[1]?.x ?? 0)).toBe(true);
    const pair = placeIn({ kind: 'hoard', title: '', figures: [foe, foe], chest: true }, 1, 0);
    // The guards either side catch the light on the sides facing the middle; the chest on top.
    expect(pair.map((p) => Math.sign(p.light[0]))).toEqual([0, -1, 1]);
    const [box, left, right] = pair.map((p) => p.x + p.size / 2);
    expect(box).toBeCloseTo(160);
    expect((left ?? 0) < 160 && (right ?? 0) > 160).toBe(true);
    // Set back a little: its foot is above the guards'.
    const foot = (p: (typeof pair)[number] | undefined) => (p?.y ?? 0) + ((p?.size ?? 0) * 46) / 48;
    expect(foot(pair[0]) < foot(pair[1])).toBe(true);
  });
});
