import { describe, expect, it } from 'vitest';
import type { Attribute } from '../../src/data/schemas/index.ts';
import { focusInfo } from '../../src/game/character/foci.ts';
import { focusLabel } from '../../src/render/focus-label.ts';
import { data, starter } from '../game/combat/helpers.ts';

const NAMES: Record<Attribute, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

function info(id: string) {
  const f = focusInfo(data, id);
  if (!f) throw new Error(`no focus ${id}`);
  return f;
}

describe('a focus as a pick', () => {
  it('is its name alone when the character lacks it', () => {
    const c = { ...starter('grukk'), foci: [] };
    expect(focusLabel(c, info('die-hard'), NAMES)).toBe('Die Hard');
  });

  it('shows the level held when the character has it', () => {
    const c = { ...starter('grukk'), foci: [{ id: 'die-hard', level: 1 }] };
    expect(focusLabel(c, info('die-hard'), NAMES)).toBe('Die Hard (level 1 now)');
  });

  it('says when the focus is at its last level', () => {
    const c = { ...starter('grukk'), foci: [{ id: 'die-hard', level: 2 }] };
    expect(focusLabel(c, info('die-hard'), NAMES)).toBe('Die Hard (level 2, the most)');
  });

  it('names the attributes a once-per-attribute focus already has', () => {
    const f = { id: 'x', name: 'Developed Attribute', levels: [], attributeChoice: true };
    const c = {
      ...starter('grukk'),
      foci: [
        { id: 'x', level: 1, attribute: 'str' as const },
        { id: 'x', level: 1, attribute: 'con' as const },
      ],
    };
    expect(focusLabel(c, f, NAMES)).toBe('Developed Attribute (has Strength, Constitution)');
  });

  it('marks a held entry that lost its attribute', () => {
    const c = { ...starter('grukk'), foci: [{ id: 'developed-attribute', level: 1 }] };
    expect(focusLabel(c, info('developed-attribute'), NAMES)).toBe('Developed Attribute (has ?)');
  });
});
