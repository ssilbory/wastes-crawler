import { describe, expect, it } from 'vitest';
import { concludeBattle, createBattle } from '../../../src/game/combat/battle.ts';
import { resolveAttack } from '../../../src/game/combat/attack.ts';
import { act } from '../../../src/game/combat/actions.ts';
import { monsterAction } from '../../../src/game/combat/ai.ts';
import { commandsFor } from '../../../src/game/combat/commands.ts';
import { subdue } from '../../../src/game/combat/conditions.ts';
import { harm } from '../../../src/game/combat/damage.ts';
import { endOfRound, takeTurn } from '../../../src/game/combat/round.ts';
import { canUse, castMagic, combatMagic } from '../../../src/game/combat/spells.ts';
import type { Battle, CasterState, Combatant } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, standardBattle, starter, who } from './helpers.ts';

/** Fizzwick as a High Mage of `level` with these spells prepared, slots to spare, and no arts. */
function mage(b: Battle, spells: string[], level: number): Combatant {
  const f = who(b, 'Fizzwick');
  Object.assign(f.caster as CasterState, {
    level,
    known: spells,
    prepared: spells,
    spellsLeft: 9,
    canCast: true,
    arts: [],
  });
  return f;
}

const cast = (b: Battle, f: Combatant, id: string, where: { target?: string; row?: number } = {}) =>
  castMagic(b, f, id, where.target, where.row);

/** Every foe given plenty of hit points, so damage can be read off. */
function sturdy(b: Battle, hp = 40): Combatant[] {
  const foes = b.combatants.filter((c) => c.side === 'enemy');
  for (const c of foes) Object.assign(c, { hp, maxHp: hp });
  return foes;
}

const log = (b: Battle) => (b.log ?? []).join('\n');

describe('High Magic damage on a row (Phase 18a, 4.4.0)', () => {
  it('Howl of Light: one roll of 1d8 a level, an Evasion save for half', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia'], ['thug-or-militia']]);
    const [a, c, rear] = sturdy(b) as [Combatant, Combatant, Combatant];
    const f = mage(b, ['the-howl-of-light'], 3);
    b.rng = scriptedRng([8, 8, 8, 1, 20]);
    expect(cast(b, f, 'the-howl-of-light', { row: 0 })).toBe(true);
    expect([a.hp, c.hp, rear.hp]).toEqual([16, 28, 40]);
  });

  it('Congealing Cold: 1d6 per two levels, and the failed are numbed for 1d4 rounds', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia']]);
    const [a, c] = sturdy(b) as [Combatant, Combatant];
    const f = mage(b, ['exhalation-of-congelating-cold'], 4);
    b.rng = scriptedRng([3, 3, 1, 3, 20]);
    cast(b, f, 'exhalation-of-congelating-cold', { row: 0 });
    expect([a.hp, a.rootedRounds, c.hp, c.rootedRounds]).toEqual([34, 3, 37, 0]);
    expect(log(b)).toContain('numbed by the cold');
  });

  it('Ligneous Dissolution: only plants are hurt, at 1d10 a level', () => {
    const b = standardBattle([['mushroom-sporeling', 'thug-or-militia']]);
    const [shroom, thug] = sturdy(b) as [Combatant, Combatant];
    const f = mage(b, ['decree-of-ligneous-dissolution'], 1);
    b.rng = scriptedRng([10, 1]);
    cast(b, f, 'decree-of-ligneous-dissolution', { row: 0 });
    expect([shroom.hp, thug.hp]).toEqual([30, 40]);
  });

  it('Deluge of Hell: outdoors only, slays the weak, and lashes back at a caster who fails', () => {
    const b = standardBattle([['thug-or-militia', 'large-solitary-predator']]);
    const [thug, beast] = sturdy(b, 100) as [Combatant, Combatant];
    const f = mage(b, ['deluge-of-hell'], 5);
    f.hp = 50;
    const deluge = combatMagic(b, 'deluge-of-hell');
    b.indoors = true;
    expect(canUse(b, f, deluge as NonNullable<typeof deluge>)).toBe(false);
    b.indoors = false;
    // The caster stands in the covered rear row, so their save adds 1d6.
    b.rng = scriptedRng([8, 8, 8, 8, 8, 20, 1, 1]);
    cast(b, f, 'deluge-of-hell', { row: 0 });
    expect(thug.status).toBe('dead');
    expect(beast.hp).toBe(80);
    expect(f.hp).toBe(40);
    expect(log(b)).toContain('The ruin lashes back at Fizzwick.');
    // A caster who keeps their nerve is spared.
    beast.hp = 100;
    b.rng = scriptedRng([1, 1, 1, 1, 1, 1, 20, 1]);
    cast(b, f, 'deluge-of-hell', { row: 0 });
    expect([beast.hp, f.hp]).toEqual([95, 40]);
  });
});

describe('High Magic against one foe', () => {
  it('Conjunction of the Inexorable Step: the foe is sent away, or the caster on a save', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia']]);
    const [a, c] = sturdy(b) as [Combatant, Combatant];
    const f = mage(b, ['conjunction-of-the-inexorable-step'], 3);
    b.rng = scriptedRng([1]);
    cast(b, f, 'conjunction-of-the-inexorable-step', { target: a.id });
    expect(a.status).toBe('out');
    b.rng = scriptedRng([20]);
    cast(b, f, 'conjunction-of-the-inexorable-step', { target: c.id });
    expect([c.status, f.status]).toEqual(['active', 'out']);
    // With no target the spell is spent for nothing.
    expect(cast(b, f, 'conjunction-of-the-inexorable-step', {})).toBe(true);
  });

  it('Evert the Inwardness: the weak save or die; everyone takes 1d10 a level, save for half', () => {
    const b = standardBattle([['thug-or-militia', 'large-solitary-predator', 'thug-or-militia']]);
    const [thug, beast, other] = sturdy(b) as [Combatant, Combatant, Combatant];
    const f = mage(b, ['evert-the-inwardness'], 2);
    b.rng = scriptedRng([1]);
    cast(b, f, 'evert-the-inwardness', { target: thug.id });
    expect(thug.status).toBe('dead');
    b.rng = scriptedRng([5, 5, 20]);
    cast(b, f, 'evert-the-inwardness', { target: beast.id });
    expect(beast.hp).toBe(35);
    // A weak foe who saves against death still takes the damage.
    b.rng = scriptedRng([20, 5, 5, 1]);
    cast(b, f, 'evert-the-inwardness', { target: other.id });
    expect(other.hp).toBe(30);
  });

  it('Torment of Tumefaction bites each round the foe attacks, until thrown off', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia']]);
    const [a, c] = sturdy(b) as [Combatant, Combatant];
    const f = mage(b, ['the-torment-of-tumefaction'], 3);
    cast(b, f, 'the-torment-of-tumefaction', { target: a.id });
    // Fewer hit dice than the level: it can't be thrown off.
    expect(a.torment).toEqual({ damage: 6, lasting: true, tried: false, round: 0 });
    act(b, a, { kind: 'shake-off' });
    expect(a.torment).not.toBeNull();
    b.rng = createRng('torment');
    act(b, a, { kind: 'attack', attack: 0, target: who(b, 'Snag').id });
    expect(a.hp).toBe(34);
    act(b, a, { kind: 'attack', attack: 0, target: who(b, 'Snag').id });
    expect(a.hp).toBe(34);
    // A torment that would kill is shaken off if it can be.
    const weak = mage(b, ['the-torment-of-tumefaction'], 1);
    cast(b, weak, 'the-torment-of-tumefaction', { target: c.id });
    c.hp = 2;
    expect(monsterAction(b, c)).toEqual({ kind: 'shake-off' });
    b.rng = scriptedRng([1]);
    act(b, c, { kind: 'shake-off' });
    expect(c.torment?.tried).toBe(true);
    b.rng = createRng('tried');
    expect(monsterAction(b, c).kind).not.toBe('shake-off');
    (c.torment as NonNullable<Combatant['torment']>).tried = false;
    b.rng = scriptedRng([20]);
    act(b, c, { kind: 'shake-off' });
    expect(c.torment).toBeNull();
    // A torment that drops its bearer stops the swing.
    cast(b, weak, 'the-torment-of-tumefaction', { target: c.id });
    act(b, c, { kind: 'attack', attack: 0, target: who(b, 'Snag').id });
    expect(c.status).toBe('dead');
    const third = who(b, 'foe-0-0');
    Object.assign(third, { status: 'active', hp: 1, torment: null });
    cast(b, weak, 'the-torment-of-tumefaction', { target: third.id });
    act(b, third, { kind: 'breath', row: 0 });
    expect(third.status).toBe('dead');
  });
});

describe('High Magic on the party', () => {
  it('Mantle of Disjecting Dissection cuts melee attackers who fail an Evasion save', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia']]);
    const [a, c] = sturdy(b, 5) as [Combatant, Combatant];
    const f = mage(b, ['mantle-of-disjecting-dissection'], 3);
    const snag = who(b, 'Snag');
    cast(b, f, 'mantle-of-disjecting-dissection', { target: snag.id });
    expect(snag.mantle).toMatchObject({ bonus: 3, save: 'evasion' });
    const hp = snag.hp;
    b.rng = scriptedRng([1, 6]);
    resolveAttack(b, a, a.attacks[0] as Combatant['attacks'][number], snag);
    expect(a.status).toBe('dead');
    expect(snag.hp).toBe(hp);
    b.rng = createRng('mantle');
    resolveAttack(b, c, c.attacks[0] as Combatant['attacks'][number], snag);
    expect(log(b)).toContain('The blades around Snag cut');
  });

  it('Resounding Temporal Echo gives allies an extra attack a turn, for a point of strain', () => {
    const b = standardBattle([['thug-or-militia']]);
    sturdy(b, 200);
    const f = mage(b, ['resounding-temporal-echo'], 2);
    b.rng = scriptedRng([2]);
    cast(b, f, 'resounding-temporal-echo');
    const [snag, grukk, lirael] = ['Snag', 'Grukk', 'Lirael'].map((n) => who(b, n)) as [
      Combatant,
      Combatant,
      Combatant,
    ];
    expect([snag.echo?.until, grukk.echo?.until, lirael.echo]).toEqual([3, 3, null]);
    b.rng = createRng('echo');
    const strain = (snag.strain as NonNullable<Combatant['strain']>).strain;
    const swing = { kind: 'attack' as const, attack: 0, target: 'foe-0-0' };
    b.queue = [snag.id];
    takeTurn(b, snag, () => swing);
    expect(snag.strain?.strain).toBe(strain + 1);
    expect(log(b)).toContain('Snag moves in a blur of quickened time.');
    // Strain that can't be borne, or magic, gets no extra action.
    snag.strain = { strain: 10, max: 10, broken: false };
    b.queue = [snag.id];
    takeTurn(b, snag, () => swing);
    expect(snag.strain.strain).toBe(10);
    // Those without System Strain, such as NPCs, take it free.
    grukk.strain = null;
    b.queue = [grukk.id];
    takeTurn(b, grukk, () => swing);
    expect(log(b).match(/Grukk moves in a blur/g)).toHaveLength(1);
    b.queue = [grukk.id];
    takeTurn(b, grukk, () => ({ kind: 'wait' }));
    expect(log(b).match(/Grukk moves in a blur/g)).toHaveLength(1);
  });

  it('Extirpate Arcana ends the magic on every creature in the target’s row', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = mage(b, ['extirpate-arcana'], 3);
    const [snag, grukk, lirael] = ['Snag', 'Grukk', 'Lirael'].map((n) => who(b, n)) as [
      Combatant,
      Combatant,
      Combatant,
    ];
    snag.status = 'asleep';
    Object.assign(grukk, { status: 'out', spellbound: true, blindRounds: 3 });
    lirael.blindRounds = 2;
    const extirpate = combatMagic(b, 'extirpate-arcana');
    const choices = commandsFor(b, f).find((c) => c.key === 'magic:extirpate-arcana')?.choices;
    expect(choices?.map((c) => c.targetId)).toContain(grukk.id);
    expect(extirpate?.target).toBe('any');
    cast(b, f, 'extirpate-arcana', { target: snag.id });
    expect([snag.status, grukk.status, grukk.blindRounds, lirael.blindRounds]).toEqual([
      'active',
      'active',
      0,
      2,
    ]);
    // Being knocked out is no spell.
    grukk.status = 'out';
    cast(b, f, 'extirpate-arcana', { target: snag.id });
    expect(grukk.status).toBe('out');
    expect(cast(b, f, 'extirpate-arcana', {})).toBe(true);
  });

  it('Scorn the Fetters of Earth lifts the party, or grounds flying foes who fail', () => {
    const b = standardBattle([['manticore', 'manticore', 'manticore']]);
    const f = mage(b, ['scorn-the-fetters-of-earth'], 2);
    cast(b, f, 'scorn-the-fetters-of-earth', { target: who(b, 'Snag').id });
    expect(b.combatants.filter((c) => c.side === 'party' && c.flyingRounds > 0)).toHaveLength(3);
    const [a, c, d] = b.combatants.filter((x) => x.side === 'enemy') as [
      Combatant,
      Combatant,
      Combatant,
    ];
    // The target first, then one more flyer for a level-2 caster.
    b.rng = scriptedRng([1, 20]);
    cast(b, f, 'scorn-the-fetters-of-earth', { target: c.id });
    expect([a.tags.has('flying'), c.tags.has('flying'), d.tags.has('flying')]).toEqual([
      true,
      false,
      true,
    ]);
    expect(cast(b, f, 'scorn-the-fetters-of-earth', {})).toBe(true);
    // A caster without the Magic skill takes no penalty off the save.
    delete f.skills.magic;
    b.rng = scriptedRng([1, 20]);
    cast(b, f, 'scorn-the-fetters-of-earth', { target: a.id });
    expect(a.tags.has('flying')).toBe(false);
  });
});

describe('High Magic on every foe, or everyone', () => {
  it('Phobic Storm: each foe checks Morale at -1; those who hold take a point a level', () => {
    const b = standardBattle([
      ['thug-or-militia', 'thug-or-militia', 'thug-or-militia', 'automaton-laborer'],
    ]);
    const [a, c, d, bot] = sturdy(b) as [Combatant, Combatant, Combatant, Combatant];
    d.hp = 3;
    const f = mage(b, ['phobic-storm'], 3);
    b.rng = scriptedRng([6, 6, 1, 1, 1, 1]);
    cast(b, f, 'phobic-storm');
    expect([a.status, c.status, c.hp, d.status, d.hp, bot.status]).toEqual([
      'fled',
      'active',
      37,
      'fled',
      1,
      'active',
    ]);
  });

  it('Glass Chimes shattered hurt everyone but the caster', () => {
    const b = standardBattle([['thug-or-militia']]);
    const [thug] = sturdy(b) as [Combatant];
    const f = mage(b, ['the-glass-chimes-of-the-bamboo-terrace'], 5);
    const snag = who(b, 'Snag');
    const [fizz, snagHp] = [f.hp, snag.hp];
    const choice = commandsFor(b, f).find((c) => c.key.includes('glass-chimes'))?.choices[0];
    expect(choice?.label).toBe('Cast it');
    b.rng = scriptedRng([1, 1, 1]);
    cast(b, f, 'the-glass-chimes-of-the-bamboo-terrace');
    expect([thug.hp, snag.hp, f.hp]).toEqual([37, snagHp - 3, fizz]);
  });

  it('the Sigil’s gust bowls over all but the large, who lose their next action', () => {
    const b = standardBattle([['thug-or-militia', 'cave-bear', 'thug-or-militia']]);
    const [a, bear, c] = sturdy(b) as [Combatant, Combatant, Combatant];
    const f = mage(b, ['sigil-of-aeolian-auctoritas'], 4);
    b.rng = scriptedRng([1, 4, 20]);
    cast(b, f, 'sigil-of-aeolian-auctoritas', { row: 0 });
    expect([a.stunned, a.hp, bear.stunned, c.stunned]).toEqual([true, 36, false, false]);
  });

  it('Banishment: the weak are lost; the strong may find their way back next round', () => {
    const b = standardBattle([['thug-or-militia', 'apex-predator', 'apex-predator']]);
    const [thug, back, lost] = sturdy(b) as [Combatant, Combatant, Combatant];
    const f = mage(b, ['banishment-to-the-black-glass-labyrinth'], 5);
    b.rng = scriptedRng([20, 1]);
    cast(b, f, 'banishment-to-the-black-glass-labyrinth', { row: 0 });
    expect([thug.status, back.status, lost.status, back.returnsRound]).toEqual([
      'out',
      'out',
      'out',
      2,
    ]);
    b.rng = createRng('labyrinth');
    endOfRound(b);
    expect(back.status).toBe('active');
    expect(log(b)).toContain('returns from the black glass maze');
  });

  it('the Prismatic Hemicycle: each foe who fails rolls a d6 for its fate', () => {
    const b = standardBattle([Array<string>(7).fill('thug-or-militia')]);
    const foes = sturdy(b);
    const f = mage(b, ['the-dazzling-prismatic-hemicycle'], 9);
    b.rng = scriptedRng([1, 1, 1, 2, 1, 3, 1, 4, 1, 5, 1, 6, 20]);
    cast(b, f, 'the-dazzling-prismatic-hemicycle');
    expect(foes.map((x) => [x.status, x.berserk, x.spellbound])).toEqual([
      ['active', false, false],
      ['dead', false, false],
      ['out', false, false],
      ['active', true, false],
      ['out', false, false],
      ['out', false, true],
      ['active', false, false],
    ]);
    // The mad strike at their own side; alone, they fight on as usual.
    const mad = foes[3] as Combatant;
    b.rng = scriptedRng([1]);
    const action = monsterAction(b, mad);
    expect(action).toMatchObject({ kind: 'attack', attack: 0 });
    expect(b.combatants.find((c) => c.id === (action as { target: string }).target)?.side).toBe(
      'enemy',
    );
    b.rng = createRng('mad');
    act(b, mad, action);
    for (const c of b.combatants) if (c.side === 'enemy' && c !== mad) c.status = 'dead';
    expect(monsterAction(b, mad)).not.toMatchObject({ target: mad.id });
  });
});

describe('summoning and the seemingly slain', () => {
  it('Calculation of the Phantasmal Eidolon: a 20 HP servant joins the line, and only knocks foes out', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = mage(b, ['calculation-of-the-phantasmal-eidolon'], 7);
    cast(b, f, 'calculation-of-the-phantasmal-eidolon');
    const eidolon = b.combatants.at(-1) as Combatant;
    expect(eidolon).toMatchObject({
      name: 'Phantasmal Eidolon',
      side: 'party',
      row: 0,
      column: 2,
      hp: 20,
      subdues: true,
      summoned: { by: f.id, monster: 'phantasmal-eidolon' },
    });
    const thug = who(b, 'foe-0-0');
    expect(subdue(b, who(b, 'Snag'), thug, 99)).toBe(false);
    expect(subdue(b, eidolon, thug, 1)).toBe(thug.hp <= 1);
    expect(subdue(b, eidolon, thug, 99)).toBe(true);
    expect(thug.status).toBe('out');
    // Its own blows knock out rather than kill.
    const other = standardBattle([['thug-or-militia']]);
    const caller = mage(other, ['calculation-of-the-phantasmal-eidolon'], 7);
    cast(other, caller, 'calculation-of-the-phantasmal-eidolon');
    const servant = other.combatants.at(-1) as Combatant;
    const foe = who(other, 'foe-0-0');
    foe.hp = 1;
    other.rng = scriptedRng([20, 8]);
    resolveAttack(other, servant, servant.attacks[0] as Combatant['attacks'][number], foe);
    expect(foe.status).toBe('out');
    expect(log(other)).toContain('Phantasmal Eidolon knocks Thug or Militia senseless.');
    // A full formation has no room.
    const full = createBattle({
      data,
      rng: createRng('full'),
      party: ['snag', 'grukk', 'lirael', 'fizzwick', 'snag', 'grukk', 'lirael', 'fizzwick'].map(
        (n) => ({ character: starter(n as 'snag') }),
      ),
      enemies: [['thug-or-militia']],
      log: true,
    });
    const caster = full.combatants.find((c) => c.name === 'Fizzwick') as Combatant;
    Object.assign(caster.caster as CasterState, {
      level: 7,
      known: ['calculation-of-the-phantasmal-eidolon'],
      prepared: ['calculation-of-the-phantasmal-eidolon'],
      spellsLeft: 1,
    });
    castMagic(full, caster, 'calculation-of-the-phantasmal-eidolon', undefined, undefined);
    expect(log(full)).toContain("There is no room for Fizzwick's servant.");
    // A side of monster rows takes the servant into its front row.
    const rows = createBattle({
      data,
      rng: createRng('rows'),
      party: [],
      allies: [['petty-mage']],
      enemies: [['thug-or-militia']],
    });
    const petty = rows.combatants[0] as Combatant;
    Object.assign(petty.caster as CasterState, {
      level: 7,
      known: ['calculation-of-the-phantasmal-eidolon'],
      prepared: ['calculation-of-the-phantasmal-eidolon'],
      spellsLeft: 1,
    });
    castMagic(rows, petty, 'calculation-of-the-phantasmal-eidolon', undefined, undefined);
    expect(rows.combatants.at(-1)).toMatchObject({ side: 'party', row: 0 });
  });

  it('Prudentially Transient Abnegation of Life spares a falling PC, who rises after a win', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = mage(b, ['prudentially-transient-abnegation-of-life'], 3);
    const snag = who(b, 'Snag');
    const strain = (snag.strain as NonNullable<Combatant['strain']>).strain;
    harm(b, snag, snag.hp);
    expect(snag).toMatchObject({ status: 'out', revives: { hp: 6, strain: 2 } });
    expect((f.caster as CasterState).spellsLeft).toBe(8);
    // Even the Frail are spared.
    const grukk = who(b, 'Grukk');
    grukk.frail = true;
    harm(b, grukk, grukk.hp);
    expect(grukk.status).toBe('out');
    // With no slots left, a fall is a fall.
    (f.caster as CasterState).spellsLeft = 0;
    const lirael = who(b, 'Lirael');
    harm(b, lirael, lirael.hp);
    expect(lirael.status).toBe('dying');
    lirael.frail = true;
    lirael.status = 'active';
    lirael.hp = 1;
    harm(b, lirael, 1);
    expect(lirael.status).toBe('dead');
    // The magic isn't a command, and cast by hand it does nothing more.
    expect(commandsFor(b, f).some((c) => c.key.includes('abnegation'))).toBe(false);
    (f.caster as CasterState).spellsLeft = 1;
    expect(cast(b, f, 'prudentially-transient-abnegation-of-life')).toBe(true);
    expect(b.combatants.some((c) => c.revives && c !== snag && c !== grukk)).toBe(false);
    b.outcome = 'party';
    concludeBattle(b);
    expect(snag).toMatchObject({ status: 'active', hp: 6, revives: null });
    expect(snag.strain?.strain).toBe(strain + 2);
    expect(log(b)).toContain("Snag's remains flow back together.");
  });

  it('leaves the seemingly slain on a lost field', () => {
    const b = standardBattle([['thug-or-militia']]);
    mage(b, ['prudentially-transient-abnegation-of-life'], 3);
    const snag = who(b, 'Snag');
    harm(b, snag, snag.hp);
    b.outcome = 'enemy';
    concludeBattle(b);
    expect(snag.status).toBe('out');
  });
});

describe('High Magic cast with no target', () => {
  it('spends the spell for nothing', () => {
    const b = standardBattle([['thug-or-militia']]);
    const spells = [
      'mantle-of-disjecting-dissection',
      'the-torment-of-tumefaction',
      'evert-the-inwardness',
    ];
    const f = mage(b, spells, 5);
    for (const id of spells) expect(cast(b, f, id)).toBe(true);
    expect(b.combatants.some((c) => c.mantle || c.torment)).toBe(false);
  });
});
