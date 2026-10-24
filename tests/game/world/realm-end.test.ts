import { describe, expect, it } from 'vitest';
import { emit } from '../../../src/game/world/bus.ts';
import { newWorld } from '../../../src/game/world/new-world.ts';
import { settleByLeaving } from '../../../src/game/world/quarter.ts';
import { checkRealmEnd, realmEnding, seeRealmEnd } from '../../../src/game/world/realm-end.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { WORLD_MIGRATIONS } from '../../../src/game/world/save-migrations.ts';
import type { World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, encounter, starter, world } from './helpers.ts';

const EXIT = { col: 23, row: 8 };

/** The four starters in the Sealed Vale. */
function inVale(): World {
  const party = (['snag', 'grukk', 'lirael', 'fizzwick'] as const).map((n, i) => ({
    character: starter(n),
    row: i < 2 ? 0 : 1,
    column: i % 2,
    defaultAction: 'auto' as const,
  }));
  return newWorld(data, createRng('end'), party, undefined, null, 'sealed-vale');
}

/** The party on the pass's last hex. */
function atExit(w: World): World {
  w.position = { ...EXIT };
  return w;
}

describe("a realm's ending (Sam's call: clearing the Sealed Vale's pass)", () => {
  it('is the last hex of the pass, with its own words', () => {
    const end = realmEnding(inVale(), data);
    expect(end).toMatchObject({ region: 'sealed-vale', ...EXIT });
    expect(end?.paragraphs.at(-1)).toContain('keep adventuring');
    // The campaign has no realm ending.
    expect(realmEnding(world(), data)).toBeNull();
  });

  it('waits while the last post still holds the hex', () => {
    const w = atExit(inVale());
    emit(w, data, { kind: 'hex-entered' });
    expect(w.encounter?.order).toBe('hold-the-throat');
    expect(w.realmEnd).toBeNull();
  });

  it('is reached by beating the last post', () => {
    const w = atExit(inVale());
    emit(w, data, { kind: 'hex-entered' });
    const post = w.encounter?.garrison as string;
    w.encounter = null;
    emit(w, data, { kind: 'fight-won', quest: null, garrison: post });
    expect(w.realmEnd).toBe('reached');
    expect(w.log.at(-1)).toContain('The pass is clear.');
  });

  it('is reached by walking out once the pass stands down', () => {
    const w = atExit(inVale());
    w.ordersEnded.push('hold-the-throat');
    emit(w, data, { kind: 'hex-entered' });
    expect(w.encounter).toBeNull();
    expect(w.realmEnd).toBe('reached');
  });

  it('is reached by talking past the last post, not by slipping away from it', () => {
    const slipped = atExit(inVale());
    emit(slipped, data, { kind: 'hex-entered' });
    expect(settleByLeaving(slipped, data)).toBe(true);
    expect(slipped.realmEnd).toBeNull();
    const talked = atExit(inVale());
    talked.encounter = { ...encounter([['bound-orc-guard']]), hostile: false };
    expect(settleByLeaving(talked, data)).toBe(true);
    expect(talked.realmEnd).toBe('reached');
  });

  it('is never reached elsewhere, underground, or twice', () => {
    const w = inVale();
    w.ordersEnded.push('hold-the-throat');
    checkRealmEnd(w, data);
    expect(w.realmEnd).toBeNull();
    atExit(w);
    w.dungeon = {} as NonNullable<World['dungeon']>;
    checkRealmEnd(w, data);
    expect(w.realmEnd).toBeNull();
    w.dungeon = null;
    checkRealmEnd(w, data);
    seeRealmEnd(w);
    expect(w.realmEnd).toBe('seen');
    checkRealmEnd(w, data);
    expect(w.realmEnd).toBe('seen');
    // Seeing it again changes nothing, and a world with no ending never reaches one.
    seeRealmEnd(w);
    expect(w.realmEnd).toBe('seen');
    const campaign = world();
    checkRealmEnd(campaign, data);
    seeRealmEnd(campaign);
    expect(campaign.realmEnd).toBeNull();
  });

  it('keeps its state in a save, and older saves have reached none', () => {
    const w = atExit(inVale());
    w.ordersEnded.push('hold-the-throat');
    checkRealmEnd(w, data);
    const back = parseWorld(serializeWorld(w), data);
    if (!back.ok) throw new Error(back.errors.join('; '));
    expect(back.world.realmEnd).toBe('reached');
    const up = WORLD_MIGRATIONS[41] as (raw: Record<string, unknown>) => Record<string, unknown>;
    expect(up({ schemaVersion: 41 })).toEqual({ schemaVersion: 42, realmEnd: null });
  });
});
