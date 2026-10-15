import { describe, expect, it } from 'vitest';
import pkg from '../../package.json' with { type: 'json' };
import { noticeParagraphs, SHIPPED, storageNote } from '../../src/render/about-view.ts';

describe('about view', () => {
  it('lists every shipped dependency, and only those', () => {
    expect(SHIPPED.map((d) => d.name).sort()).toEqual(Object.keys(pkg.dependencies).sort());
  });

  it('splits NOTICE into paragraphs, dropping the title and rewrapping lines', () => {
    const text = 'Wastes Crawler\n\nFirst line\nwraps here.\r\n\r\nSecond.\n\n\n';
    expect(noticeParagraphs(text)).toEqual(['First line wraps here.', 'Second.']);
  });

  it('gives no paragraphs for a title alone or an empty file', () => {
    expect(noticeParagraphs('Wastes Crawler\n')).toEqual([]);
    expect(noticeParagraphs('')).toEqual([]);
  });

  it('explains each storage answer', () => {
    expect(storageNote(true)).toMatch(/agreed to keep/);
    expect(storageNote(false)).toMatch(/may clear/);
    expect(storageNote(null)).toMatch(/does not say/);
  });
});
