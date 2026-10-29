import { describe, expect, it } from 'vitest';
import type { DungeonState } from '../../src/data/schemas/index.ts';
import type { World } from '../../src/game/world/types.ts';
import { darknessPanels, DARKNESS } from '../../src/render/dungeon-darkness.ts';
import { dungeonView } from '../../src/render/dungeon-view.ts';
import { data, world } from '../game/world/helpers.ts';

/** The party on the barrow's lower level, whose square of magical darkness is at 6,4. */
function at(x: number, y: number, facing: DungeonState['facing']): World {
  const w = world();
  w.dungeon = {
    dungeon: 'old-barrow',
    level: 'barrow-lower',
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
    located: {},
  };
  w.light.lit = 'torch';
  w.light.torch = 6;
  return w;
}

describe('magical darkness in the view (docs/rules-adaptation.md, Darkness)', () => {
  it('draws a dark square as a black block over everything behind it', () => {
    const panels = dungeonView(at(6, 2, 's'), data);
    const i = panels.findIndex((p) => p.key === 'dark-2-0');
    expect(panels[i]).toMatchObject({ kind: 'darkness', fill: DARKNESS });
    // Drawn after every panel of its depth and beyond, so nothing there shows through.
    const last = panels.reduce(
      (n, p, j) => (/-(2|3)-/.test(p.key) && !p.key.startsWith('dark') ? j : n),
      -1,
    );
    expect(i).toBeGreaterThan(last);
  });

  it('shows a side face for a dark square off to one side', () => {
    expect(darknessPanels(2, 0).map((p) => p.key)).toEqual(['dark-2-0']);
    expect(darknessPanels(2, -1).map((p) => p.key)).toEqual(['dark-2--1', 'dark-side-2--1']);
    expect(darknessPanels(2, 1)[1]?.span.near).toBe(2);
  });

  it('lets those who see without light see into it', () => {
    const w = at(6, 2, 's');
    // Apprehending the Arcane Form, still burning.
    (w.dungeon as NonNullable<World['dungeon']>).sight = {
      member: (w.members[0] as World['members'][number]).id,
      until: 5,
    };
    expect(dungeonView(w, data).some((p) => p.kind === 'darkness')).toBe(false);
  });
});
