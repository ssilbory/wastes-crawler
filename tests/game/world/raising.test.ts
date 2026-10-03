import { describe, expect, it } from 'vitest';
import { QuestSchema } from '../../../src/data/schemas/index.ts';
import {
  acceptQuest,
  cannotAccept,
  questBoard,
  standing,
  turnInQuest,
} from '../../../src/game/world/quest-board.ts';
import { questOf } from '../../../src/game/world/quests.ts';
import { offerRaising } from '../../../src/game/world/raising.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { enterTown } from '../../../src/game/world/town.ts';
import type { World } from '../../../src/game/world/types.ts';
import { rewardText } from '../../../src/render/quest-view.ts';
import { data, member, world } from './helpers.ts';

const WESTHOLD = { col: 3, row: 8 };
const EASTMARCH = { col: 20, row: 8 };

/** The party back in Westhold with Snag dead, offered the pilgrimage. */
function mourning(): World {
  const w = world();
  member(w, 'Snag').dead = true;
  w.position = WESTHOLD;
  enterTown(w, data, 'westhold');
  w.raising.offer = 'pilgrimage-highcairn';
  return w;
}

const ready = (w: World, id: string) => {
  w.quests[id] = { status: 'ready', step: 1, acceptedDay: w.day };
};

describe('raising quests (docs/rules-adaptation.md, Raising quests)', () => {
  it('are offered only while a PC is dead, drawn from the town’s priest', () => {
    const calm = world([]);
    calm.position = WESTHOLD;
    enterTown(calm, data, 'westhold');
    expect(calm.raising.offer).toBeNull();
    expect(questBoard(calm, data, 'sister-berit')).toEqual([]);

    const w = world([1]);
    member(w, 'Snag').dead = true;
    offerRaising(w, data, 'westhold');
    expect(w.raising.offer).toBe('saints-bone');
    expect(w.log.at(-1)).toContain(
      "Sister Berit has work that would raise the dead: The Saint's Finger-Bone.",
    );
    expect(questBoard(w, data, 'sister-berit').map((q) => q.id)).toEqual(['saints-bone']);
    expect(questBoard(w, data, 'reeve-halda')).toHaveLength(3);
  });

  it('keeps the offer standing in its town, and draws anew in another', () => {
    const w = world([0, 1]);
    member(w, 'Snag').dead = true;
    offerRaising(w, data, 'westhold');
    offerRaising(w, data, 'westhold');
    expect(w.raising.offer).toBe('pilgrimage-highcairn');
    offerRaising(w, data, 'eastmarch');
    expect(w.raising.offer).toBe('corpse-thieves');
  });

  it('draws nothing in a town with no priest', () => {
    const w = world([]);
    member(w, 'Snag').dead = true;
    const bare = {
      ...data,
      content: { ...data.content, missionGivers: [] },
    };
    offerRaising(w, bare, 'westhold');
    expect(w.raising.offer).toBeNull();
  });

  it('can be taken only as offered, and only while someone is dead', () => {
    const w = mourning();
    const pilgrimage = questOf(data, 'pilgrimage-highcairn');
    const bone = questOf(data, 'saints-bone');
    expect(cannotAccept(w, data, bone)).toBe('Not on offer.');
    expect(acceptQuest(w, data, 'saints-bone')).toEqual({ ok: false, reason: 'Not on offer.' });
    member(w, 'Snag').dead = false;
    expect(cannotAccept(w, data, pilgrimage)).toBe('No one in the party is dead.');
    expect(questBoard(w, data, 'sister-berit')).toEqual([]);
    member(w, 'Snag').dead = true;
    expect(cannotAccept(w, data, pilgrimage)).toBeNull();
    expect(acceptQuest(w, data, 'pilgrimage-highcairn')).toEqual({ ok: true });
    expect(w.npcs.map((n) => n.name)).toEqual(['a pilgrim']);
    expect(w.raising).toEqual({ offer: null, accepted: w.day });
    expect(cannotAccept(w, data, pilgrimage)).toBe('Already taken.');
    expect(questBoard(w, data, 'sister-berit').map((q) => q.id)).toEqual(['pilgrimage-highcairn']);
  });

  it('raise one chosen dead PC and pay nothing else', () => {
    const w = mourning();
    acceptQuest(w, data, 'pilgrimage-highcairn');
    member(w, 'Grukk').dead = true;
    Object.assign(member(w, 'Snag'), { pendingXp: 2 });
    ready(w, 'pilgrimage-highcairn');
    const purse = w.purse;
    expect(turnInQuest(w, data, 'pilgrimage-highcairn')).toEqual({
      ok: false,
      reason: 'Choose a dead PC to raise.',
    });
    expect(turnInQuest(w, data, 'pilgrimage-highcairn', member(w, 'Lirael').id)).toMatchObject({
      ok: false,
    });
    expect(turnInQuest(w, data, 'pilgrimage-highcairn', member(w, 'Snag').id)).toEqual({
      ok: true,
    });
    expect(member(w, 'Snag')).toMatchObject({ dead: false, pendingXp: 0 });
    expect(member(w, 'Snag').character).toMatchObject({ xp: 2, hp: { current: 1 } });
    expect(member(w, 'Grukk').dead).toBe(true);
    expect(member(w, 'Grukk').character.xp).toBe(0);
    expect(w.purse).toBe(purse);
    expect(w.loot).toEqual([]);
    expect(w.log.at(-1)).toContain('Sister Berit raises Snag for The Pilgrimage to Highcairn.');
    expect(standing(w, questOf(data, 'pilgrimage-highcairn'))).toBeUndefined();
  });

  it('come round at most once a month, counted from accepting', () => {
    const w = mourning();
    acceptQuest(w, data, 'pilgrimage-highcairn');
    // One under way blocks a new draw, even from another priest.
    w.position = EASTMARCH;
    enterTown(w, data, 'eastmarch');
    expect(w.raising.offer).toBeNull();
    ready(w, 'pilgrimage-highcairn');
    w.day += 30;
    offerRaising(w, data, 'eastmarch');
    expect(w.raising.offer).toBeNull();
    w.day -= 30;
    // Other quests under way don't matter.
    w.quests['bandit-camp'] = { status: 'active', step: 0, acceptedDay: w.day };
    w.quests['pilgrimage-highcairn'] = { status: 'failed', step: 0, acceptedDay: w.day };
    w.day += 29;
    offerRaising(w, data, 'eastmarch');
    expect(w.raising.offer).toBeNull();
    w.day += 1;
    w.rng = world([1]).rng;
    offerRaising(w, data, 'eastmarch');
    expect(w.raising.offer).toBe('corpse-thieves');
  });

  it('can be taken again once done or failed', () => {
    const w = mourning();
    w.quests['pilgrimage-highcairn'] = { status: 'done', step: 1, acceptedDay: 0 };
    expect(cannotAccept(w, data, questOf(data, 'pilgrimage-highcairn'))).toBeNull();
    expect(standing(w, questOf(data, 'bandit-camp'))).toBeUndefined();
  });

  it('describe their reward', () => {
    expect(rewardText(questOf(data, 'high-cairn'))).toBe('the temple raises one dead PC');
  });

  it('may pay nothing but the raising', () => {
    const q = questOf(data, 'high-cairn');
    expect(QuestSchema.safeParse(q).success).toBe(true);
    const greedy = { ...q, reward: { ...q.reward, crowns: 5 } };
    expect(QuestSchema.safeParse(greedy).error?.issues[0]?.message).toBe(
      'a raising quest pays nothing but the raising',
    );
  });

  it('save the offer and the last day one was taken, and older saves start with none', () => {
    const w = mourning();
    acceptQuest(w, data, 'pilgrimage-highcairn');
    const back = parseWorld(serializeWorld(w), data);
    expect(back.ok && back.world.raising).toEqual(w.raising);
    const save = JSON.parse(serializeWorld(w));
    delete save.raising;
    save.schemaVersion = 9;
    const old = parseWorld(JSON.stringify(save), data);
    expect(old.ok && old.world.raising).toEqual({ offer: null, accepted: null });
  });
});
