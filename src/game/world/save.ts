// World saves (docs/plan.md, Save/load): versioned JSON with the RNG state, so a reload continues
// exactly. Characters inside go through the character importer and its migrations.
import { parseLevelMap } from '../../data/dungeon-map.ts';
import {
  WORLD_SCHEMA_VERSION,
  WorldSaveSchema,
  type DungeonState,
  type WorldSave,
} from '../../data/schemas/index.ts';
import { rngFromState } from '../../rules/rng.ts';
import type { ResourceDie } from '../../rules/resource-die.ts';
import type { GameData } from '../character/context.ts';
import { importCharacter, type Raw } from '../character/io.ts';
import { note } from './members.ts';
import { WORLD_MIGRATIONS } from './save-migrations.ts';
import type { Member, World } from './types.ts';

/** The log kept in saves; older lines are dropped. */
export const SAVED_LOG_LINES = 200;

export function serializeWorld(w: World): string {
  const save: WorldSave = {
    schemaVersion: WORLD_SCHEMA_VERSION,
    region: w.region,
    map: w.map,
    rng: [...w.rng.state()],
    day: w.day,
    quarter: w.quarter,
    position: w.position,
    destination: w.destination,
    visited: [...w.visited],
    elsewhere: w.elsewhere,
    rations: w.rations,
    hikes: w.hikes,
    camp: w.camp,
    noRecovery: w.noRecovery,
    lastTown: w.lastTown,
    members: w.members,
    benched: w.benched,
    npcs: w.npcs,
    mounts: w.mounts,
    purse: w.purse,
    loot: w.loot,
    towns: w.towns,
    climateDay: w.climateDay,
    encounter: w.encounter,
    coach: w.coach,
    arenaDay: w.arenaDay,
    quests: w.quests,
    dungeon: w.dungeon,
    light: w.light,
    rescues: w.rescues,
    raising: w.raising,
    projects: w.projects,
    workshops: w.workshops,
    components: w.components,
    countersigns: w.countersigns,
    beaten: w.beaten,
    clock: w.clock,
    notes: w.notes,
    ending: w.ending,
    hirelingDays: w.hirelingDays,
    deadShares: w.deadShares,
    hireBans: w.hireBans,
    ruins: w.ruins,
    caches: w.caches,
    rumors: w.rumors,
    ordersEnded: w.ordersEnded,
    authority: w.authority,
    raid: w.raid,
    raided: w.raided,
    craftsmen: w.craftsmen,
    commissions: w.commissions,
    corpses: w.corpses,
    fallen: w.fallen,
    performedDay: w.performedDay,
    bestiary: [...w.bestiary],
    factions: w.factions,
    disguise: w.disguise,
    palanquin: w.palanquin,
    pacts: w.pacts,
    log: w.log.slice(-SAVED_LOG_LINES),
  };
  return `${JSON.stringify(save)}\n`;
}

export type WorldLoad = { ok: true; world: World } | { ok: false; errors: string[] };

function migrate(raw: unknown): Raw | string {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'not a world save';
  let doc = raw as Raw;
  let version = doc.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version)) return 'schemaVersion is missing';
  if (version > WORLD_SCHEMA_VERSION) return `made by a newer version of the game (${version})`;
  for (; version < WORLD_SCHEMA_VERSION; version++) {
    const step = WORLD_MIGRATIONS[version];
    if (!step) return `no upgrade from schema ${version}`;
    doc = step(doc);
  }
  return doc;
}

function members(saved: WorldSave['members'], data: GameData, errors: string[]): Member[] {
  const out: Member[] = [];
  for (const m of saved) {
    const c = importCharacter(JSON.stringify(m.character), data);
    if (c.ok) out.push({ ...m, character: c.character });
    else errors.push(...c.errors.map((e) => `${m.id}: ${e}`));
  }
  return out;
}

/**
 * Whether the party's place underground is still there: a saved dungeon can be deleted or redrawn
 * in the editor after the party went down (Sam's call). Ruins are rebuilt from their seed.
 */
function standsIn(s: DungeonState, data: GameData): boolean {
  const d = data.content.dungeons.find((x) => x.id === s.dungeon);
  if (!d) return data.content.ruins.some((r) => s.dungeon.startsWith(`${r.id}-v`));
  const level = d.levels.find((l) => l.id === s.level);
  const parsed = level ? parseLevelMap(level.map) : null;
  return parsed?.ok === true && parsed.map.inBounds(s.at);
}

export function parseWorld(text: string, data: GameData): WorldLoad {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['not valid JSON'] };
  }
  const doc = migrate(raw);
  if (typeof doc === 'string') return { ok: false, errors: [doc] };
  const parsed = WorldSaveSchema.safeParse(doc);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(file)'}: ${i.message}`),
    };
  }
  const s = parsed.data;
  if (s.map ? s.map.id !== s.region : !data.content.regions.some((r) => r.id === s.region))
    return { ok: false, errors: [`unknown region ${s.region}`] };
  const errors: string[] = [];
  const party = members(s.members, data, errors);
  const benched = members(s.benched, data, errors);
  if (errors.length > 0) return { ok: false, errors };
  const world = {
    region: s.region,
    map: s.map,
    day: s.day,
    quarter: s.quarter,
    position: s.position,
    destination: s.destination,
    hikes: s.hikes,
    camp: s.camp,
    noRecovery: s.noRecovery,
    lastTown: s.lastTown,
    encounter: s.encounter,
    coach: s.coach,
    arenaDay: s.arenaDay,
    quests: s.quests,
    dungeon: s.dungeon,
    light: {
      ...s.light,
      torch: s.light.torch as ResourceDie,
      lantern: s.light.lantern as ResourceDie,
    },
    rescues: s.rescues,
    raising: s.raising,
    projects: s.projects,
    workshops: s.workshops,
    components: s.components,
    countersigns: s.countersigns,
    beaten: s.beaten,
    clock: s.clock,
    notes: s.notes,
    ending: s.ending,
    hirelingDays: s.hirelingDays,
    deadShares: s.deadShares,
    hireBans: s.hireBans,
    ruins: s.ruins,
    caches: s.caches,
    rumors: s.rumors,
    ordersEnded: s.ordersEnded,
    authority: s.authority,
    raid: s.raid,
    raided: s.raided,
    craftsmen: s.craftsmen,
    commissions: s.commissions,
    corpses: s.corpses,
    fallen: s.fallen,
    performedDay: s.performedDay,
    bestiary: [...s.bestiary],
    factions: s.factions,
    disguise: s.disguise,
    palanquin: s.palanquin,
    pacts: s.pacts,
    log: s.log,
    rng: rngFromState(s.rng),
    visited: new Set(s.visited),
    elsewhere: s.elsewhere,
    rations: s.rations as ResourceDie,
    members: party,
    benched,
    npcs: s.npcs,
    mounts: s.mounts,
    purse: s.purse,
    loot: s.loot,
    towns: s.towns,
    climateDay: s.climateDay,
  };
  if (world.dungeon && !standsIn(world.dungeon, data)) {
    world.dungeon = null;
    note(
      world,
      'The way down has changed beyond knowing; the party finds itself back on the surface.',
    );
  }
  return { ok: true, world };
}
