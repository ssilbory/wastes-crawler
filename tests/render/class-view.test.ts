import { describe, expect, it } from 'vitest';
import { classChoices } from '../../src/render/class-view.ts';
import { data } from '../game/world/helpers.ts';

describe('the class picker list', () => {
  it('puts the single classes first, then the partial ones labeled with their halves', () => {
    const list = classChoices(data.content.classOptions);
    expect(list.map((c) => c.label)).toEqual([
      'Warrior',
      'Expert',
      'High Mage',
      'Elementalist',
      'Necromancer',
      'Invoker',
      'Swashbuckler (Expert/Warrior)',
      'Grave Robber (Necromancer/Expert)',
      'Death Knight (Necromancer/Warrior)',
      'Blood Knight (Blood Priest/Warrior)',
      'Warlock (Invoker/Warrior)',
      'Hedge Wizard (Invoker/Expert)',
      'Berserker (Skinshifter/Warrior)',
      'Wildshaper (Elementalist/Skinshifter)',
      'Priest of Death (Necromancer/Healer)',
      'Blood Saint (Blood Priest/Healer)',
    ]);
    expect(list.find((c) => c.id === 'blood-priest-partial-warrior')).toEqual({
      id: 'blood-priest-partial-warrior',
      name: 'Blood Knight',
      label: 'Blood Knight (Blood Priest/Warrior)',
    });
  });
});
