// World saves (docs/plan.md, Save/load): versioned JSON with the RNG state, so a reload continues
// exactly. Characters inside go through the character importer and its migrations.
import { WORLD_SCHEMA_VERSION, WorldSaveSchema, type WorldSave } from '../../data/schemas/index.ts';
import { rngFromState } from '../../rules/rng.ts';
import type { ResourceDie } from '../../rules/resource-die.ts';
import type { GameData } from '../character/context.ts';
import { importCharacter } from '../character/io.ts';
import type { Member, World } from './types.ts';

/** The log kept in saves; older lines are dropped. */
export const SAVED_LOG_LINES = 200;

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
    rations: w.rations,
    hikes: w.hikes,
    camp: w.camp,
    noRecovery: w.noRecovery,
    lastTown: w.lastTown,
    members: w.members,
    encounter: w.encounter,
    log: w.log.slice(-SAVED_LOG_LINES),
  };
  return `${JSON.stringify(save)}\n`;
}

export type WorldLoad = { ok: true; world: World } | { ok: false; errors: string[] };

export function parseWorld(text: string, data: GameData): WorldLoad {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['not valid JSON'] };
  }
  const parsed = WorldSaveSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(file)'}: ${i.message}`),
    };
  }
  const s = parsed.data;
  if (!data.content.regions.some((r) => r.id === s.region))
    return { ok: false, errors: [`unknown region ${s.region}`] };
  const members: Member[] = [];
  const errors: string[] = [];
  for (const m of s.members) {
    const c = importCharacter(JSON.stringify(m.character), data);
    if (c.ok) members.push({ ...m, character: c.character });
    else errors.push(...c.errors.map((e) => `${m.id}: ${e}`));
  }
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
      log: s.log,
      rng: rngFromState(s.rng),
      visited: new Set(s.visited),
      rations: s.rations as ResourceDie,
      members,
    },
  };
}
