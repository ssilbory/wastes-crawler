import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addOnce,
  parseArtsGained,
  parseFocusPicks,
} from '../tools/srd-extract/extractors/classes.ts';
import { cleanInline, parseTables, slug } from '../tools/srd-extract/markdown.ts';
import { SrdReader, type Erratum } from '../tools/srd-extract/reader.ts';
import { crossReferenceErrors } from '../tools/srd-extract/validate.ts';
import { loadSrd } from '../src/data/load.ts';
import { SrdSchemas } from '../src/data/schemas/index.ts';

function vendorWith(text: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'srd-'));
  writeFileSync(join(dir, 'a.md'), text);
  return dir;
}

const erratum = (find: string, replace: string): Erratum => ({
  file: 'a.md',
  find,
  replace,
  pdfPage: 1,
  note: 'test',
});

describe('SrdReader', () => {
  it('applies errata in memory, with CRLF sources and $ in replacements', () => {
    const reader = new SrdReader(vendorWith('# A\r\ncost 1 sp\r\n'), [
      erratum('cost 1 sp', 'cost $10 sp'),
    ]);
    expect(reader.doc('a.md').lines).toContain('cost $10 sp');
    expect(reader.unusedErrata()).toEqual([]);
  });

  it('rejects an erratum that matches zero or several times', () => {
    const root = vendorWith('x x');
    expect(() => new SrdReader(root, [erratum('y', 'z')]).doc('a.md')).toThrow(/0 times/);
    expect(() => new SrdReader(root, [erratum('x', 'z')]).doc('a.md')).toThrow(/2 times/);
  });

  it('reports errata for files that were never read', () => {
    const e = { ...erratum('x', 'y'), file: 'b.md' };
    expect(new SrdReader(vendorWith('x'), [e]).unusedErrata()).toEqual([e]);
  });
});

describe('markdown edge cases', () => {
  it('fails loudly when a blank line splits a table', () => {
    expect(() => parseTables(['| A | B |', '| - | - |', '| 1 | 2 |', '', '| 3 | 4 |'])).toThrow(
      /split/,
    );
    expect(parseTables(['| A |', '| - |', '| 1 |', '', '| B |', '| - |', '| 2 |'])).toHaveLength(2);
  });

  it('strips underscore emphasis but not underscores inside words', () => {
    expect(cleanInline('as per _Extirpate Arcana_, see snake_case')).toBe(
      'as per Extirpate Arcana, see snake_case',
    );
  });

  it('drops accents from slugs', () => {
    expect(slug('Résumé')).toBe('resume');
  });
});

describe('class table cells', () => {
  it('merges focus picks by category in a fixed order', () => {
    expect(parseFocusPicks('1 Expert<br> +1 Warrior<br> +1 Any', 'x')).toEqual([
      { count: 1, category: 'warrior' },
      { count: 1, category: 'expert' },
      { count: 1, category: 'any' },
    ]);
    expect(parseFocusPicks('', 'x')).toEqual([]);
    expect(() => parseFocusPicks('+1 One', 'x')).toThrow(/bad focus pick/);
  });

  it('splits named arts from free picks', () => {
    expect(parseArtsGained('Elemental Resilience, Elemental Sparks, and Any One')).toEqual({
      arts: ['elemental-resilience', 'elemental-sparks'],
      anyArts: 1,
    });
    expect(parseArtsGained('Any Two')).toEqual({ arts: [], anyArts: 2 });
    expect(() => parseArtsGained('Any Seven')).toThrow();
  });

  it('merges identical duplicate tables and rejects differing ones', () => {
    const src = (file: string) => [{ file, heading: 'h' }];
    const list = [{ id: 'p', sources: src('a'), levels: [1] }];
    const seen = new Map([['p', JSON.stringify([1])]]);
    addOnce(list, seen, { id: 'p', sources: src('b'), levels: [1] });
    expect(list[0]?.sources).toHaveLength(2);
    expect(() => addOnce(list, seen, { id: 'p', sources: src('c'), levels: [2] })).toThrow(
      /differs/,
    );
  });
});

describe('schemas and cross-references', () => {
  const srd = loadSrd();

  it('rejects empty files and unknown keys', () => {
    expect(SrdSchemas.monsters.safeParse([]).success).toBe(false);
    expect(SrdSchemas.armor.safeParse([{ ...srd.armor[0], extra: 1 }]).success).toBe(false);
  });

  it('reports unknown trait and art references and out-of-order levels', () => {
    const [weapon] = srd.weapons;
    const [casting] = srd['casting-progressions'];
    const [progression] = srd.progressions;
    if (!weapon || !casting || !progression) throw new Error('missing data');
    const broken = {
      ...srd,
      weapons: [{ ...weapon, traits: ['nope'] }],
      'casting-progressions': [
        {
          ...casting,
          levels: casting.levels.map((l, i) => (i === 0 ? { ...l, arts: ['nope'] } : l)),
        },
      ],
      progressions: [{ ...progression, levels: [...progression.levels].reverse() }],
      armor: [...srd.armor, ...srd.armor.slice(0, 1)],
    };
    expect(crossReferenceErrors(broken)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/unknown trait nope/),
        expect.stringMatching(/unknown art nope/),
        expect.stringMatching(/level 10 at row 1/),
        expect.stringMatching(/armor: duplicate id/),
      ]),
    );
  });
});
