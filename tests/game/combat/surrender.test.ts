import { describe, expect, it } from 'vitest';
import {
  checkMorale,
  exertTotal,
  fighters,
  markBoss,
  moraleBonus,
} from '../../../src/game/combat/morale.ts';
import type { Battle, Combatant } from '../../../src/game/combat/types.ts';
import { createBattle } from '../../../src/game/combat/battle.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, standardBattle, who } from './helpers.ts';

// docs/rules-adaptation.md, Morale, escape, and surrender in Phase 19.
const foes = (b: Battle) => b.combatants.filter((c) => c.side === 'enemy');
const thugs = (n: number) => Array<string>(n).fill('thug-or-militia');
/** The party's best Exert total, which the pursuers roll with. */
const partyExert = (b: Battle) => Math.max(...fighters(b, 'party').map(exertTotal));

describe('a row that breaks', () => {
  it('surrenders outright to a party that outnumbers its side', () => {
    const b = standardBattle([thugs(2)]);
    const [t1, t2] = foes(b) as [Combatant, Combatant];
    t1.status = 'dead';
    b.rng = scriptedRng([6, 6]);
    checkMorale(b);
    expect(t2).toMatchObject({ status: 'fled', surrendered: true });
    expect(b.log?.join(' ')).toContain('surrender');
  });

  it('tries to escape when it is not outnumbered or outrun, and gets away on a tie', () => {
    const b = standardBattle([thugs(5)]);
    const [t1, ...rest] = foes(b) as Combatant[];
    (t1 as Combatant).status = 'dead';
    // Morale 6 + 6 fails. Four thugs against four PCs, all at 30 feet: they run. They roll
    // 2d6 + 1; the party matches them exactly with its Exert and the +2 for no head start.
    const flee = 6 + 6 + 1;
    const pursue = flee - partyExert(b) - 2;
    const a = Math.min(6, pursue - 1);
    b.rng = scriptedRng([6, 6, 6, 6, a, pursue - a]);
    checkMorale(b);
    expect(rest.map((c) => [c.status, c.surrendered])).toEqual(Array(4).fill(['fled', false]));
  });

  it('surrenders when run down', () => {
    const b = standardBattle([thugs(5)]);
    const [t1, ...rest] = foes(b) as Combatant[];
    (t1 as Combatant).status = 'dead';
    b.rng = scriptedRng([6, 6, 1, 1, 6, 6]);
    checkMorale(b);
    expect(rest.every((c) => c.status === 'fled' && c.surrendered)).toBe(true);
  });

  it('leaves caught beasts cornered unless someone can talk to them', () => {
    const b = standardBattle([['small-pack-predator', 'small-pack-predator']]);
    const [w1, w2] = foes(b) as [Combatant, Combatant];
    w1.status = 'dead';
    // Caught, it fights on; half its side is down, so it checks again and holds (1 + 1, then
    // Instinct 10).
    b.rng = scriptedRng([6, 6, 1, 1, 6, 6, 1, 1, 10]);
    checkMorale(b);
    expect(w2).toMatchObject({ status: 'active', surrendered: false });
    expect(b.log?.join(' ')).toContain('cornered');

    const c = standardBattle([['small-pack-predator', 'small-pack-predator']]);
    c.talksToBeasts.party = true;
    const [x1, x2] = foes(c) as [Combatant, Combatant];
    x1.status = 'dead';
    c.rng = scriptedRng([6, 6]);
    checkMorale(c);
    expect(x2).toMatchObject({ status: 'fled', surrendered: true });
  });

  it('never lets the mindless surrender', () => {
    const b = standardBattle([['zombie', 'zombie']]);
    const [z1, z2] = foes(b) as [Combatant, Combatant];
    z2.morale = 2;
    z1.status = 'dead';
    b.rng = scriptedRng([6, 6, 1, 1, 6, 6, 1, 1, 10]);
    checkMorale(b);
    expect(z2.status).toBe('active');
  });

  it('surrenders to pursuers who are faster', () => {
    const b = standardBattle([thugs(5)]);
    for (const c of fighters(b, 'party')) c.move = 40;
    const [t1, ...rest] = foes(b) as Combatant[];
    (t1 as Combatant).status = 'dead';
    b.rng = scriptedRng([6, 6]);
    checkMorale(b);
    expect(rest.every((c) => c.surrendered)).toBe(true);
  });

  it('lets a lone runner on a monster side get away in a monster fight', () => {
    const b = createBattle({
      data,
      rng: scriptedRng(Array(20).fill(1)),
      party: [],
      allies: [['small-pack-predator', 'small-pack-predator']],
      enemies: [['thug-or-militia']],
    });
    const [w1, w2] = b.combatants.filter((c) => c.side === 'party') as [Combatant, Combatant];
    w1.status = 'dead';
    // Morale fails; one beast against one thug, who is slower: it runs, 6 + 6 + 1 against 1 + 1.
    b.rng = scriptedRng([6, 6, 6, 6, 1, 1]);
    checkMorale(b);
    expect(w2).toMatchObject({ status: 'fled', surrendered: false });
  });

  it("counts a character's Exert with the better of Dex and Con, and a monster's skill", () => {
    const b = standardBattle([thugs(1)]);
    const snag = who(b, 'Snag');
    snag.skills = { ...snag.skills, exert: 1 };
    snag.modifiers = { ...snag.modifiers, dex: 2, con: -1 };
    expect(exertTotal(snag)).toBe(3);
    snag.skills = {};
    expect(exertTotal(snag)).toBe(1);
    expect(exertTotal(foes(b)[0] as Combatant)).toBe(1);
  });
});

describe('bosses and their minions', () => {
  it('makes the foe with the most hit dice the boss, the first on a tie', () => {
    const b = standardBattle([thugs(2), ['gnoll']]);
    markBoss(b);
    expect(b.boss).toBe(who(b, 'Gnoll').id);
    const c = standardBattle([['thug-or-militia', 'veteran-soldier']]);
    markBoss(c);
    expect(c.boss).toBe(foes(c)[0]?.id);
  });

  it('has no boss with no foes', () => {
    const b = standardBattle([]);
    markBoss(b);
    expect(b.boss).toBeNull();
  });

  it('lends its side +2 Morale while it stands, and nothing once it falls', () => {
    const b = standardBattle([thugs(4), ['gnoll']]);
    markBoss(b);
    const [t1, t2, t3, t4, gnoll] = foes(b) as Combatant[];
    expect(moraleBonus(b, t2 as Combatant)).toBe(2);
    expect(moraleBonus(b, gnoll as Combatant)).toBe(0);
    (t1 as Combatant).status = 'dead';
    // 5 + 5 holds at Morale 8 + 2; each thug then rolls Instinct (10: no).
    b.rng = scriptedRng([5, 5, 10, 10, 10]);
    checkMorale(b);
    expect([t2, t3, t4].every((t) => t?.status === 'active')).toBe(true);
    // The boss's fall is no Morale check of its own (Sam's call: boss fights should be hard), but
    // its side stands no firmer for it.
    (gnoll as Combatant).status = 'dead';
    b.rng = scriptedRng([]);
    checkMorale(b);
    expect(t2?.status).toBe('active');
    expect(moraleBonus(b, t2 as Combatant)).toBe(0);
  });

  it('never checks Morale itself', () => {
    const b = standardBattle([['gnoll', 'thug-or-militia', 'thug-or-militia']]);
    markBoss(b);
    const [gnoll, t1, t2] = foes(b) as [Combatant, Combatant, Combatant];
    t1.status = 'dead';
    // Half the side is down after the row's check too; each roll fails, and the thug yields.
    b.rng = scriptedRng([6, 6]);
    checkMorale(b);
    expect(gnoll.status).toBe('active');
    expect(t2.surrendered).toBe(true);
  });
});
