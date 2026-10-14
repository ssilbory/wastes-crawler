import { describe, expect, it } from 'vitest';
import {
  dungeonHere,
  dungeonOf,
  enterDungeon,
  levelOf,
  stairsHere,
  step,
  takeStairs,
  turnParty,
} from '../../../src/game/dungeon/explore.ts';
import { passQuarter } from '../../../src/game/world/quarter.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import type { World } from '../../../src/game/world/types.ts';
import { data, encounter, world } from '../world/helpers.ts';

const entrance = { col: 5, row: 10 };
function below(): World {
  const w = world();
  w.position = { ...entrance };
  w.destination = { col: 9, row: 9 };
  expect(enterDungeon(w, data)).toEqual({ ok: true });
  return w;
}
const walk = (w: World, ...steps: Parameters<typeof step>[2][]) =>
  steps.map((s) => step(w, data, s).ok);

describe('dungeon entrances (docs/rules-adaptation.md, Dungeons in Phase 7)', () => {
  it('finds the dungeon at the party’s hex', () => {
    const w = world();
    expect(dungeonHere(w, data)).toBeUndefined();
    w.position = { ...entrance };
    expect(dungeonHere(w, data)?.name).toBe('The Old Barrow');
    expect(() => dungeonOf(data, 'tomb')).toThrow('unknown dungeon tomb');
    expect(() => levelOf(data, 'old-barrow', 'cellar')).toThrow('unknown level cellar');
  });

  it('goes down for a quarter day, standing on the entry facing its way', () => {
    const w = below();
    expect(w.dungeon).toEqual({
      dungeon: 'old-barrow',
      level: 'barrow-upper',
      at: { x: 1, y: 8 },
      facing: 'n',
      seen: { 'barrow-upper': ['1,8', '1,7', '1,6', '1,5'] },
      turn: 0,
      steps: 0,
      found: {},
      dug: {},
      sight: null,
      sensed: {},
      glimpsed: {},
      traps: {},
      read: {},
    });
    expect(w).toMatchObject({ quarter: 1, destination: null });
    expect(w.log.slice(-4)).toEqual([
      'Day 1, morning: The party goes down into The Old Barrow.',
      'Day 1, morning: The party takes 2 torches from its kits.',
      'Day 1, morning: A torch is lit.',
      'Day 1, morning: The party reaches The Upper Barrow.',
    ]);
    expect(passQuarter(w, data, { kind: 'camp', activities: {} })).toBe(false);
    expect(enterDungeon(w, data)).toEqual({
      ok: false,
      reason: 'The party is already underground.',
    });
  });

  it('refuses without an entrance, mid-encounter, or aboard a coach', () => {
    const w = world();
    expect(enterDungeon(w, data)).toEqual({ ok: false, reason: 'There is no way down here.' });
    w.position = { ...entrance };
    w.encounter = encounter([['thug-or-militia']]);
    expect(enterDungeon(w, data)).toMatchObject({ ok: false });
    w.encounter = null;
    w.coach = { route: 'west-road', to: 'eastmarch', path: [], checkedDay: null };
    expect(enterDungeon(w, data)).toEqual({ ok: false, reason: 'The party is on a coach.' });
  });
});

describe('moving on the grid', () => {
  it('steps and turns, stopped by walls', () => {
    const w = below();
    expect(walk(w, 'forward', 'forward', 'forward', 'forward', 'forward')).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(w.dungeon?.at).toEqual({ x: 1, y: 3 });
    turnParty(w, data, 'left');
    expect(w.dungeon?.facing).toBe('w');
    expect(step(w, data, 'forward')).toEqual({ ok: false, reason: 'A wall blocks the way.' });
    expect(walk(w, 'right', 'back', 'left')).toEqual([true, true, false]);
    expect(w.dungeon?.at).toEqual({ x: 2, y: 2 });
    turnParty(w, data, 'around');
    expect(w.dungeon?.facing).toBe('e');
  });

  it('walks through doors but not secret doors', () => {
    const w = below();
    turnParty(w, data, 'right');
    walk(w, 'forward');
    expect(w.dungeon?.at).toEqual({ x: 2, y: 8 });
    expect(walk(w, 'forward')).toEqual([true]);
    expect(w.dungeon?.at).toEqual({ x: 3, y: 8 });
    const room = below();
    walk(room, 'forward', 'forward', 'forward', 'forward', 'forward', 'forward', 'forward');
    expect(room.dungeon?.at).toEqual({ x: 1, y: 1 });
    walk(room, 'right', 'right');
    expect(room.dungeon?.at).toEqual({ x: 3, y: 1 });
    expect(step(room, data, 'right')).toEqual({ ok: false, reason: 'A wall blocks the way.' });
  });

  it('maps nothing in the dark', () => {
    const w = below();
    w.light = { ...w.light, lit: null, torch: 0, kitTorches: 0 };
    step(w, data, 'forward');
    expect(w.dungeon?.at).toEqual({ x: 1, y: 7 });
    expect(w.dungeon?.seen['barrow-upper']).toEqual(['1,8', '1,7', '1,6', '1,5']);
    turnParty(w, data, 'right');
    expect(w.dungeon?.seen['barrow-upper']).toHaveLength(4);
  });

  it('remembers what it has seen, level by level', () => {
    const w = below();
    turnParty(w, data, 'right');
    expect(w.dungeon?.seen['barrow-upper']).toEqual(['1,8', '1,7', '1,6', '1,5', '2,8']);
  });

  it('needs to be underground', () => {
    const w = world();
    expect(() => step(w, data, 'forward')).toThrow('the party is not in a dungeon');
    expect(() => turnParty(w, data, 'left')).toThrow('the party is not in a dungeon');
    expect(stairsHere(w, data)).toBeUndefined();
  });
});

describe('stairs', () => {
  it('lead down a level and back up, a quarter day each', () => {
    const w = below();
    w.dungeon = { ...(w.dungeon as NonNullable<World['dungeon']>), at: { x: 9, y: 0 } };
    expect(takeStairs(w, data)).toEqual({ ok: true });
    expect(w.dungeon).toMatchObject({ level: 'barrow-lower', at: { x: 0, y: 0 }, facing: 's' });
    expect(w.quarter).toBe(2);
    expect(w.log.at(-1)).toContain('The party reaches The Lower Barrow.');
    expect(takeStairs(w, data)).toEqual({ ok: true });
    expect(w.dungeon).toMatchObject({ level: 'barrow-upper', at: { x: 9, y: 0 }, facing: 'w' });
    expect(Object.keys(w.dungeon?.seen ?? {})).toEqual(['barrow-upper', 'barrow-lower']);
  });

  it('climb out to the hex map from the entry', () => {
    const w = below();
    walk(w, 'forward');
    expect(takeStairs(w, data)).toEqual({ ok: false, reason: 'There are no stairs here.' });
    walk(w, 'back');
    expect(takeStairs(w, data)).toEqual({ ok: true });
    expect(w).toMatchObject({ dungeon: null, position: entrance, quarter: 2 });
    expect(w.log.at(-1)).toContain('The party climbs out of The Old Barrow.');
    expect(w.light.lit).toBeNull();
  });
});

describe('world save version 6', () => {
  it('upgrades with the party on the surface, and keeps a party underground', () => {
    const w = below();
    const back = parseWorld(serializeWorld(w), data);
    expect(back.ok && back.world.dungeon).toEqual(w.dungeon);
    const save = JSON.parse(serializeWorld(world()));
    delete save.dungeon;
    const old = parseWorld(JSON.stringify({ ...save, schemaVersion: 5 }), data);
    expect(old.ok && old.world.dungeon).toBeNull();
  });
});

describe('turning with an encounter pending', () => {
  it('refuses to turn the party until the encounter is settled', () => {
    const w = world();
    w.position = { ...entrance };
    w.destination = { col: 9, row: 9 };
    expect(enterDungeon(w, data)).toEqual({ ok: true });
    w.encounter = encounter([['thug-or-militia']]);
    const facing = w.dungeon?.facing;
    expect(turnParty(w, data, 'left')).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
    expect(w.dungeon?.facing).toBe(facing);
  });
});

describe('the landing square (docs/rules-adaptation.md, Dungeon exploration)', () => {
  it('reads the message on the square the party arrives on by stairs', () => {
    const withLanding = {
      ...data,
      content: {
        ...data.content,
        dungeons: data.content.dungeons.map((d) => ({
          ...d,
          levels: d.levels.map((l) =>
            l.id === 'barrow-lower'
              ? {
                  ...l,
                  specials: [
                    ...(l.specials ?? []),
                    { kind: 'message' as const, at: { x: 0, y: 0 }, text: 'A landing message.' },
                  ],
                }
              : l,
          ),
        })),
      },
    };
    const w = below();
    w.dungeon = { ...(w.dungeon as NonNullable<World['dungeon']>), at: { x: 9, y: 0 } };
    expect(takeStairs(w, withLanding)).toEqual({ ok: true });
    expect(w.log.at(-2)).toContain('The party reaches The Lower Barrow.');
    expect(w.log.at(-1)).toContain('A landing message.');
  });
});
