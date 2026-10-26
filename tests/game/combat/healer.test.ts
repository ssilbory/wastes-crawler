import { describe, expect, it } from 'vitest';
import type { Character, CombatMagic } from '../../../src/data/schemas/index.ts';
import { characterSheet } from '../../../src/game/character/derived.ts';
import { armorFreeArts } from '../../../src/game/character/magic.ts';
import { act } from '../../../src/game/combat/actions.ts';
import { partyAction } from '../../../src/game/combat/ai.ts';
import { freeActions } from '../../../src/game/combat/free-actions.ts';
import { createBattle } from '../../../src/game/combat/battle.ts';
import { commandsFor } from '../../../src/game/combat/commands.ts';
import { harm } from '../../../src/game/combat/damage.ts';
import { save } from '../../../src/game/combat/saves.ts';
import { canUse, castMagic, combatMagic } from '../../../src/game/combat/spells.ts';
import type { Battle, CasterState, Combatant } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, starter, who } from './helpers.ts';

/** Snag, armored, as a Priest of Death of `level` with Heal-1, Int 14, and these arts. */
function priest(level = 1, arts: string[] = ['healing-touch']): Character {
  const snag = starter('snag');
  return {
    ...snag,
    classes: { current: 'healer-partial-mage', levels: { 'healer-partial-mage': level } },
    skills: { ...snag.skills, heal: 1 },
    attributes: { ...snag.attributes, base: { ...snag.attributes.base, int: 14 } },
    arts,
    spells: { known: ['smite-the-dead', 'command-the-dead'], prepared: ['smite-the-dead'] },
  };
}

function battle(c: Character, enemies: string[][] = [['thug-or-militia']], antiMagic = false) {
  return createBattle({
    data,
    rng: createRng('healer'),
    party: [
      { character: c, row: 0, column: 0 },
      { character: starter('grukk'), row: 0, column: 1 },
      { character: starter('lirael'), row: 1, column: 0 },
    ],
    enemies,
    log: true,
    antiMagic,
  });
}

const casterOf = (c: Combatant) => c.caster as CasterState;

/** Grukk at 1 of 30 hit points with no strain. */
function hurtGrukk(b: Battle): Combatant {
  const g = who(b, 'Grukk');
  Object.assign(g, { hp: 1, maxHp: 30, strain: { strain: 0, max: 10, broken: false } });
  return g;
}

describe('the Priest of Death (1.5.9, Phase 14d)', () => {
  it('works Healer arts in armor, but not spells or necromantic arts', () => {
    const c = priest(1, ['healing-touch', 'vital-furnace', 'bonetalker']);
    const sheet = characterSheet(c, data);
    expect(sheet.magic).toMatchObject({ effort: 2, canCast: false });
    expect(armorFreeArts(data, c.classes, c.arts)).toEqual(['healing-touch', 'vital-furnace']);
    expect(armorFreeArts(data, starter('fizzwick').classes, ['bonetalker'])).toEqual([]);
    expect(armorFreeArts(data, c.classes, ['no-such-art'])).toEqual([]);
    const noHealer = {
      ...data,
      content: {
        ...data.content,
        traditions: data.content.traditions.filter((t) => t.id !== 'healer'),
      },
    };
    expect(armorFreeArts(noHealer, c.classes, c.arts)).toEqual([]);
    const b = battle(c);
    const snag = who(b, 'Snag');
    expect(casterOf(snag)).toMatchObject({
      canCast: false,
      armorFree: ['healing-touch', 'vital-furnace'],
    });
    hurtGrukk(b);
    const keys = commandsFor(b, snag).map((k) => k.key);
    expect(keys).toContain('magic:healing-touch');
    expect(keys).not.toContain('magic:smite-the-dead');
    // Out of armor, the spells come back.
    casterOf(snag).canCast = true;
    expect(commandsFor(b, snag).map((k) => k.key)).toContain('magic:smite-the-dead');
  });

  it('loses even armor-free arts in an anti-magic square', () => {
    const b = battle(priest(), [['thug-or-militia']], true);
    expect(casterOf(who(b, 'Snag'))).toMatchObject({ canCast: false, armorFree: [] });
  });
});

describe('Healing Touch', () => {
  it('commits Effort once, then heals 2d6 plus Heal each use, adding 1 strain', () => {
    const b = battle(priest());
    const snag = who(b, 'Snag');
    const grukk = hurtGrukk(b);
    b.rng = scriptedRng([3, 4]);
    expect(castMagic(b, snag, 'healing-touch', grukk.id, undefined)).toBe(true);
    expect(grukk.hp).toBe(9);
    expect(grukk.strain?.strain).toBe(1);
    expect(casterOf(snag)).toMatchObject({ effortUsed: 1, effortDay: 0 });
    // Later uses this scene cost nothing, even with no Effort left.
    casterOf(snag).effortUsed = casterOf(snag).effortMax;
    b.rng = scriptedRng([1, 1]);
    expect(castMagic(b, snag, 'healing-touch', grukk.id, undefined)).toBe(true);
    expect(grukk.hp).toBe(12);
    expect(grukk.strain?.strain).toBe(2);
  });

  it('needs Effort to start, unless the Healer is Facile', () => {
    const b = battle(priest());
    const snag = who(b, 'Snag');
    const grukk = hurtGrukk(b);
    casterOf(snag).effortUsed = casterOf(snag).effortMax;
    expect(castMagic(b, snag, 'healing-touch', grukk.id, undefined)).toBe(false);
    casterOf(snag).arts.push('facile-healer');
    b.rng = scriptedRng([1, 1]);
    expect(castMagic(b, snag, 'healing-touch', grukk.id, undefined)).toBe(true);
    expect(casterOf(snag).effortUsed).toBe(casterOf(snag).effortMax);
  });

  it('reaches only the slots beside and directly ahead while the fight goes on', () => {
    const b = battle(priest());
    const snag = who(b, 'Snag');
    const grukk = hurtGrukk(b);
    const lirael = who(b, 'Lirael');
    Object.assign(lirael, { hp: 1, strain: { strain: 0, max: 10, broken: false } });
    const touch = combatMagic(b, 'healing-touch') as CombatMagic;
    const reaches = (c: Combatant, t: Combatant) => canUse(b, c, touch, false, t.id);
    // Snag in the front row reaches Grukk beside him, not Lirael behind.
    expect(reaches(snag, grukk)).toBe(true);
    expect(reaches(snag, lirael)).toBe(false);
    grukk.column = 3;
    expect(reaches(snag, grukk)).toBe(false);
    // From the rear, the slot directly ahead.
    Object.assign(snag, { row: 1, column: 1 });
    Object.assign(grukk, { row: 0, column: 1 });
    expect(reaches(snag, grukk)).toBe(true);
    expect(reaches(snag, lirael)).toBe(true);
    // Once the fight is over, the Healer can walk to anyone.
    Object.assign(snag, { row: 0, column: 3 });
    expect(reaches(snag, lirael)).toBe(false);
    b.outcome = 'party';
    expect(reaches(snag, lirael)).toBe(true);
  });

  it('reaches anyone in the party with Far Healer', () => {
    const b = battle(priest(1, ['healing-touch', 'far-healer']));
    const grukk = hurtGrukk(b);
    grukk.column = 3;
    const touch = combatMagic(b, 'healing-touch') as CombatMagic;
    expect(canUse(b, who(b, 'Snag'), touch, false, grukk.id)).toBe(true);
    b.rng = scriptedRng([1, 1]);
    expect(castMagic(b, who(b, 'Snag'), 'healing-touch', grukk.id, undefined)).toBe(true);
    expect(grukk.hp).toBe(4);
  });

  it('adds the level when Empowered, and revives the Mortally Wounded', () => {
    const b = battle(priest(3, ['healing-touch', 'empowered-healer']));
    const snag = who(b, 'Snag');
    const grukk = hurtGrukk(b);
    Object.assign(grukk, { hp: 0, status: 'dying' });
    b.rng = scriptedRng([2, 2]);
    castMagic(b, snag, 'healing-touch', grukk.id, undefined);
    expect(grukk).toMatchObject({ status: 'active', hp: 8 });
    // A target with no strain track still heals.
    grukk.strain = null;
    b.rng = scriptedRng([1, 1]);
    castMagic(b, snag, 'healing-touch', grukk.id, undefined);
    expect(grukk.hp).toBe(14);
    // Without a target nothing happens; without Heal, the dice alone heal.
    expect(castMagic(b, snag, 'healing-touch', undefined, undefined)).toBe(true);
    delete snag.skills.heal;
    b.rng = scriptedRng([1, 1]);
    castMagic(b, snag, 'healing-touch', grukk.id, undefined);
    expect(grukk.hp).toBe(19);
  });

  it('is the party AI’s cure for the dying and the badly hurt', () => {
    const b = battle(priest());
    const snag = who(b, 'Snag');
    const grukk = hurtGrukk(b);
    expect(partyAction(b, snag)).toEqual({
      kind: 'cast',
      magic: 'healing-touch',
      target: grukk.id,
    });
    Object.assign(grukk, { hp: 0, status: 'dying', fellRound: 1 });
    expect(partyAction(b, snag)).toEqual({
      kind: 'cast',
      magic: 'healing-touch',
      target: grukk.id,
    });
    // Without Effort it falls back to stabilizing or fighting.
    casterOf(snag).effortUsed = casterOf(snag).effortMax;
    expect(partyAction(b, snag).kind).not.toBe('cast');
  });

  it('comes On Turn with Swift Healer, the level in times a rest', () => {
    const b = battle(priest(2, ['healing-touch', 'swift-healer']));
    const snag = who(b, 'Snag');
    expect(casterOf(snag).uses).toEqual({});
    const grukk = hurtGrukk(b);
    b.rng = scriptedRng([1, 1, 1, 1]);
    freeActions(b, snag);
    expect(grukk.hp).toBe(4);
    freeActions(b, snag);
    expect(grukk.hp).toBe(7);
    expect(casterOf(snag).uses).toEqual({ 'swift-healer': 2 });
    freeActions(b, snag);
    expect(grukk.hp).toBe(7);
    // No one hurt enough: nothing happens.
    const c = battle(priest(2, ['healing-touch', 'swift-healer']));
    freeActions(c, who(c, 'Snag'));
    expect(casterOf(who(c, 'Snag')).uses).toEqual({});
    // Without Swift Healer there is no On Turn touch.
    const d = battle(priest());
    hurtGrukk(d);
    freeActions(d, who(d, 'Snag'));
    expect(who(d, 'Grukk').hp).toBe(1);
  });
});

describe('Final Repose', () => {
  it('gives a living foe the Heal skill as a Physical save penalty for the scene', () => {
    const b = battle(priest(1, ['healing-touch', 'final-repose']), [['thug-or-militia', 'zombie']]);
    const snag = who(b, 'Snag');
    const [thug, zombie] = [who(b, 'foe-0-0'), who(b, 'foe-0-1')];
    act(b, snag, { kind: 'cast', magic: 'final-repose', target: thug.id });
    expect(thug.reposePenalty).toBe(1);
    expect(casterOf(snag).effortDay).toBe(1);
    // Once per target per scene.
    expect(castMagic(b, snag, 'final-repose', thug.id, undefined)).toBe(false);
    castMagic(b, snag, 'final-repose', zombie.id, undefined);
    expect(zombie.reposePenalty).toBe(0);
    // Without Heal the penalty is nothing; without a target, nothing happens.
    const other = battle(priest(1, ['healing-touch', 'final-repose']), [['thug-or-militia']]);
    const s2 = who(other, 'Snag');
    delete s2.skills.heal;
    castMagic(other, s2, 'final-repose', 'foe-0-0', undefined);
    expect(who(other, 'foe-0-0').reposePenalty).toBe(0);
    expect(castMagic(other, s2, 'final-repose', undefined, undefined)).toBe(true);
    // The penalty bites Physical saves only.
    thug.saves.physical = 15;
    b.rng = scriptedRng([15]);
    expect(save(b, thug, 'physical').success).toBe(false);
    b.rng = scriptedRng([15]);
    thug.saves.evasion = 15;
    expect(save(b, thug, 'evasion').success).toBe(true);
  });
});

describe('Vital Furnace', () => {
  function furnace(): { b: Battle; snag: Combatant } {
    const b = battle(priest(1, ['healing-touch', 'vital-furnace']));
    const snag = who(b, 'Snag');
    Object.assign(snag, { hp: 20, maxHp: 20 });
    return { b, snag };
  }

  it('spends day Effort to negate a heavy blow that leaves the Healer standing', () => {
    const { b, snag } = furnace();
    harm(b, snag, 5);
    expect(snag.hp).toBe(20);
    expect(casterOf(snag)).toMatchObject({ effortUsed: 1, effortDay: 1 });
    // A light blow is taken.
    harm(b, snag, 4);
    expect(snag.hp).toBe(16);
    // So is any blow once the Effort is gone.
    casterOf(snag).effortUsed = casterOf(snag).effortMax;
    harm(b, snag, 6);
    expect(snag.hp).toBe(10);
  });

  it('stabilizes the Healer at zero, unless Frail', () => {
    const { b, snag } = furnace();
    harm(b, snag, 20);
    expect(snag.status).toBe('stable');
    const other = furnace();
    other.snag.frail = true;
    harm(other.b, other.snag, 20);
    expect(other.snag.status).toBe('dead');
  });

  it('needs the art and, for a caster in armor, armor-free arts', () => {
    const { b, snag } = furnace();
    casterOf(snag).armorFree = [];
    harm(b, snag, 20);
    expect(snag.status).toBe('dying');
    const grukk = who(b, 'Grukk');
    grukk.selfStabilize = false; // Without Die Hard, to fall as anyone does.
    grukk.hp = 1;
    harm(b, grukk, 1);
    expect(grukk.status).toBe('dying');
  });
});
