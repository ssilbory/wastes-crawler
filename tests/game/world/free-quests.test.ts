import { describe, expect, it } from 'vitest';
import { reclaim } from '../../../src/game/factions/capture.ts';
import { emit } from '../../../src/game/world/bus.ts';
import {
  freeQuest,
  freeQuestId,
  freeQuestsFrom,
  parseFreeId,
} from '../../../src/game/world/free-quests.ts';
import {
  acceptQuest,
  cannotAccept,
  questBoard,
  turnInQuest,
} from '../../../src/game/world/quest-board.ts';
import { questOf } from '../../../src/game/world/quests.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import type { World } from '../../../src/game/world/types.ts';
import { questTarget } from '../../../src/render/quest-view.ts';
import { data, member } from './helpers.ts';
import { heldTown } from './siege-helpers.ts';

const CINDERHOLD = { col: 6, row: 12 };
const ID = freeQuestId('lanternfall', 'elder-gorvash');

/** Lanternfall held by the warhost, the party in Cinderhold. */
function atCouncil(): World {
  const w = heldTown(CINDERHOLD);
  w.purse = 0;
  return w;
}

/** The warhost driven out of Lanternfall, leaving it to be freed. */
function driveOut(w: World): void {
  const s = w.factions.warhost;
  if (s) s.bases = s.bases.filter((b) => b.at !== 'lanternfall');
}

describe('quests to free a held settlement (docs/rules-adaptation.md, Sieges; Phase 23e)', () => {
  it('names its town and giver in its id', () => {
    expect(ID).toBe('free-lanternfall-by-elder-gorvash');
    expect(parseFreeId(data, ID)).toEqual({ town: 'lanternfall', giver: 'elder-gorvash' });
    expect(parseFreeId(data, 'free-lanternfall-by-nobody')).toBeNull();
    expect(parseFreeId(data, 'free-atlantis-by-elder-gorvash')).toBeNull();
    expect(parseFreeId(data, 'pit-bones')).toBeNull();
  });

  it('is built from the content’s template, paid by the settlement’s size', () => {
    expect(freeQuest(data, ID)).toMatchObject({
      name: 'Free Lanternfall',
      giver: 'elder-gorvash',
      objectives: [
        {
          kind: 'free',
          town: 'lanternfall',
          text: "Free Lanternfall: storm it, or fight in the Free Settlements' siege of it.",
        },
      ],
      reward: { crowns: 100, xp: 3, loot: [] },
    });
    expect(freeQuest(data, freeQuestId('gutterwick', 'elder-gorvash'))?.reward).toMatchObject({
      crowns: 200,
      xp: 4,
    });
    expect(freeQuest(data, 'pit-bones')).toBeNull();
    expect(questOf(data, ID).name).toBe('Free Lanternfall');
    expect(() => questOf(data, 'ghost')).toThrow('unknown quest ghost');
  });

  it('is offered by every giver in the ally’s free settlements while a town is held', () => {
    const w = atCouncil();
    expect(questBoard(w, data, 'elder-gorvash').map((q) => q.id)).toContain(ID);
    expect(freeQuestsFrom(w, data, 'mother-skrell').map((q) => q.id)).toEqual([
      freeQuestId('lanternfall', 'mother-skrell'),
    ]);
    // Nothing held, nothing offered; nor by a giver whose own town is held, or on another map.
    driveOut(w);
    expect(freeQuestsFrom(w, data, 'elder-gorvash')).toEqual([]);
    const cinder = atCouncil();
    const free = cinder.factions.settlements;
    if (free) free.bases = free.bases.filter((b) => b.at !== 'cinderhold');
    expect(freeQuestsFrom(cinder, data, 'elder-gorvash')).toEqual([]);
    expect(freeQuestsFrom(atCouncil(), data, 'old-hesk')).toEqual([]);
  });

  it('is taken from one giver only, and stays on that giver’s board until paid', () => {
    const w = atCouncil();
    expect(acceptQuest(w, data, ID)).toEqual({ ok: true });
    const other = freeQuestId('lanternfall', 'necromancer-vashti');
    expect(questBoard(w, data, 'necromancer-vashti').map((q) => q.id)).not.toContain(other);
    expect(cannotAccept(w, data, questOf(data, other))).toBe('No longer offered.');
    expect(questBoard(w, data, 'elder-gorvash').map((q) => q.id)).toContain(ID);
  });

  it('is done when the town is freed with the party’s part, and pays its giver’s reward', () => {
    const w = atCouncil();
    acceptQuest(w, data, ID);
    driveOut(w);
    expect(reclaim(w, data, 'lanternfall', true)).toBe(true);
    expect(w.renown).toBe(2);
    expect(w.quests[ID]?.status).toBe('ready');
    expect(questTarget(w, data, ID)).toEqual(CINDERHOLD);
    expect(turnInQuest(w, data, ID)).toEqual({ ok: true });
    expect(w.purse).toBe(100);
    expect(member(w, 'Snag').character.xp).toBeGreaterThanOrEqual(3);
    // Held again, it can be taken again.
    w.factions.warhost?.bases.push({ at: 'lanternfall', hp: 1, max: 2 });
    const free = w.factions.settlements;
    if (free) free.bases = free.bases.filter((b) => b.at !== 'lanternfall');
    expect(cannotAccept(w, data, questOf(data, ID))).toBeNull();
  });

  it('fails when the town is freed without the party, and stands when it changes hands', () => {
    const w = atCouncil();
    acceptQuest(w, data, ID);
    // The step's town on the map.
    expect(questTarget(w, data, ID)).toEqual({ col: 10, row: 4 });
    driveOut(w);
    w.factions.bastion?.bases.push({ at: 'lanternfall', hp: 1, max: 2 });
    emit(w, data, { kind: 'day-passed' });
    expect(w.quests[ID]?.status).toBe('active');
    // Another town freed is none of its business.
    emit(w, data, { kind: 'town-freed', town: 'mirewatch', party: false });
    expect(w.quests[ID]?.status).toBe('active');
    const b = w.factions.bastion;
    if (b) b.bases = b.bases.filter((x) => x.at !== 'lanternfall');
    reclaim(w, data, 'lanternfall');
    expect(w.quests[ID]?.status).toBe('failed');
    expect(w.log.at(-1)).toContain(
      'Free Lanternfall has failed: Lanternfall was freed without the party.',
    );
    expect(w.renown).toBe(0);
  });

  it('keeps a freeing quest through a save', () => {
    const w = atCouncil();
    acceptQuest(w, data, ID);
    const back = parseWorld(serializeWorld(w), data);
    if (!back.ok) throw new Error(back.errors.join('; '));
    expect(back.world.quests[ID]).toEqual(w.quests[ID]);
  });
});
