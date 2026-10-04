import { describe, expect, it } from 'vitest';
import { partyAction } from '../../../src/game/combat/ai.ts';
import { resolveAttack } from '../../../src/game/combat/attack.ts';
import { act, createBattle, runBattle, runRound } from '../../../src/game/combat/battle.ts';
import { pcCombatant } from '../../../src/game/combat/combatants.ts';
import { canUse, castMagic, combatMagic } from '../../../src/game/combat/spells.ts';
import { covered, inMelee } from '../../../src/game/combat/targeting.ts';
import type { Attack, Battle, CasterState, Controller } from '../../../src/game/combat/types.ts';
import type { CombatMagic } from '../../../src/data/schemas/index.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, standardBattle, starter, who } from './helpers.ts';

const wait: Controller = () => ({ kind: 'wait' });
const enemies = (b: Battle) => b.combatants.filter((c) => c.side === 'enemy');

describe('party auto-combat edge cases', () => {
  it('aims Coffin at the toughest foe when no row is crowded enough to sleep', () => {
    const b = standardBattle([['thug-or-militia'], ['thug-or-militia'], ['thug-or-militia']]);
    [5, 10, 3].forEach((hp, i) => (who(b, `foe-${i}-0`).hp = hp));
    expect(partyAction(b, who(b, 'Fizzwick'))).toMatchObject({
      magic: 'the-coruscating-coffin',
      target: 'foe-1-0',
    });
  });

  it('skips magic with no active foes, and attacks a sleeper', () => {
    const b = standardBattle([['thug-or-militia']]);
    for (const e of enemies(b)) e.status = 'asleep';
    expect(partyAction(b, who(b, 'Fizzwick'))).toEqual({
      kind: 'attack',
      attack: 2,
      target: 'foe-0-0',
    });
  });

  it('tends the earliest fallen first, and the dying when it has no attack to make', () => {
    const b = standardBattle([['thug-or-militia']]);
    const [snag, grukk] = [who(b, 'Snag'), who(b, 'Grukk')];
    snag.status = 'dying';
    snag.fellRound = 2;
    grukk.status = 'dying';
    grukk.fellRound = 1;
    expect(partyAction(b, who(b, 'Lirael'))).toEqual({ kind: 'stabilize', target: grukk.id });
    grukk.status = 'active';
    grukk.attacks = [];
    expect(partyAction(b, grukk)).toEqual({ kind: 'stabilize', target: snag.id });
  });
});

describe('battle loop edge cases', () => {
  it('lets a character without Heal try to stabilize', () => {
    const b = standardBattle([['thug-or-militia']]);
    const lirael = who(b, 'Lirael');
    lirael.status = 'dying';
    lirael.fellRound = 1;
    b.rng = scriptedRng([6, 6]);
    act(b, who(b, 'Snag'), { kind: 'stabilize', target: lirael.id });
    expect(lirael.status).toBe('stable');
  });

  it('breaks promotion ties at random', () => {
    const party = (['snag', 'grukk', 'lirael', 'fizzwick'] as const).map((f, i) => ({
      character: starter(f),
      row: i < 1 ? 0 : 1,
      column: i < 1 ? 0 : i - 1,
    }));
    party.push({ character: starter('snag'), row: 1, column: 3 });
    const b = createBattle({ data, rng: createRng('tie'), party, enemies: [['thug-or-militia']] });
    for (const c of b.combatants) c.hp = 10;
    const front = who(b, 'pc-0');
    front.status = 'dying';
    front.fellRound = 1;
    // Four tied rear characters: the tie roll picks index 2, Fizzwick; then the thug's Instinct.
    b.rng = scriptedRng([2, 10]);
    runRound(b, wait, wait);
    expect(b.combatants.find((c) => c.side === 'party' && c.row === 0)?.name).toBe('Fizzwick');
  });

  it('lets the dying die after a win with no one left to tend them', () => {
    const b = standardBattle([['thug-or-militia']]);
    for (const e of enemies(b)) e.status = 'fled';
    for (const pc of b.combatants.filter((c) => c.side === 'party')) pc.status = 'dead';
    const snag = who(b, 'Snag');
    snag.status = 'dying';
    snag.fellRound = 1;
    expect(runBattle(b, wait, wait)).toMatchObject({ outcome: 'party', deaths: 4 });
  });
});

describe('targeting, attacks, and casters without Magic', () => {
  it('denies flyers cover and finds the enemy front in melee', () => {
    const b = standardBattle([['thug-or-militia'], ['thug-or-militia']]);
    const back = who(b, 'foe-1-0');
    back.tags.add('flying');
    expect(covered(b, back)).toBe(false);
    expect(inMelee(b, who(b, 'foe-0-0'))).toBe(true);
  });

  it('gives natural weapons no reach', () => {
    const snag = starter('snag');
    const c = pcCombatant(data, { ...snag, foci: [...snag.foci, { id: 'horned', level: 1 }] });
    expect(c.attacks.find((x) => x.name === 'Horns')).toMatchObject({ reach: false });
  });

  it('rolls damage on a thrown hit', () => {
    const b = standardBattle([['thug-or-militia']]);
    const thug = who(b, 'foe-0-0');
    thug.hp = 20;
    b.rng = scriptedRng([19, 3]);
    const snag = who(b, 'Snag');
    resolveAttack(b, snag, snag.attacks[1] as Attack, thug);
    expect(thug.hp).toBeLessThan(20);
  });

  it('treats a missing Magic skill as level-0 for arts and as no penalty for Shackles', () => {
    const fizz = starter('fizzwick');
    const skills = { ...fizz.skills };
    delete skills.magic;
    const c = pcCombatant(data, { ...fizz, skills }, 'pc-9');
    expect(c.caster?.magicSkill).toBe(0);
    const b = standardBattle([['skilled-veteran']]);
    const mage = who(b, 'Fizzwick');
    delete mage.skills.magic;
    const caster = mage.caster as CasterState;
    caster.arts.push('elemental-blast');
    caster.prepared.push('ineluctable-shackles-of-volition');
    b.rng = scriptedRng([2, 1, 1, 20]);
    expect(castMagic(b, mage, 'elemental-blast', 'foe-0-0', undefined)).toBe(true);
    expect(castMagic(b, mage, 'ineluctable-shackles-of-volition', 'foe-0-0', undefined)).toBe(true);
  });
});

describe('magic data fallbacks', () => {
  it('blocks once-a-scene magic after use, and names unknown spells by id at level 1', () => {
    const b = standardBattle([['skilled-veteran']]);
    const fizz = who(b, 'Fizzwick');
    const caster = fizz.caster as CasterState;
    const inexorable = combatMagic(b, 'inexorable-effect') as CombatMagic;
    caster.arts.push('inexorable-effect');
    caster.usedThisScene.add('inexorable-effect');
    expect(canUse(b, fizz, inexorable)).toBe(false);
    const bolt: CombatMagic = {
      ...(combatMagic(b, 'the-coruscating-coffin') as CombatMagic),
      id: 'test-bolt',
    };
    b.data = { ...data, content: { ...data.content, combatMagic: [bolt] } };
    b.log = [];
    caster.prepared.push('test-bolt');
    b.rng = scriptedRng([8, 20]);
    expect(castMagic(b, fizz, 'test-bolt', 'foe-0-0', undefined)).toBe(true);
    expect(b.log.join('\n')).toContain('test-bolt');
    caster.known.push('test-bolt');
    expect(canUse(b, fizz, bolt, true)).toBe(true);
  });
});
