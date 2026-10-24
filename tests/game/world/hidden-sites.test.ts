import { describe, expect, it } from 'vitest';
import type { HiddenSiteContent } from '../../../src/data/schemas/index.ts';
import type { GameData } from '../../../src/game/character/context.ts';
import { dungeonOf, enterDungeon, goesDown, levelOf } from '../../../src/game/dungeon/explore.ts';
import {
  hiddenRuin,
  hiddenRuinById,
  ruinOfDungeon,
  strongestBand,
} from '../../../src/game/dungeon/hidden-ruins.ts';
import { wayDownHere } from '../../../src/game/dungeon/ruins.ts';
import { camp } from '../../../src/game/world/activities.ts';
import { emit } from '../../../src/game/world/bus.ts';
import {
  explore,
  foundRuinHere,
  foundSitesIn,
  sitesIn,
  type HiddenSite,
  type SiteKind,
} from '../../../src/game/world/hidden-sites.ts';
import { checkBonus } from '../../../src/game/world/members.ts';
import { regionMap } from '../../../src/game/world/region.ts';
import { WORLD_MIGRATIONS } from '../../../src/game/world/save-migrations.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import type { World } from '../../../src/game/world/types.ts';
import { hexKey } from '../../../src/rules/hex.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedThen } from '../../helpers/scripted-rng.ts';
import { place } from '../dungeon/helpers.ts';
import { data, member, world } from './helpers.ts';

/** Content where every other wild hex holds a site of this one kind. */
function only(kind: SiteKind, extra: Partial<HiddenSiteContent> = {}): GameData {
  const rules = data.content.hiddenSites;
  const weights = { cache: 0, lair: 0, ruin: 0, shrine: 0, [kind]: 1 };
  return {
    ...data,
    content: { ...data.content, hiddenSites: { ...rules, odds: 2, weights, ...extra } },
  };
}

/** The party on the first site of the region, and that site. */
function atSite(d: GameData, w: World = world(undefined, d)): { w: World; s: HiddenSite } {
  const s = [...sitesIn(d, w.sites.seed, w.region).values()][0] as HiddenSite;
  w.position = { ...s.hex };
  return { w, s };
}

const scouts = (w: World) => [member(w, 'Lirael')];
/** The next 2d6 check rolls these faces, then the world's own stream goes on. */
const rolls = (w: World, faces: number[]) => (w.rng = scriptedThen(faces, w.rng));

describe('hidden sites (Sam’s calls: Explore)', () => {
  it('lie in about one wild hex in 15, the same for a seed, and never on a claimed hex', () => {
    const w = world();
    const map = regionMap(data, w.region);
    const sites = [...sitesIn(data, w.sites.seed, w.region).values()];
    expect(sitesIn(data, w.sites.seed, w.region)).toBe(sitesIn(data, w.sites.seed, w.region));
    expect(sitesIn({ ...data }, w.sites.seed, w.region)).toEqual(
      sitesIn(data, w.sites.seed, w.region),
    );
    expect([...sitesIn(data, w.sites.seed + 1, w.region).keys()]).not.toEqual(
      sites.map((s) => s.key),
    );
    const area = map.width * map.height;
    expect(sites.length).toBeGreaterThan(area / 40);
    expect(sites.length).toBeLessThan(area / 8);
    const ways = data.content.dungeons.filter((x) => x.region === w.region).map((x) => x.entrance);
    for (const s of sites) {
      expect(map.costOf(s.hex)).not.toBeNull();
      expect(map.dangerAt(s.hex)).not.toBe('road');
      expect(map.siteAt(s.hex)).toBeUndefined();
      expect(ways.map(hexKey)).not.toContain(hexKey(s.hex));
    }
    // Every kind can turn up; on one map the rarest (a ruin, weight 1 in 10) may not.
    for (const s of sites) expect(['cache', 'lair', 'ruin', 'shrine']).toContain(s.kind);
    expect(new Set(sites.map((s) => s.kind)).size).toBeGreaterThanOrEqual(3);
    // No weights, no sites.
    const none = only('cache', { weights: { cache: 0, lair: 0, ruin: 0, shrine: 0 } });
    expect(sitesIn(none, w.sites.seed, w.region).size).toBe(0);
  });

  it('turn a lair or a ruin with no monsters to draw on into a cache', () => {
    const quiet = only('lair', {});
    const empty = {
      ...quiet,
      content: {
        ...quiet.content,
        encounterTables: quiet.content.encounterTables.map((t) => ({
          ...t,
          entries: t.entries.map((e) => ({ ...e, nature: 'wary' as const })),
        })),
      },
    };
    const w = world();
    const kinds = new Set([...sitesIn(empty, w.sites.seed, w.region).values()].map((s) => s.kind));
    expect(kinds).toEqual(new Set(['cache']));
    expect(strongestBand(empty, 'nowhere', createRng('x'))).toBeNull();
    expect(hiddenRuin(empty, w.region, { col: 1, row: 1 })).toBeNull();
  });

  it('find nothing in town, without explorers, or where nothing is hidden', () => {
    const w = world();
    expect(explore(w, data, [])).toBe(0);
    expect(explore(w, data, scouts(w))).toBe(0);
    const { w: out } = atSite(only('cache'));
    out.sites.found.push(...sitesIn(only('cache'), out.sites.seed, out.region).keys());
    expect(explore(out, only('cache'), scouts(out))).toBe(1);
    expect(out.log.at(-1)).toContain('Lirael scouts the hex and finds nothing new.');
  });

  it('find a cache on a good Survive check, harder in difficult terrain, and take its loot', () => {
    const d = only('cache');
    const { w, s } = atSite(d);
    rolls(w, [1, 1]);
    expect(explore(w, d, scouts(w))).toBe(1);
    expect(w.sites.found).toEqual([]);
    expect(w.log.at(-1)).toContain('finds nothing new');
    rolls(w, [6, 6]);
    explore(w, d, scouts(w));
    expect(w.sites.found).toEqual([s.key]);
    expect(w.sites.done).toEqual([s.key]);
    expect(w.log.join('\n')).toContain('The party takes 2d6 of loot.');
    // A difficult hex asks two more: the same middling roll finds it in open land only.
    const rough = [...sitesIn(d, w.sites.seed, w.region).values()].find(
      (x) => x !== s && regionMap(d, w.region).terrainAt(x.hex).movement === 'difficult',
    ) as HiddenSite;
    const open = [...sitesIn(d, w.sites.seed, w.region).values()].find(
      (x) => x !== s && regionMap(d, w.region).terrainAt(x.hex).movement === 'open',
    ) as HiddenSite;
    // Dice that make exactly 9 with Lirael's bonus: past 8, short of 10.
    const bonus = checkBonus(d, member(w, 'Lirael'), 'survive', ['wis']);
    const first = Math.min(6, 9 - bonus - 1);
    const faces = [first, 9 - bonus - first];
    for (const [site, foundIt] of [
      [rough, false],
      [open, true],
    ] as const) {
      w.position = { ...site.hex };
      rolls(w, faces);
      explore(w, d, scouts(w));
      expect(w.sites.found.includes(site.key)).toBe(foundIt);
    }
  });

  it('bless the party at a shrine: healing, easing strain, or only words', () => {
    const shrine = (boon: 'heal' | 'strain' | 'none') =>
      only('shrine', { shrines: [{ text: `A ${boon} shrine.`, boon }] });
    const hurt = (w: World) =>
      w.members.forEach((m) => {
        m.character = {
          ...m.character,
          hp: { ...m.character.hp, current: 1 },
          strain: { ...m.character.strain, value: 2 },
        };
      });
    for (const boon of ['heal', 'strain', 'none'] as const) {
      const d = shrine(boon);
      const { w } = atSite(d);
      hurt(w);
      rolls(w, [6, 6]);
      explore(w, d, scouts(w));
      expect(w.log.join('\n')).toContain(`A ${boon} shrine.`);
      const snag = member(w, 'Snag').character;
      expect(snag.hp.current).toBe(boon === 'heal' ? snag.hp.max : 1);
      expect(snag.strain.value).toBe(boon === 'strain' ? 1 : 2);
    }
  });

  it('wake a lair, which waits for the party’s return until beaten, then gives up its loot', () => {
    const d = only('lair');
    const { w, s } = atSite(d);
    camp(w, d, { [member(w, 'Lirael').id]: 'explore' });
    expect(w.encounter).toMatchObject({ garrison: `site:${s.key}`, hostile: true, spotted: true });
    expect(foundSitesIn(w, d, w.region)).toEqual([{ ...s.hex, name: 'A lair', kind: 'lair' }]);
    w.encounter = null;
    emit(w, d, { kind: 'hex-entered' });
    expect((w.encounter as { text: string } | null)?.text).toContain('The lair is still here');
    w.encounter = null;
    emit(w, d, { kind: 'fight-won', quest: null, garrison: `site:${s.key}` });
    expect(w.sites.done).toEqual([s.key]);
    expect(w.log.join('\n')).toContain('The lair is cleared.');
    emit(w, d, { kind: 'fight-won', quest: null, garrison: `site:${s.key}` });
    expect(w.log.filter((l) => l.includes('The lair is cleared.'))).toHaveLength(1);
    emit(w, d, { kind: 'hex-entered' });
    expect(w.encounter).toBeNull();
    expect(foundSitesIn(w, d, w.region)).toEqual([]);
    // Other wins and other hexes leave lairs alone.
    emit(w, d, { kind: 'fight-won', quest: null, garrison: null });
    // Underground, the hex map's lairs keep still.
    w.sites.done = [];
    const barrow = data.content.dungeons[0] as (typeof data.content.dungeons)[number];
    w.position = { ...barrow.entrance };
    w.region = barrow.region;
    enterDungeon(w, data);
    w.position = { ...s.hex };
    w.region = s.key.split(':')[0] as string;
    emit(w, d, { kind: 'hex-entered' });
    expect(w.encounter).toBeNull();
  });

  it('open a small ruin from the hex’s own table, entered and emptied like any other', () => {
    const d = only('ruin');
    const { w, s } = atSite(d);
    expect(foundRuinHere(w, d)).toBeUndefined();
    explore(w, d, scouts(w));
    const ruin = foundRuinHere(w, d);
    expect(ruin).toMatchObject({ kind: 'delve', region: w.region, col: s.hex.col });
    expect(ruin?.wander.table).toBe(regionMap(d, w.region).tableAt(s.hex));
    expect(foundSitesIn(w, d, w.region)).toEqual([{ ...s.hex, name: ruin?.name, kind: 'ruin' }]);
    expect(wayDownHere(w, d)).toEqual({ name: ruin?.name, level: null });
    expect(explore(w, d, scouts(w))).toBe(1);
    expect(enterDungeon(w, d)).toEqual({ ok: true });
    const id = (w.dungeon as NonNullable<World['dungeon']>).dungeon;
    expect(dungeonOf(d, id).name).toBe(ruin?.name);
    expect(goesDown(d, id)).toBe(true);
    expect(ruinOfDungeon(d, id)).toBe(ruin);
    // Its vault, once its guards fall, empties it.
    const last = dungeonOf(d, id).levels.at(-1) as NonNullable<
      ReturnType<typeof dungeonOf>['levels'][number]
    >;
    const vault = last.specials.find((x) => x.kind === 'cache' && x.vault) as {
      at: { x: number; y: number };
    };
    place(w, last.id, vault.at.x, vault.at.y, 'n');
    w.beaten.push(`${id}/${last.id}/${vault.at.x},${vault.at.y}`);
    emit(w, d, { kind: 'cell-entered' });
    expect(w.ruins[ruin?.id as string]?.emptied).toBe(w.day);
    expect(levelOf(d, id, last.id).level.id).toBe(last.id);
    // A save inside it loads back where it was.
    const back = parseWorld(serializeWorld(w), d);
    expect(back.ok && back.world.dungeon?.dungeon).toBe(id);
  });

  it('name hidden ruins only for real regions', () => {
    expect(hiddenRuinById(data, 'hidden-atlantis-1-2')).toBeNull();
    expect(hiddenRuinById(data, 'old-barrow')).toBeNull();
    expect(ruinOfDungeon(data, 'atlantis')).toBeUndefined();
    expect(ruinOfDungeon(data, 'gallows-crypts-v7')?.id).toBe('gallows-crypts');
  });

  it('keep their seed and finds in a save, and older saves get a seed of their own', () => {
    const w = world();
    w.sites.found.push('borderlands:1,1');
    const back = parseWorld(serializeWorld(w), data);
    expect(back.ok && back.world.sites).toEqual(w.sites);
    const up = WORLD_MIGRATIONS[43] as (raw: Record<string, unknown>) => Record<string, unknown>;
    expect(up({ schemaVersion: 43, rng: [12345, 0, 0, 0] })).toEqual({
      schemaVersion: 44,
      rng: [12345, 0, 0, 0],
      sites: { seed: 12346, found: [], done: [] },
    });
    expect(up({ schemaVersion: 43 })).toMatchObject({ sites: { seed: 1 } });
  });
});
