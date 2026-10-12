import { describe, expect, it } from 'vitest';
import type { Region } from '../../../src/data/schemas/index.ts';
import { newDungeon } from '../../../src/game/dungeon/dungeon-edit.ts';
import { EMPTY_LIBRARY } from '../../../src/game/editor/library.ts';
import { freeHex } from '../../../src/game/editor/map-edit.ts';
import { generateRegion } from '../../../src/game/editor/map-gen.ts';
import { playableContent, worldMapErrors } from '../../../src/game/editor/playable.ts';
import { savedMap, serializeBundle } from '../../../src/game/world/bundle.ts';
import { rollEnemies } from '../../../src/game/world/encounters.ts';
import { newWorld } from '../../../src/game/world/new-world.ts';
import { setDestination, suggestPlan } from '../../../src/game/world/plans.ts';
import { endQuarter, passQuarter, settleByLeaving } from '../../../src/game/world/quarter.ts';
import { withWorldMap } from '../../../src/game/world/region.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import type { World } from '../../../src/game/world/types.ts';
import { slotSummary } from '../../../src/render/save-view.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, starter } from './helpers.ts';

const ember: Region = generateRegion(data.content, createRng(4), {
  id: 'ember',
  name: 'Ember',
  width: 20,
  height: 14,
  settlements: 4,
});
const party = (['snag', 'grukk', 'lirael', 'fizzwick'] as const).map((n, i) => ({
  character: starter(n),
  row: i < 2 ? 0 : 1,
  column: i % 2,
  defaultAction: 'auto' as const,
}));
const start = () => newWorld(data, createRng('ember'), party, undefined, ember);
const played = withWorldMap(data, ember);

/** Walks to every town in turn, letting encounters pass. */
function tour(w: World): void {
  for (const s of ember.sites) {
    setDestination(w, played, s);
    for (let q = 0; q < 200 && (w.position.col !== s.col || w.position.row !== s.row); q++) {
      if (w.encounter && !settleByLeaving(w, played)) {
        w.encounter = null;
        endQuarter(w, played);
      } else if (!w.encounter) passQuarter(w, played, suggestPlan(w, played));
    }
  }
}

describe('worlds on custom maps (Sam’s calls)', () => {
  it('start in the map’s starting town, without the campaign’s factions', () => {
    const w = start();
    expect(w.map).toBe(ember);
    expect(w.region).toBe('ember');
    const town = ember.sites.find((s) => s.id === ember.start);
    expect(w.position).toEqual({ col: town?.col, row: town?.row });
    expect(w.lastTown).toBe(ember.start);
    expect(w.factions).toEqual({});
  });

  it('play for weeks with none of the campaign’s story', () => {
    const w = start();
    tour(w);
    expect(w.day).toBeGreaterThan(7);
    expect(w.log.some((l) => l.includes('Word spreads') || l.includes('Word comes'))).toBe(false);
    expect([w.clock, w.raid]).toEqual([0, null]);
  });

  it('meet no captives bound for the campaign’s towns', () => {
    const w = start();
    for (let i = 0; i < 200; i++) expect(rollEnemies(w, played, 'plains').captive).toBeNull();
    const campaign = newWorld(data, createRng('ember'), party);
    const rolls = Array.from({ length: 200 }, () => rollEnemies(campaign, data, 'plains'));
    expect(rolls.some((r) => r.captive !== null)).toBe(true);
  });

  it('save the map with the world, so it loads without the editor', () => {
    const w = start();
    const text = serializeWorld(w);
    const loaded = parseWorld(text, data);
    expect(loaded.ok && loaded.world.map).toEqual(ember);
    expect(savedMap(text)).toEqual(ember);
    expect(savedMap(serializeBundle(w, []))).toEqual(ember);
    expect(savedMap(serializeWorld(newWorld(data, createRng('c'), party)))).toBeNull();
    expect(savedMap('{')).toBeNull();
    const wrong = JSON.stringify({ ...JSON.parse(text), region: 'elsewhere' });
    expect(parseWorld(wrong, data)).toEqual({ ok: false, errors: ['unknown region elsewhere'] });
  });

  it('loads an older save as a campaign world', () => {
    const save = JSON.parse(serializeWorld(newWorld(data, createRng('c'), party)));
    delete save.map;
    const loaded = parseWorld(JSON.stringify({ ...save, schemaVersion: 33 }), data);
    expect(loaded.ok && loaded.world.map).toBeNull();
  });

  it('name the map in the save slot', () => {
    expect(slotSummary(serializeWorld(start()), data)).toMatch(/ · Ember · .+ · Snag/);
  });

  it('play the dungeons saved on the map, and only valid maps', () => {
    const at = freeHex(data.content.terrains, ember) as { col: number; row: number };
    const cave = newDungeon('ember-cave', 'Ember Cave', ember, at);
    const lib = { ...EMPTY_LIBRARY, dungeons: [cave], regions: [ember] };
    expect(playableContent(data.srd, data.content, lib).skipped).toEqual({
      'ember-cave': 'it is on a map the game can’t play yet',
    });
    const { content, skipped } = playableContent(data.srd, data.content, lib, ember);
    expect(skipped).toEqual({});
    expect(content.dungeons.at(-1)).toBe(cave);
    expect(content.regions.at(-1)).toBe(ember);
    expect(worldMapErrors(data.srd, data.content, ember)).toEqual([]);
    const taken = data.content.regions[0]?.sites[0]?.id as string;
    const clash = {
      ...ember,
      sites: ember.sites.map((s, i) => (i === 0 ? { ...s, id: taken } : s)),
    };
    expect(worldMapErrors(data.srd, data.content, clash)).toContain(
      `regions/ember/${taken}: another map has a town with this id`,
    );
  });
});
