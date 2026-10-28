import { describe, expect, it } from 'vitest';
import { automapLegend, CELL_FEET, MAP_CELL } from '../../src/render/automap-view.ts';
import { motionOf } from '../../src/render/dungeon-motion.ts';
import { encounterPortrait, ROW_SHOWN } from '../../src/render/encounter-portrait.ts';
import { VIEW_WIDTH } from '../../src/render/dungeon-geometry.ts';
import { monsterFigureOf } from '../../src/render/figure-view.ts';
import { data } from '../game/combat/helpers.ts';

describe('automap legend (docs/presentation-plan.md, V4)', () => {
  it('lays a scale of up to five cells under the map, with a compass at its right', () => {
    const legend = automapLegend({ width: 20 * MAP_CELL, height: 15 * MAP_CELL });
    expect(legend.blocks).toHaveLength(5);
    expect(legend.blocks.map((b) => b.dark)).toEqual([true, false, true, false, true]);
    expect(legend.label).toBe(`${5 * CELL_FEET} feet`);
    expect(legend.y).toBeGreaterThan(15 * MAP_CELL);
    expect(legend.compass.x).toBeLessThan(20 * MAP_CELL);
    // A narrow map leaves room for the compass, and never less than one cell.
    expect(automapLegend({ width: 6 * MAP_CELL, height: 6 * MAP_CELL }).label).toBe('30 feet');
    expect(automapLegend({ width: 2 * MAP_CELL, height: 2 * MAP_CELL }).blocks).toHaveLength(1);
  });
});

describe('view motion', () => {
  it('moves the view as the party moves, and shakes it when a move is refused', () => {
    expect(motionOf({ step: 'forward' }, true)).toBe('forward');
    expect(motionOf({ step: 'left' }, true)).toBe('left');
    expect(motionOf({ turn: 'right' }, true)).toBe('turn-right');
    expect(motionOf({ turn: 'around' }, true)).toBe('turn-around');
    expect(motionOf({ step: 'back' }, false)).toBe('bump');
  });
});

describe('encounter portrait', () => {
  it('stands each row of foes further back, smaller and higher, back rows drawn first', () => {
    const p = encounterPortrait(data, [
      ['thug-or-militia', 'thug-or-militia'],
      ['hill-giant'],
      ['dire-wolf'],
      ['zombie'],
    ]);
    // Three rows at most.
    expect(p.map((f) => f.depth)).toEqual([4, 3, 2, 2]);
    const [wolf, giant, a, b] = p as [(typeof p)[0], (typeof p)[0], (typeof p)[0], (typeof p)[0]];
    expect(wolf.figure).toEqual({ kind: 'monster', shape: 'beast', large: false });
    expect(giant.figure).toMatchObject({ shape: 'giant', large: true });
    expect(wolf.size).toBeLessThan(giant.size);
    expect(giant.size).toBeLessThan(a.size);
    expect(wolf.y + wolf.size).toBeLessThan(a.y + a.size);
    // A lone foe stands in the middle; a pair either side of it.
    expect(giant.x + giant.size / 2).toBeCloseTo(VIEW_WIDTH / 2);
    expect(a.x + a.size / 2 + (b.x + b.size / 2)).toBeCloseTo(VIEW_WIDTH);
    // Each catches the light on the side toward the middle.
    expect(Math.abs(giant.light[0])).toBe(0);
    for (const f of [a, b])
      expect(Math.sign(f.light[0])).toBe(Math.sign(f.x + f.size / 2 - VIEW_WIDTH / 2));
  });

  it('shows a crowd’s first few, and draws an unknown monster as a beast', () => {
    const crowd = encounterPortrait(data, [Array<string>(9).fill('thug-or-militia')]);
    expect(crowd).toHaveLength(ROW_SHOWN);
    expect(monsterFigureOf(data, 'nobody')).toEqual({
      kind: 'monster',
      shape: 'beast',
      large: false,
    });
  });
});
