import { describe, expect, it } from 'vitest';
import { contentReferenceErrors, loadContent } from '../src/data/content.ts';
import { focusReferenceErrors } from '../src/data/focus-content.ts';
import { loadSrd } from '../src/data/load.ts';

const srd = loadSrd();
const content = loadContent();

describe('data/content', () => {
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
      peoples: [goblin, { ...centaur, lineages: [deer, deer] }],
      backgrounds: [{ ...bg, peoples: ['goblin', 'dwarf'] }],
      racialFoci: content.racialFoci,
      focusRules: content.focusRules,
    };
    expect(contentReferenceErrors(srd, broken)).toEqual([
      'backgrounds/scavenger: unknown people dwarf',
      'peoples/centaur: no background is open to it',
      'peoples/centaur lineages: duplicate id deer',
    ]);
  });
});

describe('focus content', () => {
  it('matches each SRD bonus skill to the focus text (1.6.0 Foci.md)', () => {
    const name = (n: string) => srd.skills.find((s) => s.name === n)?.id;
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
          racialFocusPicks: ['armored-magic'],
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
        "peoples/centaur: armored-magic isn't a pickable SRD focus",
      ]),
    );
  });
});
