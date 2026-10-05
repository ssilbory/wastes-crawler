import { describe, expect, it } from 'vitest';
import { enterDungeon, step, takeStairs } from '../../../src/game/dungeon/explore.ts';
import {
  campUnderground,
  countStep,
  fightTurns,
  onSafeSquare,
  passTurn,
  STEPS_PER_TURN,
  TURNS_PER_QUARTER,
} from '../../../src/game/dungeon/time.ts';
import { endOfDay } from '../../../src/game/world/day.ts';
import { settleByFighting, settleByLeaving } from '../../../src/game/world/quarter.ts';
import type { World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, encounter, world } from '../world/helpers.ts';

function below(): World {
  const w = world();
  w.position = { col: 5, row: 10 };
  enterDungeon(w, data);
  return w;
}
let rng = scriptedRng([]);
const state = (w: World) => w.dungeon as NonNullable<World['dungeon']>;
/** Moves the party to a cell of the level it is on, as if it had walked there. */
const place = (w: World, x: number, y: number, level = 'barrow-upper') =>
  Object.assign(state(w), { level, at: { x, y } });
const sleepers = (w: World) => Object.fromEntries(w.members.map((m) => [m.id, 'sleep' as const]));

describe('exploration turns (SRD 2.13.2, 2.13.3)', () => {
  it('counts twelve steps to the turn, burning the light each turn', () => {
    const w = below();
    w.rng = rng = scriptedRng([3]);
    for (let i = 0; i < STEPS_PER_TURN - 1; i++) countStep(w, data);
    expect(state(w)).toMatchObject({ steps: 11, turn: 0 });
    countStep(w, data);
    expect(state(w)).toMatchObject({ steps: 0, turn: 1 });
    expect(rng.remaining()).toBe(0);
  });

  it('walking counts: twelve steps along the corridor and back make a turn', () => {
    const w = below();
    w.rng = rng = scriptedRng([3]);
    const ways = ['forward', 'back'] as const;
    for (let i = 0; i < STEPS_PER_TURN; i++) step(w, data, ways[i % 2] as 'forward' | 'back');
    expect(state(w).turn).toBe(1);
  });

  it('moves the calendar a quarter every 36 turns', () => {
    const w = below();
    w.rng = createRng('turns');
    const start = w.quarter;
    for (let i = 0; i < TURNS_PER_QUARTER; i++) passTurn(w, data);
    expect(w.quarter).toBe(start + 1);
  });

  it('checks for wandering encounters on the level’s cadence', () => {
    const w = below();
    // Turns 1 and 2 only burn the torch; turn 3 rolls the check, here a miss.
    w.rng = rng = scriptedRng([3, 3, 3, 2]);
    passTurn(w, data);
    passTurn(w, data);
    passTurn(w, data);
    expect(w.encounter).toBeNull();
    expect(rng.remaining()).toBe(0);
  });

  it('meets wanderers, spotted by the best eyes unless the party is in the dark', () => {
    const lit = below();
    lit.rng = createRng('wander');
    while (!lit.encounter) passTurn(lit, data);
    expect(lit.encounter.text).toBeTruthy();
    expect(lit.log.at(-1)).toMatch(/\(The Upper Barrow 1,8\)$/);
    const dark = below();
    dark.light = { ...dark.light, lit: null, torch: 0, kitTorches: 0 };
    dark.rng = createRng('wander');
    for (let i = 0; i < 200 && !dark.encounter; i++) passTurn(dark, data);
    expect(dark.encounter?.spotted).toBe(false);
  });

  it('rolls no checks where the level has none, or while an encounter waits', () => {
    const w = below();
    const level = data.content.dungeons[0]?.levels[0];
    const quiet = {
      ...data,
      content: {
        ...data.content,
        dungeons: [
          {
            ...(data.content.dungeons[0] as (typeof data.content.dungeons)[0]),
            levels: [{ ...(level as NonNullable<typeof level>), wander: null }],
          },
        ],
      },
    };
    w.rng = rng = scriptedRng([3, 3, 3]);
    for (let i = 0; i < 3; i++) passTurn(w, quiet);
    w.encounter = encounter([['thug-or-militia']]);
    w.rng = rng = scriptedRng([3, 3, 3]);
    for (let i = 0; i < 3; i++) passTurn(w, data);
    expect(rng.remaining()).toBe(0);
  });

  it('spends a turn on the fight and one after, burning the light for it', () => {
    const w = below();
    w.rng = rng = scriptedRng([3, 3, 3]);
    fightTurns(w, data);
    expect(state(w).turn).toBe(2);
    expect(rng.remaining()).toBe(0);
  });

  it('settles encounters underground in turns, not quarters', () => {
    const w = below();
    const quarter = w.quarter;
    w.encounter = { ...encounter([['thug-or-militia']]), hostile: false };
    w.rng = rng = scriptedRng([3]);
    expect(settleByLeaving(w, data)).toBe(true);
    expect(state(w).turn).toBe(1);
    w.encounter = encounter([['thug-or-militia']]);
    // The fight burns the torch, then turns 2 and 3 burn it; turn 3 brings the level's check.
    w.rng = rng = scriptedRng([3, 3, 3, 2]);
    const fight = {
      battle: { combatants: [] } as never,
      setup: null as never,
      memberIds: [],
      npcIds: [],
    };
    settleByFighting(
      w,
      data,
      { ...fight, enemies: [], captive: null, quest: null, garrison: null, patrol: null },
      { outcome: 'party', rounds: 1, deaths: 0, battle: { combatants: [] } as never },
      null,
    );
    expect(state(w).turn).toBe(3);
    expect(w.quarter).toBe(quarter);
  });

  it('refuses to move or climb while an encounter waits', () => {
    const w = below();
    w.encounter = encounter([['thug-or-militia']]);
    expect(step(w, data, 'forward')).toEqual({ ok: false, reason: 'Settle the encounter first.' });
    expect(takeStairs(w, data)).toEqual({ ok: false, reason: 'Settle the encounter first.' });
  });
});

describe('camping underground', () => {
  it('only on a safe square, with no encounter waiting', () => {
    const w = below();
    expect(onSafeSquare(w, data)).toBe(false);
    expect(campUnderground(w, data, {})).toEqual({
      ok: false,
      reason: 'This is no place to camp.',
    });
    place(w, 4, 0);
    w.encounter = encounter([['thug-or-militia']]);
    expect(campUnderground(w, data, {})).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
    expect(() => campUnderground(world(), data, {})).toThrow('the party is not in a dungeon');
    expect(onSafeSquare(world(), data)).toBe(false);
  });

  it('shelters and rests the party for a quarter, without burning the light', () => {
    const w = below();
    place(w, 4, 0);
    const quarter = w.quarter;
    w.rng = rng = scriptedRng([2]);
    expect(campUnderground(w, data, sleepers(w))).toEqual({ ok: true });
    expect(w).toMatchObject({ camp: 'made', quarter: quarter + 1 });
    expect(w.members.every((m) => m.slept)).toBe(true);
    expect(w.light.torch).toBe(6);
  });

  it('can be broken by wanderers before the quarter passes', () => {
    const w = below();
    place(w, 4, 0);
    w.rng = createRng('camp');
    const watch = Object.fromEntries(
      w.members.map((m, i) => [m.id, i === 0 ? 'watch' : 'rest']),
    ) as Record<string, 'watch' | 'rest'>;
    for (let i = 0; i < 100 && !w.encounter; i++) campUnderground(w, data, watch);
    expect(w.encounter).not.toBeNull();
    expect(w.log.at(-1)).toContain('(The Upper Barrow 4,0)');
  });

  it('can’t spot wanderers at a camp in the dark', () => {
    const w = below();
    place(w, 4, 0);
    w.light = { ...w.light, lit: null, torch: 0, kitTorches: 0 };
    w.rng = createRng('camp');
    const watch = { [w.members[0]?.id as string]: 'watch' as const };
    for (let i = 0; i < 100 && !w.encounter; i++) campUnderground(w, data, watch);
    expect(w.encounter?.spotted).toBe(false);
  });

  it('camps without checks on a level that has none', () => {
    const w = below();
    place(w, 4, 0);
    const level = data.content.dungeons[0]?.levels[0] as NonNullable<
      (typeof data.content.dungeons)[0]
    >['levels'][0];
    const quiet = {
      ...data,
      content: {
        ...data.content,
        dungeons: [
          {
            ...(data.content.dungeons[0] as (typeof data.content.dungeons)[0]),
            levels: [{ ...level, wander: null }],
          },
        ],
      },
    };
    w.rng = createRng('quiet');
    expect(campUnderground(w, quiet, {})).toEqual({ ok: true });
  });

  it('sees no weather underground at nightfall', () => {
    const w = below();
    w.rng = createRng('night');
    endOfDay(w, data);
    expect(w.members.some((m) => m.cold)).toBe(false);
  });
});
