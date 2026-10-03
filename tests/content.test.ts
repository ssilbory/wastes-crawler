import { describe, expect, it } from 'vitest';
import { contentReferenceErrors, loadContent } from '../src/data/content.ts';
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
    };
    expect(contentReferenceErrors(srd, broken)).toEqual([
      'backgrounds/scavenger: unknown people dwarf',
      'peoples/centaur: no background is open to it',
      'peoples/centaur lineages: duplicate id deer',
    ]);
  });
});
