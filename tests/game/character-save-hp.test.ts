import { describe, expect, it } from 'vitest';
import { exportCharacter, importCharacter } from '../../src/game/character/io.ts';
import { data, starter } from './combat/helpers.ts';

describe('loading a character from a save', () => {
  it('refuses current hit points above the maximum', () => {
    const c = starter('snag');
    const text = exportCharacter({ ...c, hp: { max: 10, current: 12 } });
    const result = importCharacter(text, data);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toContain('current HP is above maximum HP');
  });

  it('accepts hit points at or below the maximum', () => {
    const c = starter('snag');
    expect(importCharacter(exportCharacter({ ...c, hp: { max: 10, current: 10 } }), data).ok).toBe(
      true,
    );
  });
});
