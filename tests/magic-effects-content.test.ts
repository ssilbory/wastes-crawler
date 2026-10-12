import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/data/content.ts';
import { loadSrd } from '../src/data/load.ts';
import { magicEffectErrors } from '../src/data/magic-effects-check.ts';

const srd = loadSrd();
const content = loadContent();

describe('data/content/magic-effects.json', () => {
  it('gives every spell and art the game offers one line', () => {
    expect(magicEffectErrors(srd, content)).toEqual([]);
  });

  it('keeps each line to one short sentence without em dashes', () => {
    const lines = [
      ...Object.values(content.magicEffects.spells),
      ...Object.values(content.magicEffects.arts),
    ];
    for (const line of lines) {
      expect(line).not.toMatch(/\n|—/);
      expect(line).toMatch(/\.$/);
    }
  });

  it('flags missing lines and lines for unknown spells or arts', () => {
    const without = (lines: Record<string, string>, id: string) =>
      Object.fromEntries(Object.entries(lines).filter(([k]) => k !== id));
    const fewerSpells = without(content.magicEffects.spells, 'smite-the-dead');
    const fewerArts = without(content.magicEffects.arts, 'armor-of-god');
    const broken = {
      ...content,
      magicEffects: {
        spells: { ...fewerSpells, 'no-such-spell': 'Does nothing.' },
        arts: { ...fewerArts, 'no-such-art': 'Does nothing.' },
      },
    };
    expect(magicEffectErrors(srd, broken)).toEqual([
      'magicEffects/spells: unknown spell no-such-spell',
      'magicEffects/arts: unknown art no-such-art',
      'magicEffects/spells: no line for smite-the-dead',
      'magicEffects/arts: no line for armor-of-god',
    ]);
  });

  it('needs no line for spells and arts the game leaves out', () => {
    const spell = content.spellRules.excluded[0] as string;
    const art = content.traditions.flatMap((t) => t.excludedArts)[0] as string;
    expect(spell in content.magicEffects.spells).toBe(false);
    expect(art in content.magicEffects.arts).toBe(false);
    expect(magicEffectErrors(srd, content)).toEqual([]);
  });
});
