import { describe, expect, it } from 'vitest';
import type { Form } from '../../src/data/schemas/index.ts';
import { formDetails, formHint } from '../../src/render/form-details.ts';
import { data, starter } from '../game/combat/helpers.ts';
import { shifter, WAR, WOLF } from '../game/shifter.ts';

const BEAR: Form = {
  name: 'Bear',
  humanoid: false,
  arts: ['feral-prowess', 'serpents-kiss', 'eyes-of-the-hawk'],
  feral: 'con',
};

describe('a Skinshifter’s forms in detail (1.5.15)', () => {
  it('lists each form’s arts and what wearing it changes', () => {
    // A third-level Wildshaper: attack bonus +0, form bonus +2; Snag has Dex +1, Cha -1.
    const c = shifter('elementalist-partial-skinshifter', [WOLF, WAR, BEAR]);
    const [wolf, war, bear] = formDetails(data, c);
    expect(wolf).toMatchObject({ name: 'Wolf', shape: 'non-humanoid' });
    expect(wolf?.arts.map((a) => a.name)).toEqual([
      'Savage Talons',
      'Intrinsic Armor',
      'Feral Prowess',
    ]);
    expect(wolf?.arts[0]?.hint).toContain('extremely dangerous claws');
    expect(wolf?.changes).toEqual([
      'Attack bonus +0 → +2',
      'AC 11 → 17',
      'Dex +1 → +2',
      'Savage Talons (melee) +2, 1d8+3, Shock 5/AC 13',
    ]);
    expect(war?.changes).toEqual([
      'Attack bonus +0 → +2',
      'Cha -1 → +0',
      '+2 to melee hits, and the form bonus to hit even in a humanoid shape',
    ]);
    expect(bear?.changes).toEqual([
      'Attack bonus +0 → +2',
      'Con +0 → +1',
      'Maximum HP +3',
      'A Savage Talons hit can spend Effort for the scene for 1d8 + Survive more',
      '+2 to Notice checks',
    ]);
    expect(formDetails(data, starter('snag'))).toEqual([]);
  });

  it('gives hover text with the shape and the changes', () => {
    const c = shifter(undefined, [WOLF, { name: 'Plain', humanoid: true, arts: [] }]);
    const [wolf, plain] = formDetails(data, c);
    expect(formHint(wolf as never)).toBe(
      [
        'Wolf, non-humanoid.',
        'AC 11 → 17',
        'Dex +1 → +2',
        'Savage Talons (melee) +2, 1d8+3, Shock 5/AC 13',
      ].join('\n'),
    );
    expect(formHint(plain as never)).toBe('Plain, humanoid.\nNo change to the sheet.');
    expect(plain?.arts).toEqual([]);
    // An art the SRD doesn't know keeps its id as a name.
    const odd = { ...c, forms: [{ name: 'Odd', humanoid: true, arts: ['nope'] }] };
    expect(formDetails(data, odd)[0]?.arts).toEqual([{ id: 'nope', name: 'nope', hint: '' }]);
  });
});
