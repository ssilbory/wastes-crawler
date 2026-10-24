import { describe, expect, it } from 'vitest';
import { enterDungeon } from '../../../src/game/dungeon/explore.ts';
import { arriveOn } from '../../../src/game/dungeon/specials.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { newWorld } from '../../../src/game/world/new-world.ts';
import { giveCountersign } from '../../../src/game/world/orders.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { WORLD_MIGRATIONS } from '../../../src/game/world/save-migrations.ts';
import type { World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, starter } from '../world/helpers.ts';
import { place } from './helpers.ts';

const HARROWMERE = data.content.dungeons.find((d) => d.id === 'harrowmere');
const PIECES = HARROWMERE?.levels.flatMap((l) =>
  l.specials.flatMap((s) => (s.kind === 'countersign' ? [{ level: l.id, at: s.at }] : [])),
);
const WARDEN = { level: 'hm-tower-6', at: { x: 3, y: 2 } };
const HOARD = `harrowmere/${WARDEN.level}/3,2`;

/** The four starters in the Sealed Vale, inside Harrowmere. */
function inVale(): World {
  const party = (['snag', 'grukk', 'lirael', 'fizzwick'] as const).map((n, i) => ({
    character: starter(n),
    row: i < 2 ? 0 : 1,
    column: i % 2,
    defaultAction: 'auto' as const,
  }));
  const w = newWorld(data, createRng('warden'), party, undefined, null, 'sealed-vale');
  w.position = { ...(HARROWMERE?.entrance as { col: number; row: number }) };
  enterDungeon(w, data);
  return w;
}

/** Steps onto a cell, its specials and listeners firing as on a walk. */
function stepOn(w: World, level: string, at: { x: number; y: number }): void {
  place(w, level, at.x, at.y, 'n');
  arriveOn(w, data);
  emit(w, data, { kind: 'cell-entered' });
}

describe("the Warden's countersign (Sam's call: the Sealed Vale's story)", () => {
  it('comes in three pieces, one in the streets, the cistern, and the tower', () => {
    expect(PIECES?.map((p) => p.level)).toEqual(['hm-streets', 'hm-sewer-3', 'hm-tower-3']);
    const w = inVale();
    const [first, second, third] = PIECES ?? [];
    stepOn(w, first?.level as string, first?.at as { x: number; y: number });
    expect(w.log.at(-1)).toContain('The party has 1 of 3 pieces of a countersign.');
    // The same piece twice counts once.
    stepOn(w, first?.level as string, first?.at as { x: number; y: number });
    stepOn(w, second?.level as string, second?.at as { x: number; y: number });
    expect(w.log.at(-1)).toContain('The party has 2 of 3 pieces of a countersign.');
    expect(w.countersigns).not.toContain('warden-seal');
    stepOn(w, third?.level as string, third?.at as { x: number; y: number });
    expect(w.countersigns).toContain('warden-seal');
    expect(w.log.at(-1)).toContain('"The vale sleeps, the gate holds, the Warden waits"');
    expect(w.pieces).toHaveLength(3);
  });

  it('stands the Warden down: his hoard is given up, and his tower and the pass with it', () => {
    const w = inVale();
    stepOn(w, WARDEN.level, WARDEN.at);
    expect(w.encounter).toMatchObject({
      order: 'warden-seal',
      garrison: HOARD,
      hostile: true,
      spotted: true,
    });
    expect(w.encounter?.text).toContain('Give the word');
    expect(giveCountersign(w, data)).toEqual({
      ok: false,
      reason: "The party doesn't know the countersign.",
    });
    w.countersigns.push('warden-seal');
    expect(giveCountersign(w, data)).toEqual({ ok: true });
    expect(w.encounter).toBeNull();
    expect(w.caches).toContain(HOARD);
    expect(w.ordersEnded).toEqual(['warden-seal', 'hold-the-throat', 'spire-watch']);
    // The pass no longer springs.
    const post = data.content.regions.find((r) => r.id === 'sealed-vale')?.garrisons[0];
    w.dungeon = null;
    w.position = { col: post?.col as number, row: post?.row as number };
    emit(w, data, { kind: 'hex-entered' });
    expect(w.encounter).toBeNull();
  });

  it('ends the seal when the Warden is beaten instead', () => {
    const w = inVale();
    stepOn(w, WARDEN.level, WARDEN.at);
    w.encounter = null;
    emit(w, data, { kind: 'fight-won', quest: null, garrison: HOARD });
    expect(w.beaten).toContain(HOARD);
    expect(w.caches).toContain(HOARD);
    expect(w.ordersEnded).toEqual(['warden-seal', 'hold-the-throat', 'spire-watch']);
    expect(w.log.join('\n')).toContain('The order to keep the vale sealed is ended.');
  });

  it('gives up a hoard without a fight once its order has ended', () => {
    const w = inVale();
    w.ordersEnded.push('warden-seal');
    stepOn(w, WARDEN.level, WARDEN.at);
    expect(w.encounter).toBeNull();
    expect(w.caches).toContain(HOARD);
  });

  it('keeps the pieces found in a save, and older saves have none', () => {
    const w = inVale();
    const [first] = PIECES ?? [];
    stepOn(w, first?.level as string, first?.at as { x: number; y: number });
    const back = parseWorld(serializeWorld(w), data);
    if (!back.ok) throw new Error(back.errors.join('; '));
    expect(back.world.pieces).toEqual(w.pieces);
    const up = WORLD_MIGRATIONS[40] as (raw: Record<string, unknown>) => Record<string, unknown>;
    expect(up({ schemaVersion: 40 })).toEqual({ schemaVersion: 41, pieces: [] });
  });
});
