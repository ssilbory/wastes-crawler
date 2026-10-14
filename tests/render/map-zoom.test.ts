import { describe, expect, it } from 'vitest';
import { refocus, stepZoom, viewCentre, ZOOMS } from '../../src/render/map-zoom.ts';

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
});
