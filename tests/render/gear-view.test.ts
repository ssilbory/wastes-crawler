import { describe, expect, it } from 'vitest';
import { findItem, type CatalogItem } from '../../src/game/character/items.ts';
import { defenseStats, itemStats, lineStats } from '../../src/render/gear-view.ts';
import { data } from '../game/combat/helpers.ts';

const item = (id: string) => findItem(data, id) as CatalogItem;

describe('gear stats', () => {
  it('gives armor and shields their AC, magic bonus included', () => {
    expect(itemStats(data, item('mail-shirt'))).toBe('AC 14, medium');
    expect(itemStats(data, item('mail-shirt'), 1)).toBe('AC 15, medium');
    expect(itemStats(data, item('small-shield'))).toBe('AC 13, or +1 over better armor');
    expect(itemStats(data, item('tower-shield'))).toMatch(/, cover$/);
    expect(lineStats(data, item('small-shield'), 1)).toBe('AC 14, or +2 over better armor');
  });

  it('gives weapons their damage, Shock, attributes, range, and traits', () => {
    expect(itemStats(data, item('bow-large'))).toBe(
      '1d8 damage, no Shock, Dex, range 100/600, Two Handed, Reload, Precisely Murderous',
    );
    expect(itemStats(data, item('unarmed-attack'))).toBe(
      '1d2 + Punch damage, no Shock, Str/Dex, Less Lethal',
    );
    expect(itemStats(data, item('axe-war'))).toBe('1d10 damage, Shock 3/AC 15, Str, Two Handed');
    expect(itemStats(data, item('bow-large'), 1)).toMatch(/^1d8\+1 damage/);
  });

  it('gives other gear none, and the inventory only armor and shields', () => {
    expect(itemStats(data, item('arrows-20'))).toBeNull();
    expect(lineStats(data, item('bow-large'))).toBe(itemStats(data, item('bow-large')));
    expect(lineStats(data, item('torch'))).toBeNull();
    expect(defenseStats(data, item('small-shield'))).toBe(lineStats(data, item('small-shield')));
    expect(defenseStats(data, item('bow-large'))).toBeNull();
    expect(defenseStats(data, undefined)).toBeNull();
    expect(lineStats(data, undefined)).toBeNull();
  });
});
