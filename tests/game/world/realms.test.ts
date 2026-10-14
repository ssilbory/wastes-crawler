import { describe, expect, it } from 'vitest';
import { enterDungeon } from '../../../src/game/dungeon/explore.ts';
import { atGuardedHoard, ruinsListener } from '../../../src/game/dungeon/ruins.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { crossOver } from '../../../src/game/world/crossing.ts';
import { rollEnemies } from '../../../src/game/world/encounters.ts';
import { newWorld } from '../../../src/game/world/new-world.ts';
import { isCampaign, regionMap } from '../../../src/game/world/region.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { slotSummary } from '../../../src/render/save-view.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { place } from '../dungeon/helpers.ts';
import { data, starter } from './helpers.ts';

const party = (['snag', 'grukk', 'lirael', 'fizzwick'] as const).map((n, i) => ({
  character: starter(n),
  row: i < 2 ? 0 : 1,
  column: i % 2,
  defaultAction: 'auto' as const,
}));
const realm = data.content.realms.find((r) => r.id === 'wastes');
if (!realm) throw new Error('missing content');
const start = () => newWorld(data, createRng('wastes'), party, undefined, null, 'wastes');

describe('realms (Sam’s call)', () => {
  it('start in the realm’s first map, without the campaign’s factions', () => {
    const w = start();
    expect([w.realm, w.map, w.region]).toEqual(['wastes', null, realm.start]);
    const map = regionMap(data, realm.start);
    expect(w.position).toEqual({ col: map.start.col, row: map.start.row });
    expect(w.factions).toEqual({});
    expect(isCampaign(w)).toBe(false);
    expect(isCampaign(newWorld(data, createRng('c'), party))).toBe(true);
    expect(() => newWorld(data, createRng('c'), party, undefined, null, 'atlantis')).toThrow(
      'unknown realm atlantis',
    );
  });

  it('meet no captives bound for the campaign’s towns', () => {
    const w = start();
    for (let i = 0; i < 100; i++) expect(rollEnemies(w, data, 'plains').captive).toBeNull();
  });

  it('chain their maps by road, each harder than the last', () => {
    const tiers = realm.regions.map((id) =>
      Math.min(...data.content.ruins.filter((r) => r.region === id).map((r) => r.level)),
    );
    expect(tiers).toEqual([1, 3, 5, 7, 9]);
    const w = start();
    const map = regionMap(data, w.region);
    const road = map.exits[0];
    if (!road) throw new Error('no road');
    w.position = { col: road.col, row: road.row };
    crossOver(w, data);
    expect(w.region).toBe(realm.regions[1]);
  });

  it('keep one dungeon a map, five or six levels deep', () => {
    for (const id of realm.regions) {
      const here = data.content.dungeons.filter((d) => d.region === id);
      expect(here).toHaveLength(1);
      expect(here[0]?.levels.length).toBeGreaterThanOrEqual(5);
      expect(here[0]?.levels.length).toBeLessThanOrEqual(6);
      for (const l of here[0]?.levels ?? [])
        expect(l.specials.filter((s) => s.kind === 'cache' && s.guards)).toHaveLength(1);
    }
  });

  it('save and load the realm, and name it in the save slot', () => {
    const w = start();
    const text = serializeWorld(w);
    const loaded = parseWorld(text, data);
    expect(loaded.ok && loaded.world.realm).toBe('wastes');
    expect(slotSummary(text, data)).toMatch(/ · The Wastes · .+ · Snag/);
    const wrong = JSON.stringify({ ...JSON.parse(text), realm: 'atlantis' });
    expect(parseWorld(wrong, data)).toEqual({ ok: false, errors: ['unknown realm atlantis'] });
    const old = JSON.parse(serializeWorld(newWorld(data, createRng('c'), party)));
    delete old.realm;
    const migrated = parseWorld(JSON.stringify({ ...old, schemaVersion: 35 }), data);
    expect(migrated.ok && migrated.world.realm).toBeNull();
  });

  it('load a world begun on the Sealed Vale’s map as its realm', () => {
    const vale = data.content.regions.find((r) => r.id === 'sealed-vale');
    const save = JSON.parse(serializeWorld(newWorld(data, createRng('v'), party, undefined, vale)));
    delete save.realm;
    const loaded = parseWorld(JSON.stringify({ ...save, schemaVersion: 36 }), data);
    expect(loaded.ok && [loaded.world.map, loaded.world.realm]).toEqual([null, 'sealed-vale']);
    const other = JSON.parse(serializeWorld(start()));
    const kept = parseWorld(JSON.stringify({ ...other, schemaVersion: 36 }), data);
    expect(kept.ok && kept.world.realm).toBe('wastes');
  });

  it('guard each level’s hoard with a boss, met with its own words', () => {
    const w = start();
    const d = data.content.dungeons.find((x) => x.region === realm.start);
    if (!d) throw new Error('no dungeon');
    w.position = { ...d.entrance };
    enterDungeon(w, data);
    const level = d.levels[0] as (typeof d.levels)[0];
    const hoard = level.specials.find((s) => s.kind === 'cache' && s.guards);
    if (hoard?.kind !== 'cache') throw new Error('no hoard');
    w.loot = [];
    place(w, level.id, hoard.at.x, hoard.at.y, 'n');
    expect(atGuardedHoard(w, data)).toBe(true);
    emit(w, data, { kind: 'cell-entered' });
    expect(w.encounter?.text).toContain(hoard.text);
    const key = w.encounter?.garrison as string;
    w.encounter = null;
    w.beaten.push(key);
    expect(atGuardedHoard(w, data)).toBe(false);
    emit(w, data, { kind: 'fight-won', quest: null, garrison: key });
    expect(w.loot).toEqual(hoard.loot);
    expect(w.log.join('\n')).toContain('A cache holds');
  });

  it('say a hoard without words of its own is guarded', () => {
    const w = start();
    const d = data.content.dungeons.find((x) => x.region === realm.start);
    if (!d) throw new Error('no dungeon');
    w.position = { ...d.entrance };
    enterDungeon(w, data);
    const level = d.levels[0] as (typeof d.levels)[0];
    const plain = {
      ...data,
      content: {
        ...data.content,
        dungeons: data.content.dungeons.map((x) =>
          x.id !== d.id
            ? x
            : {
                ...x,
                levels: x.levels.map((l) => ({
                  ...l,
                  specials: l.specials.map((s) =>
                    s.kind === 'cache' ? { ...s, text: undefined } : s,
                  ),
                })),
              },
        ),
      },
    };
    const hoard = level.specials.find((s) => s.kind === 'cache' && s.guards);
    if (!hoard) throw new Error('no hoard');
    place(w, level.id, hoard.at.x, hoard.at.y, 'n');
    ruinsListener(w, plain, { kind: 'cell-entered' });
    expect(w.encounter?.text).toContain('Guards stand over a hoard.');
  });
});
