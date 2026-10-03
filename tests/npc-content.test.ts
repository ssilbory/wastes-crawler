import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/data/content.ts';
import { loadSrd } from '../src/data/load.ts';
import { npcReferenceErrors } from '../src/data/npc-check.ts';

const srd = loadSrd();
const content = loadContent();

describe('NPC content', () => {
  it('loads SRD hirelings, captives bound for real towns, and a mind for every monster', () => {
    expect(npcReferenceErrors(srd, content)).toEqual([]);
    expect(content.npcRules.hirelings.map((h) => [h.id, h.wage])).toEqual([
      ['guard', 2],
      ['veteran-sellsword', 10],
      ['mage-of-minor-abilities', 200],
      ['wilderness-guide', 10],
      ['porter', 5],
      ['mundane-physician', 10],
    ]);
    expect(content.monsterCombat.every((m) => m.mind)).toBe(true);
  });

  it('reports unknown monsters, towns, tiers, and captives', () => {
    const [guard] = content.npcRules.hirelings;
    const [merchant] = content.captives;
    const [plains] = content.encounterTables;
    if (!guard || !merchant || !plains) throw new Error('missing content');
    const broken = {
      ...content,
      npcRules: {
        ...content.npcRules,
        hirelings: [{ ...guard, monster: 'dragon' }],
        moraleTiers: ['grim'],
      },
      captives: [{ ...merchant, monster: 'dragon', destination: 'atlantis' }],
      encounterTables: [
        {
          ...plains,
          entries: [{ ...(plains.entries[0] as (typeof plains.entries)[0]), captive: 'prince' }],
        },
      ],
    };
    expect(npcReferenceErrors(srd, broken)).toEqual([
      'npcRules/guard: unknown monster dragon',
      'npcRules: unknown XP tier grim',
      'captives/merchant: unknown monster dragon',
      'captives/merchant: unknown town atlantis',
      'encounterTables/plains: unknown captive prince',
    ]);
  });
});
