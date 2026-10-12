import { describe, expect, it } from 'vitest';
import type { Dungeon } from '../../../src/data/schemas/index.ts';
import type { GameData } from '../../../src/game/character/context.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { below, place, state } from '../dungeon/helpers.ts';
import { data } from './helpers.ts';

/** Saves a party underground, then loads it into the content with its dungeon changed. */
function reload(change: (d: Dungeon) => Dungeon | null, at?: { x: number; y: number }) {
  const w = below();
  if (at) place(w, state(w).level, at.x, at.y, 'n');
  const id = state(w).dungeon;
  const d = data.content.dungeons.find((x) => x.id === id) as Dungeon;
  const next = change(d);
  const changed: GameData = {
    ...data,
    content: {
      ...data.content,
      dungeons: data.content.dungeons.flatMap((x) => (x.id !== id ? [x] : next ? [next] : [])),
    },
  };
  const loaded = parseWorld(serializeWorld(w), changed);
  if (!loaded.ok) throw new Error(loaded.errors.join('; '));
  return loaded.world;
}

describe('loading a save whose dungeon has changed in the editor', () => {
  it('keeps the party where it was while that place is still there', () => {
    expect(reload((d) => d)?.dungeon).not.toBeNull();
  });

  it('puts the party back on the surface when the dungeon is gone', () => {
    const w = reload(() => null);
    expect(w.dungeon).toBeNull();
    expect(w.log.at(-1)).toMatch(/back on the surface/);
  });

  it('does so when its level is gone, or the cell is off the redrawn level', () => {
    expect(
      reload((d) => ({ ...d, levels: d.levels.map((l) => ({ ...l, id: `${l.id}-x` })) })).dungeon,
    ).toBeNull();
    const small = (d: Dungeon) => ({
      ...d,
      levels: d.levels.map((l) => ({ ...l, map: ['+-+', '| |', '+-+'] })),
    });
    expect(reload(small, { x: 3, y: 3 }).dungeon).toBeNull();
    const broken = (d: Dungeon) => ({ ...d, levels: d.levels.map((l) => ({ ...l, map: ['x'] })) });
    expect(reload(broken).dungeon).toBeNull();
  });

  it('keeps a party in a ruin, which is rebuilt from its seed', () => {
    const w = below();
    const ruin = data.content.ruins[0]?.id as string;
    state(w).dungeon = `${ruin}-v3`;
    const loaded = parseWorld(serializeWorld(w), data);
    expect(loaded.ok && loaded.world.dungeon?.dungeon).toBe(`${ruin}-v3`);
    state(w).dungeon = 'atlantis-v1';
    const lost = parseWorld(serializeWorld(w), data);
    expect(lost.ok && lost.world.dungeon).toBeNull();
  });
});
