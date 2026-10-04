import { describe, expect, it } from 'vitest';
import { enterDungeon, step, takeStairs } from '../../../src/game/dungeon/explore.ts';
import { heldHere } from '../../../src/game/dungeon/rescues.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { acceptQuest } from '../../../src/game/world/quest-board.ts';
import { freeCaptive } from '../../../src/game/world/rescue.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import type { World } from '../../../src/game/world/types.ts';
import { questTargets } from '../../../src/render/quest-view.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, encounter, world } from '../world/helpers.ts';
import { place, state } from './helpers.ts';

const QUEST = 'barrow-torc';
/** The starters take the barrow quest in Westhold, then go down. */
function questing(): World {
  const w = world();
  expect(acceptQuest(w, data, QUEST)).toEqual({ ok: true });
  w.position = { col: 5, row: 10 };
  enterDungeon(w, data);
  w.rng = createRng('delve');
  return w;
}
const stepOf = (w: World) => w.quests[QUEST]?.step;

describe('delve quest steps (docs/rules-adaptation.md, Dungeon exploration in Phase 8c)', () => {
  it('marks the dungeon entrance on the hex map while a delve step is current', () => {
    const w = world();
    acceptQuest(w, data, QUEST);
    expect(questTargets(w, data)).toEqual([{ col: 5, row: 10 }]);
  });

  it('reaches a level, beats its guardian, and takes the item home', () => {
    const w = questing();
    expect(stepOf(w)).toBe(0);
    place(w, 'barrow-upper', 9, 0, 'e');
    takeStairs(w, data);
    expect(stepOf(w)).toBe(1);
    expect(w.log.join('\n')).toContain('Destroy the golems guarding the east hall');

    place(w, 'barrow-lower', 6, 3, 'e');
    step(w, data, 'forward');
    expect(w.encounter).toMatchObject({ quest: QUEST, hostile: true });
    expect(w.encounter?.enemies).toEqual([['barrow-golem', 'barrow-golem']]);
    expect(w.log.at(-1)).toMatch(/The guardian is here\. .*\(The Lower Barrow 7,3\)$/);
    w.encounter = null;
    emit(w, data, { kind: 'fight-won', quest: QUEST, garrison: null });
    expect(stepOf(w)).toBe(2);

    place(w, 'barrow-upper', 5, 1, 'n');
    step(w, data, 'forward');
    expect(w.log.join('\n')).toContain("The party takes the barrow-king's torc.");
    expect(w.quests[QUEST]?.status).toBe('ready');
  });

  it('springs the guardian at once when its step comes up on its cell', () => {
    const w = questing();
    place(w, 'barrow-lower', 7, 3, 'n');
    emit(w, data, { kind: 'level-entered' });
    expect(stepOf(w)).toBe(1);
    expect(w.encounter?.quest).toBe(QUEST);
  });

  it('ignores other levels and cells, and overland slay steps underground', () => {
    const w = questing();
    place(w, 'barrow-lower', 0, 0, 's');
    w.quests[QUEST] = { ...(w.quests[QUEST] as NonNullable<World['quests'][string]>), step: 1 };
    emit(w, data, { kind: 'cell-entered' });
    expect(w.encounter).toBeNull();
    w.quests['bandit-camp'] = {
      ...(w.quests[QUEST] as NonNullable<World['quests'][string]>),
      step: 0,
    };
    emit(w, data, { kind: 'cell-entered' });
    expect(w.encounter).toBeNull();
  });

  it('counts a teleporter that crosses levels as reaching the new level', () => {
    // A variant barrow whose upper level has a teleporter down to the lower one.
    const portal = {
      ...data,
      content: {
        ...data.content,
        dungeons: data.content.dungeons.map((d) => ({
          ...d,
          levels: d.levels.map((l) =>
            l.id !== 'barrow-upper'
              ? l
              : {
                  ...l,
                  specials: [
                    ...l.specials,
                    {
                      kind: 'teleporter' as const,
                      at: { x: 1, y: 7 },
                      to: { level: 'barrow-lower', at: { x: 1, y: 1 }, facing: 's' as const },
                    },
                  ],
                },
          ),
        })),
      },
    };
    const w = questing();
    step(w, portal, 'forward');
    expect(state(w)).toMatchObject({ level: 'barrow-lower', at: { x: 1, y: 1 } });
    expect(stepOf(w)).toBe(1);
  });
});

describe('captives held in dungeons', () => {
  const atDoor = () => place(questing(), 'barrow-upper', 6, 1, 'n');

  it('are kept by guards met on their cell', () => {
    const w = atDoor();
    step(w, data, 'forward');
    expect(w.encounter).toMatchObject({ captive: 'grave-digger', hostile: true });
    expect(w.log.at(-1)).toMatch(/Two grave robbers .*\(The Upper Barrow 6,0\)$/);
    expect(heldHere(world(), data)).toBeUndefined();
  });

  it('are freed once per world, then the cell is quiet', () => {
    const w = atDoor();
    step(w, data, 'forward');
    w.encounter = null;
    freeCaptive(w, data, 'grave-digger');
    expect(w.rescues).toEqual(['old-barrow/barrow-upper/6,0']);
    expect(w.npcs.map((n) => n.type)).toContain('grave-digger');
    expect(heldHere(w, data)).toBeUndefined();
    step(w, data, 'back');
    step(w, data, 'forward');
    expect((w as World).encounter?.captive ?? null).toBeNull();
  });

  it('are not crossed off by another captive, or met again while a group waits', () => {
    const w = atDoor();
    step(w, data, 'forward');
    w.encounter = null;
    freeCaptive(w, data, 'merchant');
    expect(w.rescues).toEqual([]);
    w.encounter = encounter([['thug-or-militia']]);
    emit(w, data, { kind: 'cell-entered' });
    expect(w.encounter.captive).toBeNull();
  });

  it('survive a save, and upgrade from version 8 with no one freed', () => {
    const w = atDoor();
    w.rescues = ['old-barrow/barrow-upper/6,0'];
    const back = parseWorld(serializeWorld(w), data);
    expect(back.ok && back.world.rescues).toEqual(w.rescues);
    const save = JSON.parse(serializeWorld(world()));
    delete save.rescues;
    const old = parseWorld(JSON.stringify({ ...save, schemaVersion: 8 }), data);
    expect(old.ok && old.world.rescues).toEqual([]);
  });
});
