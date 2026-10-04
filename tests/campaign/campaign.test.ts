// Phase 12 exit: the Command authority campaign is playable start to finish (docs/plan.md). A
// headless party takes the road into the Dark Lands, works through every quest in the chain by
// walking each dungeon's real map and fighting with the combat engine, burns the crafter's notes,
// and decides the Seal of Command's fate. Between quests it rests at the inn and is trained to the
// next quest's minimum level plus one, standing in for side delves; the economy and the road
// between towns have their own checks.
import { describe, expect, it } from 'vitest';
import { crossOver } from '../../src/game/world/crossing.ts';
import { burnNotes, pendingNotes } from '../../src/game/world/notes.ts';
import { acceptQuest, turnInQuest } from '../../src/game/world/quest-board.ts';
import { questOf } from '../../src/game/world/quests.ts';
import { decideSeal, epilogue } from '../../src/game/world/seal.ts';
import type { World } from '../../src/game/world/types.ts';
import { createRng } from '../../src/rules/rng.ts';
import { data, world } from '../game/world/helpers.ts';
import { attempt, delve, settle, stairs, townRest, walkTo } from './driver.ts';

const DARK = 'dark-lands';
const CINDERHOLD = { id: 'cinderhold', col: 6, row: 12 };

/** Takes a quest from Elder Gorvash, trained to its minimum level plus one. */
function take(w: World, quest: string): void {
  townRest(w, data, DARK, CINDERHOLD, questOf(data, quest).prerequisites.minLevel + 1);
  expect(acceptQuest(w, data, quest)).toEqual({ ok: true });
}

function turnIn(w: World, quest: string): void {
  townRest(w, data, DARK, CINDERHOLD, 1);
  expect(w.quests[quest]?.status).toBe('ready');
  expect(turnInQuest(w, data, quest)).toEqual({ ok: true });
  expect(w.quests[quest]?.status).toBe('done');
}

describe('the Command authority campaign (Phase 12 exit)', () => {
  it('is playable from the Borderlands to the Seal of Command', () => {
    const w = world();
    w.rng = createRng('campaign');
    const tries: Record<string, number> = {};

    // The east road into the Dark Lands.
    w.position = { col: 23, row: 8 };
    expect(crossOver(w, data)).toEqual({ ok: true });
    expect(w.region).toBe(DARK);

    // 1. The Ashgate Rolls: through the Outer Ward's posts to the undervault archive.
    take(w, 'ashgate-rolls');
    tries.ashgate = attempt(w, data, CINDERHOLD, () => {
      delve(w, data, DARK, { col: 22, row: 12 });
      stairs(w, data, { x: 7, y: 0 });
      expect(w.quests['ashgate-rolls']?.step).toBe(1);
      walkTo(w, data, { x: 7, y: 7 });
      expect(w.countersigns).toContain('ashgate-hold');
      walkTo(w, data, { x: 0, y: 0 });
      settle(w, data);
      stairs(w, data, { x: 7, y: 0 });
      stairs(w, data, { x: 4, y: 9 });
    });
    turnIn(w, 'ashgate-rolls');

    // 2. The Cull Records: down through the Mire Vats to the cull pit and the records behind it.
    take(w, 'cull-records');
    tries.vats = attempt(w, data, CINDERHOLD, () => {
      delve(w, data, DARK, { col: 17, row: 22 });
      stairs(w, data, { x: 9, y: 7 });
      walkTo(w, data, { x: 1, y: 1 });
      expect(w.notes['vats-notes']).toBeDefined();
      if (pendingNotes(w).length > 0)
        expect(burnNotes(w, data, 'vats-notes')).toEqual({ ok: true });
      stairs(w, data, { x: 0, y: 9 });
      walkTo(w, data, { x: 5, y: 2 });
      settle(w, data);
      walkTo(w, data, { x: 7, y: 7 });
      stairs(w, data, { x: 0, y: 0 });
      stairs(w, data, { x: 9, y: 0 });
      stairs(w, data, { x: 0, y: 7 });
    });
    turnIn(w, 'cull-records');

    // 3. The Lieutenant's Seal: the token stands the bunker down; Vael bars the vault.
    take(w, 'lieutenants-seal');
    tries.bunker = attempt(w, data, CINDERHOLD, () => {
      delve(w, data, DARK, { col: 20, row: 2 });
      walkTo(w, data, { x: 3, y: 4 });
      expect(w.authority).toContain('lieutenants-token');
      stairs(w, data, { x: 9, y: 7 });
      walkTo(w, data, { x: 0, y: 0 });
      settle(w, data);
      expect(w.authority).toContain('seal-of-command');
      stairs(w, data, { x: 7, y: 7 });
      stairs(w, data, { x: 0, y: 0 });
    });
    turnIn(w, 'lieutenants-seal');

    // 4. The Warlord Falls: Grisk's notes, then Grisk on his throne.
    take(w, 'warlord-falls');
    tries.hold = attempt(w, data, CINDERHOLD, () => {
      delve(w, data, DARK, { col: 2, row: 21 });
      stairs(w, data, { x: 2, y: 0 });
      walkTo(w, data, { x: 0, y: 6 });
      if (pendingNotes(w).length > 0)
        expect(burnNotes(w, data, 'grisk-notes')).toEqual({ ok: true });
      stairs(w, data, { x: 9, y: 7 });
      walkTo(w, data, { x: 3, y: 1 });
      settle(w, data);
      expect(w.quests['warlord-falls']?.status).toBe('ready');
      stairs(w, data, { x: 7, y: 7 });
      stairs(w, data, { x: 0, y: 0 });
      stairs(w, data, { x: 4, y: 9 });
    });
    turnIn(w, 'warlord-falls');

    // The ending.
    expect(decideSeal(w, data, 'cinderhold', 'destroy')).toEqual({ ok: true });
    expect(w.ending).toBe('destroy');
    expect(epilogue(w, data)).toContain("The seal cracks in Cinderhold's forge fire.");
    expect(w.notes).toEqual({ 'vats-notes': 'burned', 'grisk-notes': 'burned' });
    // Each dungeon fell within three tries.
    expect(Object.keys(tries)).toEqual(['ashgate', 'vats', 'bunker', 'hold']);
    expect(Object.values(tries).every((n) => n <= 3)).toBe(true);
  });
});
