import { describe, expect, it } from 'vitest';
import { pcCombatant } from '../../../src/game/combat/combatants.ts';
import { harm } from '../../../src/game/combat/damage.ts';
import { data, standardBattle, starter, who } from './helpers.ts';

// vendor/wwn-srd/1.0 Character Creation/1.6.0 Foci.md, Die Hard level 1: "You automatically
// stabilize if Mortally Wounded."
describe('Die Hard', () => {
  it('marks a PC with the focus, and only them', () => {
    expect(pcCombatant(data, starter('grukk')).selfStabilize).toBe(true);
    expect(pcCombatant(data, starter('snag')).selfStabilize).toBe(false);
  });

  it('falls to zero stable and Frail instead of dying', () => {
    const b = standardBattle([['thug-or-militia']]);
    const grukk = who(b, 'Grukk');
    harm(b, grukk, grukk.hp);
    expect(grukk).toMatchObject({ status: 'stable', frail: true, hp: 0 });
    const plain = who(b, 'Snag');
    harm(b, plain, plain.hp);
    expect(plain.status).toBe('dying');
  });

  it('can’t save one already Frail', () => {
    const b = standardBattle([['thug-or-militia']]);
    const grukk = who(b, 'Grukk');
    grukk.frail = true;
    harm(b, grukk, grukk.hp);
    expect(grukk.status).toBe('dead');
  });

  it('at level 2, once, leaves 1 HP where a blow would drop them', () => {
    const grukk = starter('grukk');
    expect(pcCombatant(data, grukk).lastStand).toBe(false);
    const level2 = {
      ...grukk,
      foci: grukk.foci.map((f) => (f.id === 'die-hard' ? { ...f, level: 2 } : f)),
    };
    expect(pcCombatant(data, level2).lastStand).toBe(true);
    const b = standardBattle([['thug-or-militia']]);
    const g = who(b, 'Grukk');
    g.lastStand = true;
    harm(b, g, g.hp + 5);
    expect(g).toMatchObject({ hp: 1, status: 'active', lastStand: false, lastStandUsed: true });
    expect(b.log?.at(-1)).toContain('Grukk should be down, and stays on their feet.');
    // The second blow fells them as level 1 would: stable and Frail.
    harm(b, g, 1);
    expect(g).toMatchObject({ hp: 0, status: 'stable', frail: true });
  });
});
