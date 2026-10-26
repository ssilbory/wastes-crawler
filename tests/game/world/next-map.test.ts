// Letters of introduction to the next map (docs/rules-adaptation.md, Quests in Phase 6): offered once
// the party has outgrown a region, and paid for by the giver they are addressed to.
import { describe, expect, it } from 'vitest';
import { questReferenceErrors } from '../../../src/data/quest-check.ts';
import type { Quest } from '../../../src/data/schemas/index.ts';
import { loadSrd } from '../../../src/data/load.ts';
import {
  acceptQuest,
  cannotAccept,
  questBoard,
  turnInQuest,
} from '../../../src/game/world/quest-board.ts';
import { payerName, questOf } from '../../../src/game/world/quests.ts';
import { enterTown } from '../../../src/game/world/town.ts';
import type { World } from '../../../src/game/world/types.ts';
import { data, world } from './helpers.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';

const levelled = (w: World, level: number) => {
  for (const m of w.members)
    m.character = {
      ...m.character,
      classes: { ...m.character.classes, levels: { [m.character.classes.current]: level } },
    };
  return w;
};

describe('the road to the next map', () => {
  it('waits until the party has outgrown the Borderlands', () => {
    const w = world();
    expect(cannotAccept(w, data, questOf(data, 'east-road'))).toBe('Needs a party of level 3.');
    levelled(w, 3);
    expect(cannotAccept(w, data, questOf(data, 'east-road'))).toBeNull();
  });

  it('is delivered in Cinderhold and paid for by Elder Gorvash, not Reeve Halda', () => {
    const w = levelled(world(), 3);
    expect(acceptQuest(w, data, 'east-road')).toEqual({ ok: true });
    expect(w.log.at(-1)).toContain("They carry Reeve Halda's letter to Elder Gorvash.");
    expect(questBoard(w, data, 'elder-gorvash').map((q) => q.id)).toContain('east-road');
    enterRegion(w, 'dark-lands', { col: 6, row: 12 });
    enterTown(w, data, 'cinderhold');
    expect(w.quests['east-road']?.status).toBe('ready');
    expect(
      w.log.some((l) => l.includes('Return to Elder Gorvash in Cinderhold (6,12) for the reward.')),
    ).toBe(true);
    const purse = w.purse;
    expect(turnInQuest(w, data, 'east-road')).toEqual({ ok: true });
    expect(w.purse).toBe(purse + 50);
    expect(w.log.at(-1)).toContain('Elder Gorvash pays for The East Road');
    // Once paid for, it leaves the payer's board.
    expect(questBoard(w, data, 'elder-gorvash').map((q) => q.id)).not.toContain('east-road');
  });

  it('is not paid by the giver who offered it', () => {
    const w = levelled(world(), 3);
    acceptQuest(w, data, 'east-road');
    (w.quests['east-road'] as { status: string }).status = 'ready';
    expect(turnInQuest(w, data, 'east-road')).toEqual({
      ok: false,
      reason: "Elder Gorvash isn't here.",
    });
  });

  it('leads from the Dark Lands up the Throne Road to Archivist Sefa', () => {
    const q = questOf(data, 'throne-road');
    expect([q.giver, payerName(data, q), q.prerequisites.minLevel]).toEqual([
      'foreman-tikka',
      'Archivist Sefa',
      5,
    ]);
    expect(q.objectives).toMatchObject([{ kind: 'deliver', to: 'saltwick' }]);
  });

  it('checks the payer', () => {
    const base = questOf(data, 'east-road');
    const odd: Quest[] = [
      { ...base, id: 'a', payer: 'nobody' },
      { ...base, id: 'b', payer: base.giver },
    ];
    expect(
      questReferenceErrors(loadSrd(), {
        ...data.content,
        quests: [...data.content.quests, ...odd],
      }),
    ).toEqual(['quests/a: unknown payer nobody', 'quests/b: the giver already pays']);
  });
});
