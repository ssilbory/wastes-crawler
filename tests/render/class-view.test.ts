import { describe, expect, it } from 'vitest';
import { classChoices } from '../../src/render/class-view.ts';
import { data } from '../game/world/helpers.ts';

describe('the class picker list', () => {
  it('puts the single classes first, then the partial ones labeled with their halves', () => {
    const list = classChoices(data.content.classOptions);
    expect(list.slice(0, 5).map((c) => c.label)).toEqual([
      'Warrior',
      'Expert',
      'High Mage',
      'Elementalist',
      'Necromancer',
    ]);
    expect(list.slice(5).map((c) => c.label)).toEqual(
      data.content.classOptions.filter((c) => c.halves).map((c) => `${c.name} (${c.halves})`),
    );
    expect(list.find((c) => c.id === 'blood-priest-partial-warrior')).toEqual({
      id: 'blood-priest-partial-warrior',
      name: 'Blood Knight',
      label: 'Blood Knight (Blood Priest/Warrior)',
    });
  });
});
