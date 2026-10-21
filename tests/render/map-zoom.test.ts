import { describe, expect, it } from 'vitest';
import {
  fitZoom,
  knownBounds,
  refocus,
  stepZoom,
  viewCentre,
  ZOOMS,
} from '../../src/render/map-zoom.ts';

describe('map zoom', () => {
  it('steps through the levels, held at the ends', () => {
    expect(stepZoom(1, 1)).toBe(1.5);
    expect(stepZoom(1.5, 1)).toBe(2);
    expect(stepZoom(4, 1)).toBe(4);
    expect(stepZoom(2, -1)).toBe(1.5);
    expect(stepZoom(1, -1)).toBe(1);
    // Between levels, a step goes to the next one either way.
    expect(stepZoom(1.75, 1)).toBe(2);
    expect(stepZoom(1.75, -1)).toBe(1.5);
    expect(stepZoom(9, -1)).toBe(3);
    expect(ZOOMS[0]).toBe(1);
  });

  it('keeps a point under the pointer where it was', () => {
    const before = {
      left: 0,
      top: 0,
      width: 400,
      height: 300,
      scrollWidth: 400,
      scrollHeight: 300,
    };
    const after = { width: 400, height: 300, scrollWidth: 800, scrollHeight: 600 };
    // The point a quarter of the way in stays a quarter of the way across the frame.
    expect(refocus(before, after, { x: 0.25, y: 0.5 })).toEqual({ left: 100, top: 150 });
  });

  it('centres on a point, never scrolling past the edges', () => {
    const before = {
      left: 0,
      top: 0,
      width: 400,
      height: 300,
      scrollWidth: 400,
      scrollHeight: 300,
    };
    const after = { width: 400, height: 300, scrollWidth: 1200, scrollHeight: 900 };
    expect(refocus(before, after, { x: 0.5, y: 0.5 }, true)).toEqual({ left: 400, top: 300 });
    expect(refocus(before, after, { x: 0, y: 1 }, true)).toEqual({ left: 0, top: 600 });
    // Back to the whole map, nothing scrolls.
    const fit = { width: 400, height: 300, scrollWidth: 400, scrollHeight: 300 };
    expect(refocus({ ...before, left: 500, scrollWidth: 1200 }, fit, { x: 0.7, y: 0.2 })).toEqual({
      left: 0,
      top: 0,
    });
  });

  it('finds the middle of what shows', () => {
    expect(
      viewCentre({
        left: 400,
        top: 0,
        width: 400,
        height: 300,
        scrollWidth: 1200,
        scrollHeight: 300,
      }),
    ).toEqual({ x: 0.5, y: 0.5 });
  });

  it('boxes the known hexes with a margin, clamped to the map', () => {
    const cell = (cx: number, cy: number, terrain: string | null) => ({ cx, cy, terrain });
    const map = { width: 200, height: 100 };
    const cells = [cell(50, 40, 'plains'), cell(70, 60, 'hills'), cell(150, 90, null)];
    expect(knownBounds(cells, map, 10)).toEqual({ x0: 0.2, y0: 0.3, x1: 0.4, y1: 0.7 });
    // The margin never reaches past the map.
    expect(knownBounds([cell(5, 95, 'plains'), cell(150, 90, null)], map, 10)).toEqual({
      x0: 0,
      y0: 0.85,
      x1: 0.075,
      y1: 1,
    });
    // Nothing known, or everything: Fit already shows what matters.
    expect(knownBounds([cell(5, 5, null)], map, 10)).toBeNull();
    expect(knownBounds([cell(5, 5, 'plains')], map, 10)).toBeNull();
  });

  it('zooms as close as the box allows, and no closer than the levels', () => {
    // A map as wide as its frame and half as tall: zoomed z times, it is z frames wide.
    const frame = { width: 400, height: 300 };
    const map = { width: 800, height: 400 };
    // A small box takes the closest level.
    expect(fitZoom({ x0: 0.4, y0: 0.4, x1: 0.5, y1: 0.5 }, frame, map)).toBe(4);
    // A third of the width allows 3, not 4.
    expect(fitZoom({ x0: 0, y0: 0.4, x1: 0.33, y1: 0.5 }, frame, map)).toBe(3);
    // The whole height: zoomed 1.5 times the map is 300 tall, just the frame; 2 is too tall.
    expect(fitZoom({ x0: 0.4, y0: 0, x1: 0.5, y1: 1 }, frame, map)).toBe(1.5);
    // Too big for any zoom: Fit.
    expect(fitZoom({ x0: 0, y0: 0, x1: 1, y1: 1 }, { width: 400, height: 100 }, map)).toBe(1);
  });
});
