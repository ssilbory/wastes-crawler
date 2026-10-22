import { describe, expect, it } from 'vitest';
import { cursorText, stepCursor } from '../../src/render/map-cursor.ts';

describe('map cursor', () => {
  const map = { width: 5, height: 4 };

  it('moves a row up or down, or a column across', () => {
    expect(stepCursor({ col: 2, row: 2 }, 'ArrowUp', map)).toEqual({ col: 2, row: 1 });
    expect(stepCursor({ col: 2, row: 2 }, 'ArrowDown', map)).toEqual({ col: 2, row: 3 });
    expect(stepCursor({ col: 2, row: 2 }, 'ArrowLeft', map)).toEqual({ col: 1, row: 2 });
    expect(stepCursor({ col: 2, row: 2 }, 'ArrowRight', map)).toEqual({ col: 3, row: 2 });
  });

  it('stays on the map at its edges', () => {
    expect(stepCursor({ col: 0, row: 0 }, 'ArrowUp', map)).toEqual({ col: 0, row: 0 });
    expect(stepCursor({ col: 0, row: 0 }, 'ArrowLeft', map)).toEqual({ col: 0, row: 0 });
    expect(stepCursor({ col: 4, row: 3 }, 'ArrowDown', map)).toEqual({ col: 4, row: 3 });
    expect(stepCursor({ col: 4, row: 3 }, 'ArrowRight', map)).toEqual({ col: 4, row: 3 });
  });

  it('ignores other keys', () => {
    expect(stepCursor({ col: 2, row: 2 }, 'Enter', map)).toBeNull();
    expect(stepCursor({ col: 2, row: 2 }, 'w', map)).toBeNull();
  });

  it('names the hex, and the party or the destination on it', () => {
    const cell = { label: 'Rubblegate (3,8)', party: false, destination: false };
    expect(cursorText(cell)).toBe('Rubblegate (3,8)');
    expect(cursorText({ ...cell, party: true })).toBe('Rubblegate (3,8), the party is here');
    expect(cursorText({ ...cell, party: true, destination: true })).toBe(
      'Rubblegate (3,8), the party is here, destination',
    );
  });
});
