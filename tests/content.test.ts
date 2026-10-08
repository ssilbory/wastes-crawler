import { describe, expect, it } from 'vitest';
import { contentReferenceErrors, loadContent } from '../src/data/content.ts';
import { combatReferenceErrors } from '../src/data/combat-check.ts';
import { equipmentReferenceErrors } from '../src/data/equipment-check.ts';
import { focusReferenceErrors } from '../src/data/focus-content.ts';
import { magicReferenceErrors } from '../src/data/magic-check.ts';
import { loadSrd } from '../src/data/load.ts';

const srd = loadSrd();
const content = loadContent();

describe('data/content', () => {
  it('checks every disease named by places, traps, and strikes', () => {
    const broken = {
      ...content,
      terrains: content.terrains.map((t, i) =>
        i === 0 ? { ...t, exposure: { disease: 'plague', chance: 1 } } : t,
      ),
      monsterCombat: content.monsterCombat.map((m) =>
        m.id === 'gnawing-dead'
          ? {
              ...m,
              routine: m.routine?.map((r) => ({
                ...r,
                onHit: { kind: 'disease' as const, disease: 'rot' },
              })),
            }
          : m,
      ),
      dungeons: content.dungeons.map((d, i) =>
        i === 0
          ? {
              ...d,
              levels: d.levels.map((l, j) =>
                j === 0
                  ? {
                      ...l,
                      exposure: { disease: 'mold', chance: 2 },
                      // The Old Barrow's upper level has a trap to turn to filth.
                      traps: l.traps.map((t) => ({
                        ...t,
                        effect: { kind: 'disease' as const, disease: 'ooze' },
                      })),
                    }
                  : l,
              ),
            }
          : d,
      ),
      ailments: {
        ...content.ailments,
        antidote: { ...content.ailments.antidote, id: 'healers-pouch' },
        diseases: [...content.ailments.diseases, content.ailments.diseases[0] as never],
      },
    };
    const errors = contentReferenceErrors(srd, broken).filter((e) =>
      /disease|ailments|antidote/.test(e),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        'ailments: duplicate disease ids',
        `terrains/${content.terrains[0]?.id} exposure: unknown disease plague`,
        expect.stringMatching(/exposure: unknown disease mold$/),
        expect.stringMatching(/trap: unknown disease ooze$/),
        'monsterCombat/gnawing-dead Claw: unknown disease rot',
        "ailments: the antidote's id healers-pouch is SRD gear",
      ]),
    );
  });

  it('validates and references only existing SRD skills', () => {
    expect(contentReferenceErrors(srd, content)).toEqual([]);
    expect(content.peoples.map((p) => p.id)).toEqual([
      'goblin',
      'orc',
      'elf',
      'centaur',
      'beastman',
      'gnome',
    ]);
    expect(content.backgrounds).toHaveLength(10);
  });

  it('checks the skill changes (docs/rules-adaptation.md, Skills)', () => {
    const rules = content.skillRules;
    const broken = {
      ...content,
      skillRules: {
        ...rules,
        removed: [...rules.removed, { id: 'juggle', becomes: 'flying', why: 'x' }],
        added: [...rules.added, { id: 'stab', name: 'Stab', description: 'x' }],
        animalKen: { ...rules.animalKen, skill: 'whisper' },
        retiredFoci: ['alert'],
      },
    };
    expect(contentReferenceErrors(srd, broken).filter((e) => e.startsWith('skillRules'))).toEqual([
      'skillRules/removed/juggle: not an SRD skill',
      'skillRules/removed/juggle: unknown skill flying',
      'skillRules/added/stab: clashes with an SRD skill',
      'skillRules/retiredFoci/alert: not an excluded focus',
      'skillRules/animalKen: unknown skill whisper',
    ]);
    // Content may not give a removed skill.
    const riding = {
      ...content,
      backgrounds: content.backgrounds.map((b, i) => (i === 0 ? { ...b, freeSkill: 'ride' } : b)),
    };
    expect(contentReferenceErrors(srd, riding)).toContain(
      `backgrounds/${content.backgrounds[0]?.id} free skill: unknown skill ride`,
    );
  });

  it('gives Goblins +2 Dex, +1 Int, and -2 Str', () => {
    expect(content.peoples[0]?.attributeModifiers).toEqual({ dex: 2, int: 1, str: -2 });
  });

  it('reports unknown skills and duplicate ids', () => {
    const [bg] = content.backgrounds;
    if (!bg) throw new Error('no backgrounds');
    const broken = {
      ...content,
      backgrounds: [
        {
          ...bg,
          freeSkill: 'juggle',
          learning: bg.learning.map(() => ({ kind: 'skill' as const, skill: 'fly' })),
        },
        bg,
        bg,
      ],
    };
    expect(contentReferenceErrors(srd, broken)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/free skill: unknown skill juggle/),
        expect.stringMatching(/learning 1: unknown skill fly/),
        expect.stringMatching(/backgrounds: duplicate id/),
      ]),
    );
  });

  it('reports unknown and unserved peoples and duplicate lineages', () => {
    const [goblin, , , centaur] = content.peoples;
    const [bg] = content.backgrounds;
    if (!goblin || !centaur?.lineages || !bg) throw new Error('missing content');
    const [deer] = centaur.lineages;
    if (!deer) throw new Error('no lineages');
    const broken = {
      ...content,
      peoples: [goblin, { ...centaur, lineages: [deer, deer] }],
      backgrounds: [{ ...bg, peoples: ['goblin', 'dwarf'] }],
    };
    // Messages for the peoples left out are reported too (Phase 12c).
    expect(contentReferenceErrors(srd, broken).filter((e) => !e.includes('message for'))).toEqual([
      'backgrounds/scavenger: unknown people dwarf',
      'peoples/centaur: no background is open to it',
      'peoples/centaur lineages: duplicate id deer',
    ]);
  });
});

describe('focus content', () => {
  it('matches each SRD bonus skill to the focus text (1.6.0 Foci.md)', () => {
    // A removed skill is given as its replacement (docs/rules-adaptation.md, Skills).
    const name = (n: string) => {
      const id = srd.skills.find((s) => s.name === n)?.id;
      return content.skillRules.removed.find((r) => r.id === id)?.becomes ?? id;
    };
    for (const rule of content.focusRules) {
      const text = srd.foci.find((f) => f.id === rule.id)?.levels[0]?.text ?? '';
      const one = /^Gain (\w+) as a bonus skill/.exec(text);
      const two = /^Gain (\w+) or (\w+) as a bonus skill/.exec(text);
      const except = /^Gain any skill as a bonus, except for (.+?)\./.exec(text);
      let expected;
      if (two) expected = { kind: 'one-of', skills: [name(two[1] ?? ''), name(two[2] ?? '')] };
      else if (one) expected = { kind: 'skill', skill: name(one[1] ?? '') };
      else if (text.startsWith('Gain any combat skill')) expected = { kind: 'any-combat' };
      else if (text.startsWith('Gain any one bonus skill')) expected = { kind: 'any' };
      else if (except)
        expected = { kind: 'any-except', except: except[1]?.split(/, (?:or )?/).map(name) };
      expect(rule.bonusSkill, rule.id).toEqual(expected);
    }
  });

  it('gives every people one to three signature foci and enough fill-in picks', () => {
    for (const p of content.peoples) {
      for (const l of p.lineages ?? [{ signatureFoci: [] }]) {
        const signature = p.signatureFoci.length + l.signatureFoci.length;
        expect(signature).toBeGreaterThanOrEqual(1);
        expect(p.racialFocusPicks.length).toBeGreaterThanOrEqual(3 - signature);
      }
    }
  });

  it('reports bad focus rules, racial foci, and people focus lists', () => {
    const [goblin, , , centaur] = content.peoples;
    const [rule] = content.focusRules;
    const [racial] = content.racialFoci;
    if (!goblin || !centaur?.lineages || !rule || !racial) throw new Error('missing content');
    const broken = {
      ...content,
      peoples: [
        { ...goblin, signatureFoci: ['nope', 'warren-born', 'scrounger', 'horned'] },
        {
          ...centaur,
          signatureFoci: [],
          racialFocusPicks: ['spirit-familiar'],
          lineages: centaur.lineages.map((l) => ({ ...l, signatureFoci: [] })),
        },
      ],
      racialFoci: [
        { ...racial, id: 'alert', bonusSkill: { kind: 'skill' as const, skill: 'fly' } },
      ],
      focusRules: [...content.focusRules.slice(1), { ...rule, id: 'flying' }],
    };
    expect(focusReferenceErrors(srd, broken)).toEqual(
      expect.arrayContaining([
        'focusRules/flying: not an SRD focus',
        'focusRules: no rule for SRD focus alert',
        'foci/alert: unknown bonus skill fly',
        'racialFoci/alert: clashes with an SRD focus id',
        'peoples/goblin: unknown racial focus nope',
        'peoples/goblin: needs 1 to 3 signature foci',
        'peoples/centaur/deer: needs 1 to 3 signature foci',
        'peoples/centaur/deer: too few racial focus picks',
        "peoples/centaur: spirit-familiar isn't a pickable SRD focus",
      ]),
    );
  });
});

describe('equipment content', () => {
  it('reports unknown items, rules, and effect skills', () => {
    const [pkg] = content.startingPackages;
    const [shield] = content.shields;
    const armsmaster = content.focusRules.find((r) => r.id === 'armsmaster');
    const [horned] = content.racialFoci.filter((f) => f.id === 'horned');
    if (!pkg || !shield || !armsmaster || !horned) throw new Error('missing content');
    const broken = {
      ...content,
      shields: [{ ...shield, id: 'dagger' }],
      startingPackages: [
        { ...pkg, items: [{ id: 'jetpack', quantity: 1, location: 'stowed' as const }] },
      ],
      equipmentRules: {
        ...content.equipmentRules,
        noUnskilledPenalty: ['laser'],
        numerous: { trait: 'swarming', perItem: 5 },
      },
      focusRules: [
        {
          ...armsmaster,
          effects: [
            {
              kind: 'damage-adds-skill' as const,
              level: 1 as const,
              skill: 'fly',
              modes: ['melee' as const],
              shock: false,
            },
          ],
        },
      ],
      racialFoci: [
        {
          ...horned,
          effects: [
            {
              kind: 'natural-weapon' as const,
              level: 1 as const,
              weapon: {
                id: 'tail',
                name: 'Tail',
                damage: { count: 1, sides: 4, modifier: 0 },
                shock: null,
                attributes: ['str' as const],
                skill: 'swish',
              },
            },
          ],
        },
      ],
    };
    expect(equipmentReferenceErrors(srd, broken)).toEqual([
      'shields/dagger: clashes with another item id',
      'startingPackages/shield-wall: unknown item jetpack',
      'equipmentRules: unknown weapon laser',
      'equipmentRules: unknown trait swarming',
      'foci/armsmaster: effect uses unknown skill fly',
      'foci/horned: effect uses unknown skill swish',
    ]);
  });
});

describe('magic content', () => {
  it('reports unknown progressions, traditions, casting tables, and skills', () => {
    const [hm] = content.traditions;
    const caster = content.classOptions.find((c) => c.mage);
    if (!hm || !caster?.mage) throw new Error('missing content');
    const broken = {
      ...content,
      traditions: [
        {
          ...hm,
          id: 'witch',
          bonusSkill: 'necromancy',
          effort: { ...hm.effort, skills: ['death'] },
          artLevels: { 'revive-the-fallen': 8 },
          excludedArts: ['limb-restoration'],
          artText: { 'purge-ailment': 'Lifts Frailty.' },
        },
      ],
      classOptions: [
        { id: 'full-wizard', name: 'Wizard' },
        {
          ...caster,
          mage: {
            ...caster.mage,
            slots: 'nope',
            traditions: [{ tradition: 'bard', partial: false, arts: 'none' }],
            excludedSpells: ['raise-corpse', 'no-such-spell'],
          },
        },
      ],
    };
    expect(magicReferenceErrors(srd, broken)).toEqual([
      'traditions/witch: unknown skill necromancy',
      'traditions/witch: unknown skill death',
      'traditions/witch: has no arts',
      "traditions/witch: revive-the-fallen isn't one of its arts",
      "traditions/witch: limb-restoration isn't one of its arts",
      "traditions/witch: purge-ailment isn't one of its arts",
      'classOptions/full-wizard: unknown progression',
      'classOptions/full-high-mage: unknown casting table nope',
      'classOptions/full-high-mage: unknown tradition bard',
      'classOptions/full-high-mage: unknown casting table none',
      'classOptions/full-high-mage: unknown excluded spell no-such-spell',
    ]);
  });
});

describe('combat content', () => {
  it('reports missing monsters, weapons, magic, and skills', () => {
    const [blast] = content.combatMagic.filter((m) => m.effect.kind === 'blast');
    const [shackles] = content.combatMagic.filter((m) => m.effect.kind === 'enthrall');
    if (
      !blast ||
      !shackles ||
      blast.effect.kind !== 'blast' ||
      shackles.effect.kind !== 'enthrall'
    ) {
      throw new Error('missing content');
    }
    const broken = {
      ...content,
      monsterCombat: [
        ...content.monsterCombat
          .filter((m) => !['herd-beast', 'thug-or-militia', 'giant-ant', 'zombie'].includes(m.id))
          .map((m) => ({ ...m, caster: undefined })),
        { id: 'thug-or-militia', tags: [], mind: 'sapient' as const },
        {
          id: 'giant-ant',
          tags: [],
          mind: 'animal' as const,
          routine: [{ name: 'Bite', damage: { count: 1, sides: 6, modifier: 0 }, count: 2 }],
        },
        {
          id: 'zombie',
          tags: [],
          mind: 'mindless' as const,
          volley: [{ name: 'Spit', damage: { count: 1, sides: 4, modifier: 0 }, count: 1 }],
        },
        { id: 'dragon', weapon: 'breath', tags: [], mind: 'monster' as const },
      ],
      combatMagic: [
        { ...blast, effect: { ...blast.effect, skill: 'blasting' } },
        { ...shackles, effect: { ...shackles.effect, penaltySkill: 'charm' } },
        { ...blast, id: 'fireball', source: 'spell' as const },
        ...content.combatMagic
          .filter((m) => m.effect.kind === 'touch-heal' || m.effect.kind === 'repose')
          .map((m) => ({ ...m, effect: { ...m.effect, skill: 'mending' } })),
      ],
    };
    expect(combatReferenceErrors(srd, broken)).toEqual([
      'monsterCombat/thug-or-militia: needs a weapon',
      'monsterCombat: no entry for herd-beast',
      'monsterCombat/giant-ant: the routine makes 2 attacks, not 1',
      'monsterCombat/zombie: a volley needs a routine',
      'monsterCombat/dragon: unknown monster',
      'monsterCombat/dragon: unknown weapon breath',
      'combatMagic/elemental-blast: unknown skill blasting',
      'combatMagic/ineluctable-shackles-of-volition: unknown skill charm',
      'combatMagic/fireball: unknown spell',
      'combatMagic/healing-touch: unknown skill mending',
      'combatMagic/final-repose: unknown skill mending',
    ]);
  });

  it('checks monster casters against the SRD tables and combat magic', () => {
    const mage = content.monsterCombat.find((m) => m.id === 'petty-mage');
    const coffin = content.combatMagic.find((m) => m.id === 'the-coruscating-coffin');
    if (!mage?.caster || !coffin) throw new Error('missing content');
    const base = mage.caster;
    const as = (id: string, caster: Partial<typeof base>) => ({
      ...mage,
      id,
      caster: { ...base, ...caster },
    });
    const ids = [
      'petty-mage',
      'tribal-shaman',
      'skilled-sorcerer',
      'master-wizard',
      'flesh-crafter',
    ];
    const broken = {
      ...content,
      monsterCombat: [
        ...content.monsterCombat.filter((m) => !ids.includes(m.id)),
        as('petty-mage', { tradition: 'witch' }),
        as('tribal-shaman', { slots: 'bardic' }),
        // 5 HD: six prepared; an elementalist spell and art for a high mage, and unknown magic.
        as('skilled-sorcerer', {
          spells: [
            'the-coruscating-coffin',
            'damnation-of-the-sense',
            'wardpact-invocation',
            'ineluctable-shackles-of-volition',
            'the-wind-of-the-final-repose',
            'fireball',
            'aqueous-harmony',
          ],
          arts: ['flight', 'elemental-blast'],
        }),
        // Elementalists cast from the high-magic list too.
        as('master-wizard', {
          tradition: 'elementalist',
          spells: ['the-coruscating-coffin'],
          arts: ['elemental-blast'],
        }),
        // 2 HD casts only first-level spells.
        as('flesh-crafter', { spells: ['calculation-of-the-evoked-servitor'] }),
      ],
      combatMagic: [
        ...content.combatMagic,
        { ...coffin, id: 'aqueous-harmony' },
        { ...coffin, id: 'calculation-of-the-evoked-servitor' },
      ],
    };
    expect(combatReferenceErrors(srd, broken)).toEqual([
      'monsterCombat/petty-mage: unknown tradition witch',
      'monsterCombat/tribal-shaman: unknown casting table bardic',
      'monsterCombat/skilled-sorcerer: prepares more than 6 spells',
      'monsterCombat/skilled-sorcerer: no combat spell fireball',
      "monsterCombat/skilled-sorcerer: aqueous-harmony is not on its tradition's lists",
      'monsterCombat/skilled-sorcerer: no combat art flight',
      'monsterCombat/skilled-sorcerer: elemental-blast is not a high-mage art',
      'monsterCombat/flesh-crafter: calculation-of-the-evoked-servitor is above its spell level',
    ]);
  });
});

describe('the Blood Priest (Phase 14c)', () => {
  it('is offered as a Partial Warrior or a Partial Healer, with miracles and no spells', () => {
    const priests = content.classOptions.filter((o) =>
      o.mage?.traditions.some((t) => t.tradition === 'blood-priest'),
    );
    expect(priests.map((o) => o.id)).toEqual([
      'blood-priest-partial-warrior',
      'blood-priest-partial-mage',
    ]);
    expect(priests[1]?.mage).toMatchObject({ startingSpells: 0, spellsPerLevel: 0 });
    expect(priests[0]?.mage).toMatchObject({ startingSpells: 0, spellsPerLevel: 0 });
    expect(content.traditions.find((t) => t.id === 'blood-priest')).toMatchObject({
      bonusSkill: 'pray',
      spellLists: [],
      armoredArts: true,
    });
  });
});
