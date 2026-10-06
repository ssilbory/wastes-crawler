import { describe, expect, it } from 'vitest';
import { crowns, entryText, levelLine, lootText, pointsText } from '../../src/render/town-view.ts';
import { data, starter } from '../game/combat/helpers.ts';

describe('town text', () => {
  it('counts crowns and loot dice', () => {
    expect(crowns(1)).toBe('1 crown');
    expect(crowns(12.5)).toBe('12.5 crowns');
    expect(lootText([])).toBe('none');
    expect(
      lootText([
        { count: 1, sides: 4 },
        { count: 3, sides: 6 },
      ]),
    ).toBe('1d4 + 3d6');
  });

  it('shows level progress', () => {
    const snag = starter('snag');
    expect(levelLine(data, snag)).toBe('Level 1 · XP 0 of 3');
    expect(levelLine(data, { ...snag, xp: 3.5 })).toBe('Level 1 · XP 3.5 of 3 · ready to level up');
  });

  it('names inventory lines and saved points', () => {
    expect(entryText(data, { id: 'crowbar', quantity: 2, location: 'stowed' })).toBe(
      'Crowbar ×2 (stowed)',
    );
    expect(entryText(data, { id: 'mail-shirt', quantity: 1, location: 'worn', small: true })).toBe(
      'Mail Shirt · AC 14, medium (small, worn)',
    );
    expect(entryText(data, { id: 'mystery', quantity: 1, location: 'worn', barding: true })).toBe(
      'mystery (barding, worn)',
    );
    const snag = starter('snag');
    expect(pointsText(snag)).toBe('0 skill points');
    expect(
      pointsText({ ...snag, advancement: { ...snag.advancement, skillPoints: 1, quickPoints: 1 } }),
    ).toBe('1 skill point + 1 Quick Learner');
  });
});
