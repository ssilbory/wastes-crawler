import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/data/content.ts';
import { loadSrd } from '../src/data/load.ts';
import { mountReferenceErrors } from '../src/data/mount-check.ts';
import type { MountType } from '../src/data/schemas/index.ts';

const srd = loadSrd();
const content = loadContent();

/** The content with its mounts replaced, and the ride check's skill if given. */
const withMounts = (mounts: MountType[], skill = 'ride') => ({
  ...content,
  mountRules: { ...content.mountRules, mounts, ride: { ...content.mountRules.ride, skill } },
});

const elk = content.mountRules.mounts.find((t) => t.id === 'riding-elk') as MountType;

describe('mount content (docs/rules-adaptation.md, Mounts)', () => {
  it('has the riding, war, and pack mounts at SRD prices and loads', () => {
    expect(mountReferenceErrors(srd, content)).toEqual([]);
    expect(
      content.mountRules.mounts.map((t) => [t.id, t.role, t.price, t.loadRidden, t.loadUnridden]),
    ).toEqual([
      ['riding-elk', 'riding', 200, 5, 20],
      ['riding-aurochs', 'riding', 150, 5, 30],
      ['riding-goat', 'riding', 30, 3, 15],
      ['war-boar', 'war', 2000, 5, 20],
      ['pack-bison', 'pack', 150, 0, 30],
    ]);
  });

  it('names real monsters and skills, with riders only where they belong', () => {
    expect(
      mountReferenceErrors(
        srd,
        withMounts(
          [
            { ...elk, id: 'a', monster: 'pegasus', tameFrom: ['herd-beast', 'unicorn-x'] },
            { ...elk, id: 'b', role: 'pack' },
            { ...elk, id: 'c', riderSizes: [] },
            { ...elk, id: 'd', loadRidden: 30, tameFrom: ['herd-beast'] },
          ],
          'sail',
        ),
      ),
    ).toEqual([
      'mountRules/a: unknown monster pegasus',
      'mountRules/a: tames from unknown monster unicorn-x',
      'mountRules/b: a pack mount has no riders',
      'mountRules/c: needs riders',
      'mountRules/d: carries more ridden than unridden',
      'mountRules: herd-beast tames into more than one mount',
      'mountRules/ride: unknown skill sail',
    ]);
  });
});
