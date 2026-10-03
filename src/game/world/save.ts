// World saves (docs/plan.md, Save/load): versioned JSON with the RNG state, so a reload continues
// exactly. Characters inside go through the character importer and its migrations.
import { WORLD_SCHEMA_VERSION, WorldSaveSchema, type WorldSave } from '../../data/schemas/index.ts';
import { rngFromState } from '../../rules/rng.ts';
import type { ResourceDie } from '../../rules/resource-die.ts';
import type { GameData } from '../character/context.ts';
import { importCharacter, type Migrations, type Raw } from '../character/io.ts';
import { NO_LIGHT, type Member, type World } from './types.ts';

/** The log kept in saves; older lines are dropped. */
export const SAVED_LOG_LINES = 200;

const crownsOf = (m: Raw) => {
  const crowns = (m.character as Raw | undefined)?.crowns;
  return typeof crowns === 'number' ? crowns : 0;
};

/** Upgrades a world save from version n to n + 1, keyed by n. */
export const WORLD_MIGRATIONS: Migrations = {
  // Version 2 adds towns (Phase 6a): the members' crowns pool into the purse.
  1: (raw) => {
    const members = Array.isArray(raw.members) ? (raw.members as Raw[]) : [];
    return {
      ...raw,
      schemaVersion: 2,
      members: members.map((m) => ({
        ...m,
        pendingXp: 0,
        character: { ...(m.character as Raw), crowns: 0 },
      })),
      benched: [],
      purse: members.reduce((sum, m) => sum + crownsOf(m), 0),
      loot: [],
      towns: {},
      climateDay: raw.day,
    };
  },
  // Version 3 adds NPCs and parley (Phase 6c): no NPCs yet, and a pending encounter keeps its
  // fight-or-not with a matching mood.
  2: (raw) => {
    const e = raw.encounter as Raw | null | undefined;
    const encounter = e && {
      ...e,
      nature: 'hostile',
      reaction: e.hostile ? 'unfriendly' : 'friendly',
      parleyed: false,
      captive: null,
      offer: null,
    };
    return { ...raw, schemaVersion: 3, npcs: [], encounter: encounter ?? null };
  },
  // Version 4 adds coaches and town arenas (Phase 6d).
  3: (raw) => ({ ...raw, schemaVersion: 4, coach: null, arenaDay: null }),
  // Version 5 adds quests (Phase 6): none taken, and any pending encounter is a wandering one.
  4: (raw) => {
    const e = raw.encounter as Raw | null;
    return { ...raw, schemaVersion: 5, quests: {}, encounter: e && { ...e, quest: null } };
  },
  // Version 6 adds dungeons (Phase 7): the party starts on the surface.
  5: (raw) => ({ ...raw, schemaVersion: 6, dungeon: null }),
  // Version 7 adds exploration turns and light (Phase 8a): kits are ready, nothing is lit.
  6: (raw) => {
    const d = raw.dungeon as Raw | null;
    return {
      ...raw,
      schemaVersion: 7,
      dungeon: d && { ...d, turn: 0, steps: 0 },
      light: NO_LIGHT,
    };
  },
  // Version 8 adds secret doors, traps, and special squares (Phase 8b): nothing found yet.
  7: (raw) => {
    const d = raw.dungeon as Raw | null;
    return {
      ...raw,
      schemaVersion: 8,
      dungeon: d && { ...d, found: {}, glimpsed: {}, traps: {}, read: {} },
    };
  },
  // Version 9 adds dungeon quests and rescues (Phase 8c): no one freed yet.
  8: (raw) => ({ ...raw, schemaVersion: 9, rescues: [] }),
  // Version 10 adds raising quests: none offered or taken yet.
  9: (raw) => ({ ...raw, schemaVersion: 10, raising: { offer: null, accepted: null } }),
  // Version 11 adds crafting (Phase 10a): nothing under way, no workshops owned.
  10: (raw) => ({ ...raw, schemaVersion: 11, projects: [], workshops: [] }),
  // Version 12 adds mods (Phase 10b): every project so far builds gear; no components yet.
  11: (raw) => ({
    ...raw,
    schemaVersion: 12,
    projects: (raw.projects as object[]).map((p) => ({ ...p, kind: 'gear' })),
    components: {},
  }),
  // Version 13 adds craftsmen (Phase 10c): none visited, nothing commissioned.
  12: (raw) => ({ ...raw, schemaVersion: 13, craftsmen: {}, commissions: [] }),
  // Version 14 adds regions (Phase 12): every hex explored so far is in the current one.
  13: (raw) => ({ ...raw, schemaVersion: 14, elsewhere: {} }),
};

export function serializeWorld(w: World): string {
  const save: WorldSave = {
    schemaVersion: WORLD_SCHEMA_VERSION,
    region: w.region,
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
    craftsmen: w.craftsmen,
    commissions: w.commissions,
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
  if (!data.content.regions.some((r) => r.id === s.region))
    return { ok: false, errors: [`unknown region ${s.region}`] };
  const errors: string[] = [];
  const party = members(s.members, data, errors);
  const benched = members(s.benched, data, errors);
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    world: {
      region: s.region,
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
      craftsmen: s.craftsmen,
      commissions: s.commissions,
      log: s.log,
      rng: rngFromState(s.rng),
      visited: new Set(s.visited),
      elsewhere: s.elsewhere,
      rations: s.rations as ResourceDie,
      members: party,
      benched,
      npcs: s.npcs,
      purse: s.purse,
      loot: s.loot,
      towns: s.towns,
      climateDay: s.climateDay,
    },
  };
}
