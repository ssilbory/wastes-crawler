import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/data/content.ts';
import { loadSrd } from '../src/data/load.ts';
import { travelReferenceErrors } from '../src/data/travel-check.ts';

const srd = loadSrd();
const content = loadContent();

describe('coach and arena content', () => {
  it('loads a road between real towns and an arena card per town', () => {
    expect(travelReferenceErrors(srd, content)).toEqual([]);
    expect(content.arenaCards.map((c) => c.town)).toEqual(['westhold', 'eastmarch', 'highcairn']);
  });

  it('reports unknown towns and monsters, empty routes, and doubled cards', () => {
    const [route] = content.coachRoutes;
    const [card] = content.arenaCards;
    if (!route || !card) throw new Error('missing content');
    const broken = {
      ...content,
      coachRoutes: [
        { ...route, towns: ['westhold', 'atlantis'] as [string, string] },
        { ...route, id: 'loop', towns: ['westhold', 'westhold'] as [string, string] },
      ],
      arenaCards: [
        card,
        {
          ...card,
          town: 'atlantis',
          bouts: [{ ...(card.bouts[0] as (typeof card.bouts)[0]), enemies: [['dragon']] }],
        },
        card,
      ],
    };
    expect(travelReferenceErrors(srd, broken)).toEqual([
      'coachRoutes/west-road: unknown town atlantis',
      'coachRoutes/loop: goes nowhere',
      'arenaCards: unknown town atlantis',
      'arenaCards/atlantis/militia-pair: unknown monster dragon',
      'arenaCards: two cards for one town',
    ]);
  });
});
