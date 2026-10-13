import { describe, expect, it } from 'vitest';
import type { Dungeon } from '../../../src/data/schemas/index.ts';
import {
  cellDetails,
  paintCell,
  setCaptive,
  setFurniture,
  setGarrison,
  setNpcKind,
  setSafe,
  setTrap,
} from '../../../src/game/dungeon/level-details.ts';
import { editorErrors } from '../../../src/game/dungeon/level-edit.ts';
import { data } from '../world/helpers.ts';

const barrow = data.content.dungeons.find((d) => d.id === 'old-barrow') as Dungeon;
const upper = barrow.levels[0]?.id as string;
/** A plain floor cell on the barrow's upper level with nothing on it. */
const spot = { x: 1, y: 1 };

describe('what the editor checks before export (review fixes)', () => {
  it('reports details the content schema or the garrison checks would refuse', () => {
    const held = paintCell(data.content, barrow, upper, spot, 'npc');
    const captive = cellDetails(held, upper, spot).captive as NonNullable<
      ReturnType<typeof cellDetails>['captive']
    >;
    const emptied = setCaptive(held, upper, { ...captive, guards: [[]], text: '' });
    const errors = editorErrors(data.content, emptied, data.srd);
    expect(errors.some((e) => e.includes('guards'))).toBe(true);
    expect(errors.some((e) => e.includes('text'))).toBe(true);
    const guarded = setNpcKind(data.content, barrow, upper, spot, 'guard');
    const post = cellDetails(guarded, upper, spot).garrison as NonNullable<
      ReturnType<typeof cellDetails>['garrison']
    >;
    const lost = setGarrison(guarded, upper, { ...post, order: 'no-such-order' });
    expect(editorErrors(data.content, lost, data.srd)).toContain(
      `dungeons/old-barrow/${upper}: the garrison at 1,1 has unknown order no-such-order`,
    );
    // Without the SRD the garrison checks are left out.
    expect(editorErrors(data.content, lost)).toEqual([]);
  });
});

describe('cell details in the level editor (Phase 17)', () => {
  it('gives a painted trap or NPC details copied from the content, and keeps the level valid', () => {
    expect(cellDetails(barrow, upper, spot)).toEqual({
      trap: null,
      captive: null,
      garrison: null,
      furniture: null,
      safe: false,
    });
    const trapped = paintCell(data.content, barrow, upper, spot, 'trap');
    expect(cellDetails(trapped, upper, spot).trap).toMatchObject({ at: spot, name: 'dart trap' });
    expect(editorErrors(data.content, trapped)).toEqual([]);
    const held = paintCell(data.content, trapped, upper, spot, 'npc');
    const details = cellDetails(held, upper, spot);
    expect(details.trap).toBeNull();
    expect(details.captive).toMatchObject({ at: spot, captive: 'grave-digger' });
    expect(editorErrors(data.content, held)).toEqual([]);
    // Painted over with floor, the details go.
    const cleared = paintCell(data.content, held, upper, spot, 'floor');
    expect(cellDetails(cleared, upper, spot)).toMatchObject({ trap: null, captive: null });
    // Painting a trap again on a trap keeps its details.
    const named = setTrap(trapped, upper, {
      ...(cellDetails(trapped, upper, spot).trap as NonNullable<
        ReturnType<typeof cellDetails>['trap']
      >),
      name: 'pit',
    });
    expect(
      cellDetails(paintCell(data.content, named, upper, spot, 'trap'), upper, spot).trap?.name,
    ).toBe('pit');
  });

  it('turns an NPC into a guard post on plain floor, and back into a captive', () => {
    const held = paintCell(data.content, barrow, upper, spot, 'npc');
    const guarded = setNpcKind(data.content, held, upper, spot, 'guard');
    const post = cellDetails(guarded, upper, spot);
    expect(post.captive).toBeNull();
    expect(post.garrison).toMatchObject({ at: spot, order: 'ashgate-hold' });
    expect(guarded.levels[0]?.map[2 * spot.y + 1]?.[2 * spot.x + 1]).toBe(' ');
    // Asking for a guard post again keeps the one there.
    const edited = setGarrison(guarded, upper, {
      ...(post.garrison as NonNullable<typeof post.garrison>),
      text: 'Watch.',
    });
    expect(
      cellDetails(setNpcKind(data.content, edited, upper, spot, 'guard'), upper, spot).garrison
        ?.text,
    ).toBe('Watch.');
    // A trap painted on a guard post replaces it.
    expect(
      cellDetails(paintCell(data.content, guarded, upper, spot, 'trap'), upper, spot).garrison,
    ).toBeNull();
    // Painting floor over a guard post removes it.
    expect(
      cellDetails(paintCell(data.content, guarded, upper, spot, 'floor'), upper, spot).garrison,
    ).toBeNull();
    const back = setNpcKind(data.content, guarded, upper, spot, 'captive');
    expect(cellDetails(back, upper, spot)).toMatchObject({ garrison: null, captive: { at: spot } });
  });

  it('edits a captive and marks safe camping squares', () => {
    const held = paintCell(data.content, barrow, upper, spot, 'npc');
    const captive = cellDetails(held, upper, spot).captive as NonNullable<
      ReturnType<typeof cellDetails>['captive']
    >;
    const changed = setCaptive(held, upper, { ...captive, captive: 'merchant' });
    expect(cellDetails(changed, upper, spot).captive?.captive).toBe('merchant');
    const safe = setSafe(barrow, upper, spot, true);
    expect(cellDetails(safe, upper, spot).safe).toBe(true);
    expect(cellDetails(setSafe(safe, upper, spot, false), upper, spot).safe).toBe(false);
  });

  it('fails loudly for an unknown level or content with nothing to copy', () => {
    expect(() => cellDetails(barrow, 'nowhere', spot)).toThrow('unknown level nowhere');
    const bare = {
      ...data.content,
      dungeons: data.content.dungeons.map((d) => ({
        ...d,
        levels: d.levels.map((l) => ({ ...l, traps: [] })),
      })),
    };
    expect(() => paintCell(bare, barrow, upper, spot, 'trap')).toThrow(
      'the content has no trap to copy',
    );
    // Only the kind being painted needs one.
    expect(
      cellDetails(paintCell(bare, barrow, upper, spot, 'npc'), upper, spot).captive,
    ).not.toBeNull();
    const noPosts = {
      ...data.content,
      dungeons: data.content.dungeons.map((d) => ({
        ...d,
        levels: d.levels.map((l) => ({ ...l, garrisons: [] })),
      })),
    };
    expect(() => setNpcKind(noPosts, barrow, upper, spot, 'guard')).toThrow(
      'the content has no garrison post to copy',
    );
    const noCaptives = {
      ...data.content,
      dungeons: data.content.dungeons.map((d) => ({
        ...d,
        levels: d.levels.map((l) => ({ ...l, captives: [] })),
      })),
    };
    expect(() => paintCell(noCaptives, barrow, upper, spot, 'npc')).toThrow(
      'the content has no held captive to copy',
    );
  });
});

describe('furniture (docs/presentation-plan.md, V4)', () => {
  it('sets, replaces, and clears what stands on a floor cell', () => {
    const one = setFurniture(barrow, upper, spot, 'altar');
    expect(cellDetails(one, upper, spot).furniture).toBe('altar');
    const two = setFurniture(one, upper, spot, 'fountain');
    expect(two.levels[0]?.furniture?.filter((f) => f.at.x === spot.x && f.at.y === spot.y)).toEqual(
      [{ at: spot, kind: 'fountain' }],
    );
    expect(cellDetails(setFurniture(two, upper, spot, null), upper, spot).furniture).toBeNull();
    expect(editorErrors(data.content, two, data.srd)).toEqual([]);
  });

  it('goes when the cell is painted as anything but floor, and stays on floor', () => {
    const dressed = setFurniture(barrow, upper, spot, 'bones');
    const painted = (kind: 'trap' | 'floor') =>
      cellDetails(paintCell(data.content, dressed, upper, spot, kind), upper, spot).furniture;
    expect(painted('trap')).toBeNull();
    expect(painted('floor')).toBe('bones');
    // A level with none gains no list by being painted.
    const plain = {
      ...barrow,
      levels: barrow.levels.map((l) => {
        const copy = { ...l };
        delete copy.furniture;
        return copy;
      }),
    };
    expect(paintCell(data.content, plain, upper, spot, 'trap').levels[0]).not.toHaveProperty(
      'furniture',
    );
    // And one is started when the first piece goes on it.
    expect(cellDetails(setFurniture(plain, upper, spot, 'rubble'), upper, spot).furniture).toBe(
      'rubble',
    );
  });
});
