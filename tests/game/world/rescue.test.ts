import { describe, expect, it } from 'vitest';
import { makeRoomForFreed } from '../../../src/game/world/hire.ts';
import { addNpc } from '../../../src/game/world/npcs.ts';
import {
  freeCaptive,
  freedWaiting,
  partWithFreed,
  takeFreed,
} from '../../../src/game/world/rescue.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { WORLD_MIGRATIONS } from '../../../src/game/world/save-migrations.ts';
import { stowWith } from '../../../src/game/world/loads.ts';
import { wipe } from '../../../src/game/world/town.ts';
import { data, world } from './helpers.ts';

describe('freeing a captive (docs/rules-adaptation.md, NPCs in Phase 6c)', () => {
  it('names no town when the captive is bound for none the party knows', () => {
    const w = world([2]);
    const lost = {
      ...data,
      content: {
        ...data.content,
        captives: data.content.captives.map((c) =>
          c.id === 'merchant' ? { ...c, destination: 'nowhere' } : c,
        ),
      },
    };
    expect(freeCaptive(w, lost, 'merchant')).toBe(true);
    expect(w.npcs).toMatchObject([{ kind: 'captive', type: 'merchant' }]);
    expect(w.log.at(-1)).toMatch(/joins the party until they reach safety\.$/);
  });
});

describe('a captive freed with no room (docs/rules-adaptation.md, NPCs in Phase 6c: Rescues)', () => {
  /** A guard and a porter fill both NPC slots, and the scholar is freed. */
  const full = () => {
    const w = world();
    addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'Aldo', true);
    addNpc(w, data, 'hireling', 'porter', 'peaceful-human', 'Brenna', false);
    expect(freeCaptive(w, data, 'scholar')).toBe(false);
    return w;
  };

  it('waits on the party, which dismisses an NPC to take them along', () => {
    const w = full();
    expect(freedWaiting(w, data)?.id).toBe('scholar');
    expect(w.log.at(-1)).toContain(
      'A captured scholar is free, but the party has no room for them.',
    );
    expect(takeFreed(w, data)).toEqual({ ok: false, reason: 'There is no room in the party.' });
    expect(makeRoomForFreed(w, data, 'npc-0')).toEqual({ ok: true });
    expect(w.freedCaptive).toBeNull();
    expect(freedWaiting(w, data)).toBeUndefined();
    expect(w.npcs.map((n) => n.name)).toEqual(['Brenna', 'A captured scholar']);
    expect(w.log.at(-2)).toContain('Aldo is let go');
    expect(w.log.at(-1)).toContain(
      'A captured scholar is free and joins the party until they reach ',
    );
  });

  it('keeps waiting when the NPC cannot be dismissed yet', () => {
    const w = full();
    stowWith(w, data, 'm-0', 0, 'npc-1');
    expect(makeRoomForFreed(w, data, 'npc-1')).toEqual({
      ok: false,
      reason: "Take Brenna's load first.",
    });
    expect(w.freedCaptive).toBe('scholar');
    expect(w.npcs).toHaveLength(2);
  });

  it('joins without a dismissal once a slot has opened another way', () => {
    const w = full();
    w.npcs = w.npcs.slice(0, 1);
    expect(takeFreed(w, data)).toEqual({ ok: true });
    expect(w.npcs.map((n) => n.name)).toEqual(['Aldo', 'A captured scholar']);
  });

  it('goes their own way when the party says so, or when another is freed', () => {
    const w = full();
    partWithFreed(w, data);
    expect(w.freedCaptive).toBeNull();
    expect(w.npcs.map((n) => n.name)).toEqual(['Aldo', 'Brenna']);
    expect(w.log.at(-1)).toContain('A captured scholar thanks the party and goes their own way.');
    freeCaptive(w, data, 'scholar');
    freeCaptive(w, data, 'pilgrim');
    expect(w.freedCaptive).toBe('pilgrim');
    expect(w.log.at(-2)).toContain('A captured scholar thanks the party and goes their own way.');
    expect(w.log.at(-1)).toContain('is free, but the party has no room for them.');
  });

  it('has nothing to answer with no one waiting', () => {
    const w = world();
    expect(() => takeFreed(w, data)).toThrow('no freed captive waits');
    expect(() => makeRoomForFreed(w, data, 'npc-0')).toThrow('no freed captive waits');
    expect(() => partWithFreed(w, data)).toThrow('no freed captive waits');
  });

  it('is lost with a fallen party, kept through a save, and absent from older saves', () => {
    const w = full();
    const back = parseWorld(serializeWorld(w), data);
    if (!back.ok) throw new Error(back.errors.join('; '));
    expect(back.world.freedCaptive).toBe('scholar');
    wipe(w, data);
    expect(w.freedCaptive).toBeNull();
    const up = WORLD_MIGRATIONS[57] as (raw: Record<string, unknown>) => Record<string, unknown>;
    expect(up({ schemaVersion: 57 })).toEqual({ schemaVersion: 58, freedCaptive: null });
  });
});
