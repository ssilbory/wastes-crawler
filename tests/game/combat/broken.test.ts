import { describe, expect, it } from 'vitest';
import { stabilize } from '../../../src/game/combat/actions.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { standardBattle, who } from './helpers.ts';

describe('a Broken medic in a fight (docs/rules-adaptation.md, Broken)', () => {
  it('stabilizes at a disadvantage', () => {
    const b = standardBattle([['thug-or-militia']]);
    const [snag, lirael] = [who(b, 'Snag'), who(b, 'Lirael')];
    Object.assign(snag, { status: 'dying', fellRound: b.round, selfStabilize: false });
    Object.assign(lirael, { skills: { ...lirael.skills, heal: 2 }, healModifier: 0 });
    lirael.strain = { strain: 0, max: 10, broken: true };
    // Three dice, the lowest two kept: 1 + 4 + 2 against 8 + 2 (no kit) fails; 4 + 4 + 2 would not.
    const rng = scriptedRng([4, 4, 1]);
    b.rng = rng;
    stabilize(b, lirael, snag);
    expect(snag.status).toBe('dying');
    expect(rng.remaining()).toBe(0);
  });
});
