import { describe, expect, it } from 'vitest';
import type { Character } from '../../../src/data/schemas/index.ts';
import { resolveAttack } from '../../../src/game/combat/attack.ts';
import { turnArts } from '../../../src/game/combat/arts.ts';
import { createBattle } from '../../../src/game/combat/battle.ts';
import { effectiveAc, harm } from '../../../src/game/combat/damage.ts';
import { keepsDying, negatesUndead, redHarvest } from '../../../src/game/combat/reactions.ts';
import { afterHit, breathe } from '../../../src/game/combat/specials.ts';
import { castMagic } from '../../../src/game/combat/spells.ts';
import type { Attack, Battle, CasterState, Combatant } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, starter, who } from './helpers.ts';

/** Fizzwick as a Necromancer of `level` with these arts. */
function necro(arts: string[], level = 3): Character {
  const fizz = starter('fizzwick');
  return {
    ...fizz,
    classes: { current: 'full-necromancer', levels: { 'full-necromancer': level } },
    arts,
    skills: { ...fizz.skills, magic: 1 },
    spells: { known: ['smite-the-dead'], prepared: ['smite-the-dead'] },
  };
}

function battle(c: Character, enemies: string[][] = [['zombie']]): Battle {
  return createBattle({
    data,
    rng: createRng('necro'),
    party: [
      { character: starter('snag'), row: 0, column: 0 },
      { character: starter('grukk'), row: 0, column: 1 },
      { character: c, row: 1, column: 0 },
    ],
    enemies,
    log: true,
  });
}

const casterOf = (c: Combatant) => c.caster as CasterState;
const fizz = (b: Battle) => who(b, 'Fizzwick');

describe('Cold Flesh and Unaging (1.5.14)', () => {
  it('gives a natural AC of 12 plus half the level, caps Shock at 2, and wards off poison', () => {
    const b = battle(necro(['cold-flesh', 'unaging'], 4), [['giant-black-widow']]);
    const f = fizz(b);
    expect(effectiveAc(f)).toBe(14);
    expect(f.shockCap).toBe(2);
    f.hp = 20;
    f.maxHp = 20;
    // A miss with 4 Shock deals only 2.
    const thug: Attack = {
      ...(who(b, 'Snag').attacks[0] as Attack),
      shock: { damage: 4, maxAc: null },
    };
    b.rng = scriptedRng([1]);
    f.row = 0;
    resolveAttack(b, who(b, 'foe-0-0'), thug, f);
    expect(f.hp).toBe(18);
    // The spider's poison does nothing.
    afterHit(b, who(b, 'foe-0-0').attacks[0] as Attack, f);
    expect(f.hp).toBe(18);
    expect(who(b, 'Snag').shockCap).toBeNull();
  });
});

describe('Master of Bones', () => {
  it('turns aside an undead attack or breath for scene Effort, within twice the level', () => {
    const b = battle(necro(['master-of-bones'], 1), [['zombie', 'grave-wyrm']]);
    const [f, zombie, wyrm] = [fizz(b), who(b, 'foe-0-0'), who(b, 'foe-0-1')];
    f.hp = 20;
    // The zombie (2 HD) is within twice level 1.
    expect(negatesUndead(b, zombie, f)).toBe(true);
    expect(casterOf(f)).toMatchObject({ effortUsed: 1, effortDay: 0 });
    // A hit is wholly negated.
    casterOf(f).effortUsed = 0;
    f.row = 0;
    b.rng = scriptedRng([20]);
    resolveAttack(b, zombie, zombie.attacks[0] as Attack, f);
    expect(f.hp).toBe(20);
    // The grave wyrm is too strong, and the living never are turned aside.
    casterOf(f).effortUsed = 0;
    expect(negatesUndead(b, wyrm, f)).toBe(false);
    expect(negatesUndead(b, who(b, 'Snag'), f)).toBe(false);
    // An undead's breath on the Necromancer's row passes them by.
    f.caster = { ...casterOf(f), level: 6 };
    b.rng = createRng('breath');
    breathe(b, wyrm, 0);
    expect(f.hp).toBe(20);
  });

  it('makes the undead save twice against the Necromancer’s spells', () => {
    const b = battle(necro(['master-of-bones'], 2));
    const zombie = who(b, 'foe-0-0');
    zombie.hp = 50;
    // The zombie saves (20), then fails the second roll (1) and is destroyed.
    b.rng = scriptedRng([20, 1]);
    castMagic(b, fizz(b), 'smite-the-dead', undefined, 0);
    expect(zombie.status).toBe('dead');
  });
});

describe('Red Harvest', () => {
  it('heals the hurt or readies +4, once a round, from intelligent deaths', () => {
    const b = battle(necro(['red-harvest']), [['thug-or-militia', 'thug-or-militia', 'zombie']]);
    const f = fizz(b);
    Object.assign(f, { hp: 2, maxHp: 20 });
    b.rng = scriptedRng([4]);
    harm(b, who(b, 'foe-0-0'), 100);
    expect(f.hp).toBe(9);
    expect(casterOf(f).effortDay).toBe(1);
    // Once a round.
    harm(b, who(b, 'foe-0-1'), 100);
    expect(casterOf(f).effortDay).toBe(1);
    // Healthy, the next hit roll gains +4, spent on the next attack.
    b.round = 2;
    f.hp = 20;
    redHarvest(b, who(b, 'foe-0-1'));
    expect(f.nextHitBonus).toBe(4);
    b.rng = createRng('swing');
    resolveAttack(b, f, f.attacks[0] as Attack, who(b, 'foe-0-2'));
    expect(f.nextHitBonus).toBe(0);
    // The mindless dead feed nothing.
    b.round = 3;
    redHarvest(b, who(b, 'foe-0-2'));
    expect(casterOf(f).effortDay).toBe(2);
    // A PC slain while dying feeds it too.
    const c = battle(necro(['red-harvest']));
    who(c, 'Snag').status = 'dying';
    harm(c, who(c, 'Snag'), 1);
    expect(fizz(c).nextHitBonus).toBe(4);
  });
});

describe('Unliving Persistence and Keeper of the Gate', () => {
  it('stabilizes the Necromancer at zero for day Effort', () => {
    const b = battle(necro(['unliving-persistence']));
    const f = fizz(b);
    harm(b, f, 100);
    expect(f.status).toBe('stable');
    expect(casterOf(f).effortDay).toBe(1);
    // Without Effort they lie dying.
    casterOf(f).effortUsed = casterOf(f).effortMax;
    expect(keepsDying(b, f)).toBe(false);
  });

  it('keeps any ally who falls from dying, while the Necromancer stands', () => {
    const b = battle(necro(['unliving-persistence']));
    const grukk = who(b, 'Grukk');
    grukk.column = 3;
    harm(b, grukk, 100);
    expect(grukk.status).toBe('stable');
    expect(b.log?.at(-1)).toContain('Grukk falls, but Fizzwick will not let them die.');
    expect(casterOf(fizz(b)).effortDay).toBe(1);
    // A fallen Necromancer can't hold anyone else.
    const c = battle(necro(['unliving-persistence']));
    fizz(c).status = 'dying';
    harm(c, who(c, 'Snag'), 100);
    expect(who(c, 'Snag').status).toBe('dying');
  });

  it('stabilizes a dying ally anywhere On Turn, or every dying ally with Keeper', () => {
    const b = battle(necro(['unliving-persistence']));
    const [snag, grukk] = [who(b, 'Snag'), who(b, 'Grukk')];
    grukk.column = 3;
    snag.status = 'dying';
    grukk.status = 'dying';
    turnArts(b, fizz(b));
    // One a turn, the first to fall.
    expect(who(b, 'Snag').status).toBe('stable');
    expect(who(b, 'Grukk').status).toBe('dying');
    turnArts(b, fizz(b));
    expect(who(b, 'Grukk').status).toBe('stable');
    const k = battle(necro(['keeper-of-the-gate']));
    for (const id of ['Snag', 'Grukk']) {
      const x = who(k, id);
      x.status = 'dying';
      x.strain = { strain: 0, max: 10, broken: false };
    }
    who(k, 'Grukk').strain = null;
    turnArts(k, fizz(k));
    expect(who(k, 'Snag')).toMatchObject({ status: 'stable', strain: { strain: 1 } });
    expect(who(k, 'Grukk').status).toBe('stable');
    expect(casterOf(fizz(k)).effortDay).toBe(1);
  });
});
