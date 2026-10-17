// Tavern rumors (docs/rules-adaptation.md, Towns in Phase 6a): a round bought in the common room
// tells of a way down in the region that no quest names and the party hasn't seen.
import { describe, expect, it } from 'vitest';
import { entrancesIn } from '../../../src/game/dungeon/ruins.ts';
import { regionMap } from '../../../src/game/world/region.ts';
import { buyRumor, rumorListed, rumorsLeft } from '../../../src/game/world/rumors.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { enterRegion } from '../../../src/game/world/crossing.ts';
import { hexCells } from '../../../src/render/hex-view.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, encounter, world } from './helpers.ts';

const ids = (w: ReturnType<typeof world>) => rumorsLeft(w, data).map((r) => r.id);

describe('tavern rumors', () => {
  it('tell only of ways down no quest names, in this region, not yet seen', () => {
    const w = world();
    // The Old Barrow is the Barrow-King's Torc's; the Borderlands' ruins are fair game.
    expect(ids(w).sort()).toEqual(['old-mine', 'old-westgate', 'sunken-chapel', 'watchers-spire']);
    w.visited.add('2,10');
    expect(ids(w)).not.toContain('sunken-chapel');
    enterRegion(w, 'dark-lands', { col: 6, row: 12 });
    expect(ids(w)).toHaveLength(6);
  });

  it('cost the listed price and mark the way down on the map, fog or no', () => {
    const w = world();
    w.rng = createRng('rumor');
    const before = w.purse;
    expect(rumorListed(data)).toBe(10);
    expect(buyRumor(w, data)).toEqual({ ok: true });
    expect(w.purse).toBe(before - 10);
    const [heard] = w.rumors;
    expect(ids(w)).not.toContain(heard);
    const ruin = data.content.ruins.find((r) => r.id === heard);
    if (!ruin) throw new Error(`no ruin ${heard}`);
    expect(w.log.at(-1)).toContain(
      `a regular tells of ${ruin.name}, at ${ruin.col},${ruin.row}, fit for a party of level ${ruin.level}.`,
    );
    const cells = hexCells(
      regionMap(data, w.region),
      w,
      [],
      10,
      [],
      entrancesIn(data, w.region, w.rumors),
    );
    const cell = cells.find((c) => c.col === ruin.col && c.row === ruin.row);
    expect(cell).toMatchObject({ terrain: null, dungeon: ruin.name });
    // Unheard ways down stay hidden under fog.
    const other = data.content.ruins.find((r) => r.region === w.region && r.id !== heard);
    expect(cells.find((c) => c.col === other?.col && c.row === other?.row)?.dungeon).toBeNull();
  });

  it('run out, and need the crowns and a quiet moment', () => {
    const w = world();
    w.encounter = encounter([['thug-or-militia']]);
    expect(buyRumor(w, data)).toEqual({ ok: false, reason: 'Settle the encounter first.' });
    w.encounter = null;
    w.purse = 5;
    expect(buyRumor(w, data)).toEqual({ ok: false, reason: 'That costs 10 crowns.' });
    w.purse = 1000;
    for (let i = 0; i < 4; i++) expect(buyRumor(w, data)).toEqual({ ok: true });
    expect(buyRumor(w, data)).toEqual({
      ok: false,
      reason: 'The regulars know of no other ways down around here.',
    });
    expect(w.rumors).toHaveLength(4);
  });

  it('tell of a dungeon no quest names, with no level given', () => {
    const w = world();
    const barrow = data.content.dungeons.find((d) => d.region === w.region);
    if (!barrow) throw new Error('no dungeon in the start region');
    const cellar = {
      ...barrow,
      id: 'old-cellar',
      name: 'the Old Cellar',
      entrance: { col: 0, row: 0 },
    };
    const more = {
      ...data,
      content: { ...data.content, dungeons: [...data.content.dungeons, cellar] },
    };
    expect(rumorsLeft(w, more)).toContainEqual({
      id: 'old-cellar',
      name: 'the Old Cellar',
      col: 0,
      row: 0,
      level: null,
    });
    w.rumors = ids(w);
    w.rng = createRng('rumor');
    expect(buyRumor(w, more)).toEqual({ ok: true });
    expect(w.log.at(-1)).toMatch(/a regular tells of the Old Cellar, at 0,0\.$/);
  });

  it('survive a save, and a version 26 save loads with none heard', () => {
    const w = world();
    buyRumor(w, data);
    const save = JSON.parse(serializeWorld(w));
    const again = parseWorld(JSON.stringify(save), data);
    if (!again.ok) throw new Error(again.errors.join('; '));
    expect(again.world.rumors).toEqual(w.rumors);
    const { rumors, ...rest } = save;
    expect(rumors).toHaveLength(1);
    const old = parseWorld(JSON.stringify({ ...rest, schemaVersion: 26 }), data);
    if (!old.ok) throw new Error(old.errors.join('; '));
    expect(old.world.rumors).toEqual([]);
  });
});
