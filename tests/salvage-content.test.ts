import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/data/content.ts';
import { loadSrd } from '../src/data/load.ts';
import { salvageReferenceErrors } from '../src/data/salvage-check.ts';

const content = loadContent();
const srd = loadSrd();

describe('salvage content', () => {
  it('loads clean', () => {
    expect(salvageReferenceErrors(srd, content)).toEqual([]);
  });

  it('reports a part that is not scrap of its type, unknown items, and yields with no part', () => {
    const { salvage } = content.craftingRules;
    const broken = {
      ...content,
      craftingRules: {
        ...content.craftingRules,
        salvage: {
          parts: { metal: 'cold-iron', wood: 'scrap-iron', hide: 'nothing' },
          yields: {
            ...salvage.yields,
            'moon-lance': { type: 'metal' as const, amount: 1 },
            'healers-pouch': { type: 'gem' as const, amount: 0.25 },
          },
        },
      },
    };
    expect(salvageReferenceErrors(srd, broken)).toEqual([
      'craftingRules: salvaged metal must be a scrap metal component, not cold-iron',
      'craftingRules: salvaged wood must be a scrap wood component, not scrap-iron',
      'craftingRules: salvaged hide must be a scrap hide component, not nothing',
      'craftingRules: salvage from unknown item moon-lance',
      'craftingRules: healers-pouch salvages to gem, which has no part',
    ]);
  });
});
