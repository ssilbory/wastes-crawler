import { describe, expect, it } from 'vitest';
import {
  cleanInline,
  parseBullets,
  parseDoc,
  parseTables,
  proseText,
  sectionLines,
  slug,
} from '../tools/srd-extract/markdown.ts';
import { parseCost, parseDice, parseSigned } from '../tools/srd-extract/parse-values.ts';

describe('parseDoc', () => {
  it('strips front matter and indexes headings', () => {
    const doc = parseDoc('x.md', '---\ntitle: X\n---\n# One\ntext\n## Two\nmore\n');
    expect(doc.headings.map((h) => [h.level, h.text])).toEqual([
      [1, 'One'],
      [2, 'Two'],
    ]);
    const one = doc.headings[0];
    expect(one && sectionLines(doc, one)).toEqual(['text']);
    expect(one && sectionLines(doc, one, true)).toEqual(['text', '## Two', 'more', '']);
  });
});

describe('parseTables', () => {
  it('reads cells, skips the alignment row and blank rows, and unescapes', () => {
    const tables = parseTables([
      '| Item | Enc |',
      '| ---- | --: |',
      '| Candle | \\* |',
      '|        |    |',
      '| Picks | 1 Any<br>+1 Warrior |',
      '',
      'not a table',
    ]);
    expect(tables).toEqual([
      {
        header: ['Item', 'Enc'],
        rows: [
          ['Candle', '*'],
          ['Picks', '1 Any<br>+1 Warrior'],
        ],
      },
    ]);
  });
});

describe('cleanInline', () => {
  it('drops links, Liquid tags, and bold, and splits joined sentences', () => {
    expect(cleanInline('See [Foci]({% link 1.6.0 Foci.md %}) and **Alert**.Then more.')).toBe(
      'See Foci and Alert. Then more.',
    );
  });

  it('leaves decimals alone', () => {
    expect(cleanInline('Section 1.5 applies.')).toBe('Section 1.5 applies.');
  });
});

describe('proseText and parseBullets', () => {
  it('joins wrapped lines into paragraphs', () => {
    expect(proseText(['a', 'b', '', 'c'])).toBe('a b\n\nc');
  });

  it('reads bullets with indented continuation lines', () => {
    expect(
      parseBullets(['- **Arcane Lexicon**: Commit Effort.', '  More text.', '- **Other**: x']),
    ).toEqual([
      { name: 'Arcane Lexicon', text: 'Commit Effort. More text.' },
      { name: 'Other', text: 'x' },
    ]);
  });
});

describe('value parsers', () => {
  it('parses dice, costs, and signed numbers', () => {
    expect(parseDice('10d6-10')).toEqual({ count: 10, sides: 6, modifier: -10 });
    expect(parseDice('1d8')).toEqual({ count: 1, sides: 8, modifier: 0 });
    expect(parseCost('10,000 sp')).toEqual({ amount: 10000, unit: 'sp' });
    expect(parseCost('-')).toBeNull();
    expect(parseSigned('+12')).toBe(12);
    expect(parseSigned('-1')).toBe(-1);
  });

  it('rejects malformed values', () => {
    expect(() => parseDice('2d')).toThrow();
    expect(() => parseCost('ten sp')).toThrow();
  });

  it('slugs names with curly apostrophes and commas', () => {
    expect(slug('Veteran’s Luck')).toBe('veterans-luck');
    expect(slug('Axe, Hand')).toBe('axe-hand');
  });
});
