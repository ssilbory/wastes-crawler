import { describe, expect, it } from 'vitest';
import { magicAction, monsterAction } from '../../../src/game/combat/ai.ts';
import { resolveAttack } from '../../../src/game/combat/attack.ts';
import { harm } from '../../../src/game/combat/damage.ts';
import { freeActions } from '../../../src/game/combat/free-actions.ts';
import { endOfRound, takeTurn } from '../../../src/game/combat/round.ts';
import { canUse, castMagic, combatMagic } from '../../../src/game/combat/spells.ts';
import type { Attack, Battle, CasterState, Combatant } from '../../../src/game/combat/types.ts';
import type { CombatMagic } from '../../../src/data/schemas/index.ts';
import { conditions, outcomeText } from '../../../src/render/arena-view.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { standardBattle, who } from './helpers.ts';

/** Fizzwick as a caster with these arts and spells, Effort and spells to spare. */
function caster(b: Battle, arts: string[], spells: string[] = []): Combatant {
  const f = who(b, 'Fizzwick');
  Object.assign(f.caster as CasterState, {
    level: 5,
    arts,
    known: spells,
    prepared: spells,
    spellsLeft: 9,
    canCast: true,
    effortMax: 5,
    effortUsed: 0,
  });
  return f;
}

const swing = (c: Combatant) => c.attacks[0] as Attack;

describe('the combat review fixes', () => {
  it('refuses healing the target can’t bear, and kills the Broken it pushes too far', () => {
    const b = standardBattle([['thug-or-militia']]);
    b.rng = createRng('heal');
    const f = caster(b, ['healing-touch']);
    const grukk = who(b, 'Grukk');
    const touch = combatMagic(b, 'healing-touch') as CombatMagic;
    Object.assign(grukk, { hp: 1, strain: { strain: 12, max: 12, broken: false } });
    expect(canUse(b, f, touch, false, grukk.id)).toBe(false);
    castMagic(b, f, 'healing-touch', grukk.id, undefined);
    expect(grukk.hp).toBe(1);
    // Broken and one short of twice the maximum, the strain kills.
    Object.assign(grukk, { strain: { strain: 23, max: 12, broken: true } });
    castMagic(b, f, 'healing-touch', grukk.id, undefined);
    expect(grukk.status).toBe('dead');
    expect(b.log?.join('\n')).toContain('gives out under the strain');
  });

  it('Keeper of the Gate stabilizes only who can bear it, leaving them Frail', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = caster(b, ['keeper-of-the-gate']);
    const [snag, grukk] = [who(b, 'Snag'), who(b, 'Grukk')];
    Object.assign(snag, { status: 'dying', hp: 0, fellRound: 1 });
    Object.assign(grukk, {
      status: 'dying',
      hp: 0,
      fellRound: 1,
      strain: { strain: 23, max: 12, broken: true },
    });
    freeActions(b, f);
    expect([snag.status, snag.frail]).toEqual(['stable', true]);
    expect(grukk.status).toBe('dead');
  });

  it('keeps the misted from free actions, and holds a paralyzed front-liner in place', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = caster(b, ['pavis-of-elements']);
    f.misted = true;
    takeTurn(b, f, () => ({ kind: 'end-mist' }));
    expect(f.acBonus).toBe(0);
    const snag = who(b, 'Snag');
    snag.heldRounds = 3;
    endOfRound(b);
    expect([snag.row, snag.column]).toEqual([0, 0]);
  });

  it('casts past noncombatants and the frozen while others stand', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia', 'thug-or-militia']]);
    const f = caster(b, [], ['the-coruscating-coffin']);
    const [a, c, d] = b.combatants.filter((x) => x.side === 'enemy') as [
      Combatant,
      Combatant,
      Combatant,
    ];
    Object.assign(a, { noncombatant: true, hp: 99 });
    Object.assign(c, { amber: true, hp: 98 });
    expect(magicAction(b, f)).toMatchObject({ target: d.id });
  });

  it('settles the fight when a struggle kills the last foe, and spares walls struck from within', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia']]);
    const [a, c] = b.combatants.filter((x) => x.side === 'enemy') as [Combatant, Combatant];
    b.walls = [
      { side: 'enemy', damage: { count: 3, sides: 6, modifier: 0 }, bonus: 3, crossed: [] },
    ];
    Object.assign(c, { hp: 50, maxHp: 50, ac: 1 });
    b.rng = createRng('mad');
    resolveAttack(b, a, swing(a), c);
    expect(a.hp).toBe(a.maxHp);
    c.status = 'dead';
    Object.assign(a, { hp: 1, compelled: 5 });
    b.rng = createRng('struggle');
    takeTurn(b, a, monsterAction);
    // The struggle kills it before it can act, and the fight is the party's at once.
    expect([a.status, b.outcome]).toEqual(['dead', 'party']);
  });

  it('leaves those who stabilize on their own Frail, and lets a merged pair fall through Forgetting the Grave', () => {
    const b = standardBattle([['thug-or-militia']]);
    const [snag, grukk] = [who(b, 'Snag'), who(b, 'Grukk')];
    snag.stone = 2;
    harm(b, snag, 999);
    expect([snag.status, snag.frail]).toEqual(['stable', true]);
    const c = standardBattle([['thug-or-militia']]);
    const [s2, g2] = [who(c, 'Snag'), who(c, 'Grukk')];
    Object.assign(s2, { mergedWith: g2.id, deathlessUntil: 99 });
    g2.mergedWith = s2.id;
    harm(c, s2, 999);
    expect([s2.status, s2.hp]).toEqual(['active', 0]);
    expect(g2.status).toBe('dying');
    expect(grukk.status).toBe('active');
  });

  it('names the conditions on a slot and the Citadel’s escape', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = Object.assign(who(b, 'Snag'), {
      heldRounds: 1,
      rootedRounds: 1,
      misted: true,
      sanctified: true,
      berserk: true,
      compelled: 2,
      mergedWith: 'pc-1',
    });
    expect(conditions(snag)).toEqual(
      expect.arrayContaining([
        'paralyzed',
        'rooted',
        'mist',
        'sanctified',
        'mad',
        'compelled',
        'merged',
      ]),
    );
    b.escaped = true;
    expect(outcomeText(b, 'draw')).toBe('The party escapes behind the Invincible Citadel.');
  });
});
