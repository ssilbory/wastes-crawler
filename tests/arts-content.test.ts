import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/data/content.ts';
import { loadSrd } from '../src/data/load.ts';
import { magicReferenceErrors } from '../src/data/magic-check.ts';

const srd = loadSrd();
const content = loadContent();

describe('arts for ten levels (Phase 15)', () => {
  it('leaves every arts table enough open arts for its picks', () => {
    expect(magicReferenceErrors(srd, content)).toEqual([]);
  });

  it('reports a table whose picks outrun the arts left open', () => {
    const healerArts = srd.arts.filter((a) => a.tradition === 'healer').map((a) => a.id);
    const starved = {
      ...content,
      traditions: content.traditions.map((t) =>
        t.id === 'healer'
          ? { ...t, excludedArts: healerArts.filter((id) => id !== 'healing-touch').slice(0, 9) }
          : t,
      ),
    };
    // Four arts stay open (Revive the Fallen from 8th); picks reach 5 by level 6.
    expect(magicReferenceErrors(srd, starved)).toEqual([
      'traditions/healer: healer-arts needs 5 arts by level 6, 4 open',
      'traditions/healer: healer-arts needs 5 arts by level 7, 4 open',
      'traditions/healer: healer-arts needs 6 arts by level 8, 4 open',
      'traditions/healer: healer-arts needs 6 arts by level 9, 4 open',
      'traditions/healer: healer-arts needs 7 arts by level 10, 4 open',
    ]);
  });
});
