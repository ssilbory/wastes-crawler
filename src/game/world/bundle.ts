// Full game saves (docs/plan.md, Phase 11, Persistence): one file holding the world and the
// character roster. Loading takes either a full save or a plain world save from earlier phases.
import {
  RegionSchema,
  SAVE_BUNDLE_KIND,
  SaveBundleSchema,
  type Region,
} from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { parseRoster, serializeRoster, type RosterEntry } from '../character/roster.ts';
import { parseWorld, serializeWorld } from './save.ts';
import type { World } from './types.ts';

export function serializeBundle(w: World, roster: readonly RosterEntry[]): string {
  const bundle = {
    kind: SAVE_BUNDLE_KIND,
    version: 1,
    world: JSON.parse(serializeWorld(w)) as unknown,
    roster: JSON.parse(serializeRoster(roster)) as unknown,
  };
  return `${JSON.stringify(bundle)}\n`;
}

export type LoadedSave =
  { ok: true; world: World; roster: RosterEntry[] | null } | { ok: false; errors: string[] };

/** Reads a full save or a plain world save; the roster is null for a plain world save. */
export function parseSave(text: string, data: GameData): LoadedSave {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['not valid JSON'] };
  }
  const kind = (raw as { kind?: unknown } | null)?.kind;
  if (kind !== SAVE_BUNDLE_KIND) {
    const world = parseWorld(text, data);
    return world.ok ? { ok: true, world: world.world, roster: null } : world;
  }
  const bundle = SaveBundleSchema.safeParse(raw);
  if (!bundle.success) return { ok: false, errors: ['the save file is damaged'] };
  const world = parseWorld(JSON.stringify(bundle.data.world), data);
  if (!world.ok) return world;
  const roster = parseRoster(JSON.stringify(bundle.data.roster), data);
  if (roster.errors.length > 0) return { ok: false, errors: roster.errors };
  return { ok: true, world: world.world, roster: roster.entries };
}

/** The roster after loading a full save: its characters added, replacing any with the same id. */
export function mergeRoster(
  current: readonly RosterEntry[],
  incoming: readonly RosterEntry[],
): RosterEntry[] {
  const ids = new Set(incoming.map((e) => e.id));
  return [...current.filter((e) => !ids.has(e.id)), ...incoming];
}

/**
 * The custom map a save's world is played on, or null: read before loading, so the map and its
 * dungeons can be put into the game's content first. Anything unreadable is null; loading says why.
 */
export function savedMap(text: string): Region | null {
  try {
    const raw = JSON.parse(text) as { kind?: unknown; world?: { map?: unknown }; map?: unknown };
    const map = raw.kind === SAVE_BUNDLE_KIND ? raw.world?.map : raw.map;
    return RegionSchema.safeParse(map).data ?? null;
  } catch {
    return null;
  }
}
