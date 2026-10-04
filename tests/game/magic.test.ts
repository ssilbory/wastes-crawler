import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/data/content.ts';
import { loadSrd } from '../../src/data/load.ts';
import type { ClassOption } from '../../src/data/schemas/index.ts';
import {
  classBonusSkills,
  classOption,
  evaluateClass,
} from '../../src/game/character/class-step.ts';
import type { GameData } from '../../src/game/character/context.ts';
import { emptyChoices, finishCharacter, type Choices } from '../../src/game/character/creation.ts';
import { characterSheet } from '../../src/game/character/derived.ts';
import { exportCharacter, importCharacter } from '../../src/game/character/io.ts';
import type { InventoryEntry } from '../../src/game/character/items.ts';
import {
  artPicks,
  castingAllowed,
  effortFor,
  evaluateMagic,
  learnableSpells,
  spellSlots,
  type MagicChoice,
} from '../../src/game/character/magic.ts';
import type { AttributeScores } from '../../src/rules/attributes.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';

const data: GameData = { srd: loadSrd(), content: loadContent() };
const mage = (id: string) =>
  (classOption(data, id) as ClassOption).mage as NonNullable<ClassOption['mage']>;
const scores = (s: Partial<AttributeScores>): AttributeScores => ({
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
  ...s,
});
const levels = (l: Record<string, number>) => ({ current: Object.keys(l)[0] as string, levels: l });

describe('Effort fixtures (SRD 1.5.10.1, 1.5.7.1, and the one-pool house rule)', () => {
  const effort = (l: Record<string, number>, s: Partial<AttributeScores>, magic = 0, cha = {}) =>
    effortFor(data, levels(l), { magic }, scores(s), cha);

  it('is 1 + Magic + the better of Int or Cha for full casters', () => {
    // Full High Mage, Magic-0, Int 14 (+1): 1 + 0 + 1 = 2.
    expect(effort({ 'full-high-mage': 1 }, { int: 14, cha: 7 })).toBe(2);
    // Full Elementalist, Magic-1, Cha 18 (+2): 1 + 1 + 2 = 4.
    expect(effort({ 'full-elementalist': 1 }, { cha: 18 }, 1)).toBe(4);
    // Int 7 and Cha 7 (-1): 1 + 0 - 1 = 0; full casters have no floor.
    expect(effort({ 'full-high-mage': 1 }, { int: 7, cha: 7 })).toBe(0);
  });

  it('is one lower, but at least 1, for partial casters', () => {
    // Partial High Mage/Partial Warrior, Int 14: 1 + 0 + 1 - 1 = 1.
    expect(effort({ 'high-mage-partial-warrior': 1 }, { int: 14 })).toBe(1);
    expect(effort({ 'elementalist-partial-expert': 1 }, { int: 7, cha: 7 })).toBe(1);
    // Dual partial, Magic-1 from two bonus picks, Cha 14: 1 + 1 + 1 - 1 = 2.
    expect(effort({ 'high-mage-partial-other-mage': 1 }, { cha: 14 }, 1)).toBe(2);
  });

  it('pools across switched classes, with no partial penalty if any class is full', () => {
    // Warrior 4 switched to Partial High Mage: still partial only. Int 16 (+1): 1 + 0 + 1 - 1 = 1.
    expect(effort({ 'full-warrior': 4, 'high-mage-partial-warrior': 1 }, { int: 16 })).toBe(1);
    // A full Elementalist level plus a partial High Mage: no penalty: 1 + 1 + 1 = 3.
    expect(effort({ 'full-elementalist': 2, 'high-mage-partial-expert': 1 }, { int: 14 }, 1)).toBe(
      3,
    );
    // A class at level 0 doesn't count.
    expect(effort({ 'full-warrior': 4, 'full-high-mage': 0 }, { int: 14 })).toBeNull();
  });

  it('uses Developed Attribute and returns null for non-casters', () => {
    // Cha 14 is +1; Developed Attribute raises it to +2: 1 + 0 + 2 = 3.
    expect(effort({ 'full-high-mage': 1 }, { cha: 14 }, 0, { cha: 1 })).toBe(3);
    expect(effort({ 'full-expert': 1 }, { int: 18 })).toBeNull();
    expect(effortFor(data, levels({ 'full-high-mage': 1 }), {}, scores({ int: 14 }), {})).toBe(2);
  });
});

describe('class bonus skills', () => {
  it('grants Magic per tradition, twice for a dual caster', () => {
    expect(classBonusSkills(data, classOption(data, 'full-high-mage') as ClassOption)).toEqual([
      'magic',
    ]);
    expect(
      classBonusSkills(data, classOption(data, 'high-mage-partial-other-mage') as ClassOption),
    ).toEqual(['magic', 'magic']);
    expect(classBonusSkills(data, classOption(data, 'full-warrior') as ClassOption)).toEqual([]);
  });

  it('needs a replacement when Magic is already level-1 (SRD 1.2.2)', () => {
    const run = (replacements: (string | null)[], skills = { magic: 1 }) =>
      evaluateClass(data, 'full-high-mage', replacements, skills);
    expect(run([]).status).toMatchObject({
      message: 'magic is already level-1; choose a replacement',
    });
    expect(run(['know'])).toMatchObject({ status: { state: 'ok' }, skills: { magic: 1, know: 0 } });
    expect(run(['juggle']).status).toMatchObject({ message: "can't replace magic with juggle" });
    expect(run(['know'], { magic: 1, know: 1 } as never).status).toMatchObject({ state: 'error' });
    expect(evaluateClass(data, 'high-mage-partial-other-mage', [], {}).skills).toEqual({
      magic: 1,
    });
    expect(evaluateClass(data, null, [], {}).status).toEqual({ state: 'incomplete' });
    expect(evaluateClass(data, 'full-high-mage', [], null)).toMatchObject({
      status: { state: 'ok' },
      skills: {},
    });
  });
});

describe('arts and spells', () => {
  it('reads level-1 art picks and spell slots from the casting tables', () => {
    expect(artPicks(data, mage('full-high-mage'))).toEqual([
      { tradition: 'high-mage', automatic: [], picks: 2 },
    ]);
    expect(artPicks(data, mage('high-mage-partial-other-mage'))).toEqual([
      { tradition: 'high-mage', automatic: [], picks: 1 },
      {
        tradition: 'elementalist',
        automatic: ['elemental-resilience'],
        picks: 1,
      },
    ]);
    expect(spellSlots(data, mage('full-high-mage'))).toMatchObject({
      maxSpellLevel: 1,
      spellsCast: 1,
      spellsPrepared: 3,
    });
    expect(spellSlots(data, mage('high-mage-partial-other-mage'))).toMatchObject({
      spellsPrepared: 3,
    });
    expect(() => spellSlots(data, { ...mage('full-high-mage'), slots: 'nope' })).toThrow();
  });

  it('lets Elementalists learn High Magic and their own spells', () => {
    const hm = learnableSpells(data, mage('full-high-mage'), 1);
    const elem = learnableSpells(data, mage('full-elementalist'), 1);
    expect(hm.every((s) => s.tradition === 'high-magic' && s.level === 1)).toBe(true);
    expect(elem.length - hm.length).toBe(4);
  });

  const hm = mage('full-high-mage');
  const four = [
    'the-coruscating-coffin',
    'phantasmal-mimesis',
    'velocitous-imbuement',
    'wardpact-invocation',
  ];
  const ok: MagicChoice = {
    arts: ['counter-magic', 'sense-magic'],
    known: four,
    prepared: four.slice(0, 3),
  };
  const status = (choice: Partial<MagicChoice> | null, m = hm) =>
    evaluateMagic(data, m, choice === null ? null : { ...ok, ...choice }).status;

  it('accepts a complete choice and adds automatic arts', () => {
    expect(evaluateMagic(data, hm, ok)).toEqual({ status: { state: 'ok' }, ...ok });
    const elem = evaluateMagic(data, mage('full-elementalist'), { ...ok, arts: ['flamesight'] });
    // Elemental Sparks is left out of the game (Phase 15).
    expect(elem.arts).toEqual(['elemental-resilience', 'flamesight']);
    expect(evaluateMagic(data, undefined, null).status).toEqual({ state: 'ok' });
    expect(status(null)).toEqual({ state: 'incomplete' });
    expect(status({ arts: ['counter-magic'] })).toEqual({ state: 'incomplete' });
    expect(status({ known: four.slice(0, 3), prepared: [] })).toEqual({ state: 'incomplete' });
  });

  it('rejects bad arts and spells', () => {
    const msg = (c: Partial<MagicChoice>, m = hm) => {
      const s = status(c, m);
      return s.state === 'error' ? s.message : s.state;
    };
    expect(msg({ arts: ['sense-magic', 'sense-magic'] })).toBe('each art can be picked only once');
    expect(msg({ arts: ['a', 'b', 'c'] })).toBe("a isn't an art of your tradition");
    expect(msg({ arts: ['sense-magic', 'counter-magic', 'swift-casting'] })).toBe(
      'pick 2 high-mage arts',
    );
    expect(msg({ arts: ['flamesight', 'sense-magic'] })).toBe(
      "flamesight isn't an art of your tradition",
    );
    expect(msg({ arts: ['elemental-resilience'] }, mage('full-elementalist'))).toBe(
      'that art is already granted',
    );
    expect(msg({ arts: ['elemental-sparks'] }, mage('full-elementalist'))).toBe(
      "elemental-sparks isn't used in this game",
    );
    expect(msg({ known: ['flame-scrying', ...four.slice(1)] })).toBe(
      "flame-scrying isn't a spell you can learn yet",
    );
    expect(
      msg({
        known: [
          'the-wind-of-the-final-repose',
          'cognitive-supersession-of-the-inferior-orders',
          'calculation-of-the-evoked-servitor',
          'phantasmal-mimesis',
        ],
      }),
    ).toMatch(/isn't a spell you can learn yet$/);
    expect(msg({ known: [four[0] as string, ...four.slice(0, 3)] })).toBe(
      'each spell can be learned only once',
    );
    expect(msg({ known: [...four, 'damnation-of-the-sense'] })).toBe(
      'a new character knows 4 spells',
    );
    expect(msg({ prepared: ['damnation-of-the-sense'] })).toBe(
      'prepare each known spell at most once',
    );
    expect(msg({ prepared: [four[0] as string, four[0] as string] })).toBe(
      'prepare each known spell at most once',
    );
    expect(msg({ prepared: four })).toBe('you can prepare 3 spells');
  });
});

describe('casting in armor (SRD 1.5.12, Armored Magic)', () => {
  const W = (id: string, extra: Partial<InventoryEntry> = {}): InventoryEntry => ({
    id,
    quantity: 1,
    location: 'worn',
    ...extra,
  });
  const allowed = (entries: InventoryEntry[], level = 0) =>
    castingAllowed(data, entries, level ? [{ id: 'armored-magic', level }] : []);

  it('blocks any worn armor or shield without Armored Magic', () => {
    expect(allowed([W('clothes-common'), W('no-armor')])).toBe(true);
    expect(allowed([W('war-shirt')])).toBe(false);
    expect(allowed([W('small-shield')])).toBe(false);
    expect(allowed([{ ...W('plate-armor'), location: 'stowed' }, W('flying-carpet')])).toBe(true);
  });

  it('allows encumbrance 2 and shields at level 1, any armor at level 2', () => {
    expect(allowed([W('linothorax'), W('small-shield')], 1)).toBe(true);
    expect(allowed([W('war-robe')], 1)).toBe(false);
    expect(allowed([W('war-robe')], 2)).toBe(true);
    // Other focus effects don't help.
    expect(castingAllowed(data, [W('war-shirt')], [{ id: 'armsmaster', level: 2 }])).toBe(false);
    // Barding counts at double encumbrance: linothorax barding is 2, pieced barding is 4.
    expect(allowed([W('linothorax', { barding: true })], 1)).toBe(true);
    expect(allowed([W('pieced-armor', { barding: true })], 1)).toBe(false);
  });
});

describe('missing traditions', () => {
  it('skips a tradition the content no longer defines', () => {
    const bare: GameData = { ...data, content: { ...data.content, traditions: [] } };
    const option = classOption(bare, 'full-high-mage') as ClassOption;
    expect(classBonusSkills(bare, option)).toEqual([]);
    expect(learnableSpells(bare, mage('full-high-mage'), 1)).toEqual([]);
    expect(effortFor(bare, levels({ 'full-high-mage': 1 }), {}, scores({}), {})).toBeNull();
  });
});

describe('a finished caster', () => {
  const highMage = (overrides: Partial<Choices> = {}): Choices => ({
    ...emptyChoices(),
    people: 'gnome',
    array: { str: 7, dex: 12, con: 11, int: 14, wis: 10, cha: 9 },
    background: { id: 'scavenger', choice: { mode: 'pick', picks: [{ index: 1 }, { index: 2 }] } },
    classId: 'full-high-mage',
    foci: [null, { id: 'artisan' }, { id: 'polymath', skill: 'heal' }, { id: 'armored-magic' }],
    magic: { arts: ['counter-magic', 'sense-magic'], known: four(), prepared: four().slice(0, 3) },
    freeSkill: 'know',
    gear: { mode: 'package', packageId: 'apprentice' },
    name: 'Fizzwick',
    ...overrides,
  });
  function four() {
    return [
      'the-coruscating-coffin',
      'phantasmal-mimesis',
      'velocitous-imbuement',
      'wardpact-invocation',
    ];
  }

  it('saves arts and spells and shows Effort and slots on the sheet', () => {
    const r = finishCharacter(highMage(), data, scriptedRng([3, 1, 2]));
    if (!r.ok) throw new Error(r.errors.join('; '));
    expect(r.character).toMatchObject({
      skills: { magic: 0 },
      arts: ['counter-magic', 'sense-magic'],
      spells: { known: four(), prepared: four().slice(0, 3) },
    });
    expect(importCharacter(exportCharacter(r.character), data)).toEqual({
      ok: true,
      character: r.character,
    });
    // Gnome Int 14 + 2 = 16 (+1), Magic-0: 1 + 0 + 1 = 2.
    expect(characterSheet(r.character, data).magic).toEqual({
      effort: 2,
      slots: expect.objectContaining({ maxSpellLevel: 1, spellsCast: 1, spellsPrepared: 3 }),
      canCast: true,
    });
  });

  it('holds the magic step until the class is valid', () => {
    const r = finishCharacter(highMage({ magic: null }), data, scriptedRng([]));
    expect(r).toEqual({ ok: false, errors: ['magic: incomplete'] });
  });
});
