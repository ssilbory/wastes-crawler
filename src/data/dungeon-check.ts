// Level validation (docs/decisions/0003-level-authoring.md): every level parses, stairs and links
// match, links and the entry land on real cells, the entrance is on passable land, and every open
// cell is reachable from the entry, taking stairs between levels and secret doors as passages.
import { parseLevelMap, type LevelMap } from './dungeon-map.ts';
import type { Cell, ContentData, Dungeon, Facing } from './schemas/index.ts';

const SIDES: readonly Facing[] = ['n', 'e', 's', 'w'];
const STEP: Record<Facing, Cell> = {
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
};
const key = (level: string, c: Cell) => `${level}:${c.x},${c.y}`;

function dungeonErrors(d: Dungeon, content: ContentData): string[] {
  const errors: string[] = [];
  const where = `dungeons/${d.id}`;
  const maps = new Map<string, LevelMap>();
  for (const level of d.levels) {
    const parsed = parseLevelMap(level.map);
    if (!parsed.ok) errors.push(...parsed.errors.map((e) => `${where}/${level.id}: ${e}`));
    else maps.set(level.id, parsed.map);
  }
  if (errors.length > 0) return errors;
  const onFloor = (level: string, c: Cell) => maps.get(level)?.inBounds(c) === true;
  for (const level of d.levels) {
    const map = maps.get(level.id) as LevelMap;
    const linked = new Set(level.links.map((l) => `${l.at.x},${l.at.y}`));
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const kind = map.cell({ x, y });
        if ((kind === 'up' || kind === 'down') && !linked.has(`${x},${y}`))
          errors.push(`${where}/${level.id}: stairs at ${x},${y} lead nowhere`);
      }
    if (level.wander && !content.encounterTables.some((t) => t.id === level.wander?.table))
      errors.push(`${where}/${level.id}: unknown encounter table ${level.wander.table}`);
    const lw = `${where}/${level.id}`;
    const trapped = new Set(level.traps.map((t) => `${t.at.x},${t.at.y}`));
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++)
        if (map.cell({ x, y }) === 'trap' && !trapped.has(`${x},${y}`))
          errors.push(`${lw}: the trap at ${x},${y} has no details`);
    for (const t of level.traps)
      if (!map.inBounds(t.at) || map.cell(t.at) !== 'trap')
        errors.push(`${lw}: trap ${t.name} at ${t.at.x},${t.at.y} is not on a T`);
    const held = new Set(level.captives.map((c) => `${c.at.x},${c.at.y}`));
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++)
        if (map.cell({ x, y }) === 'npc' && !held.has(`${x},${y}`))
          errors.push(`${lw}: the NPC at ${x},${y} has no details`);
    for (const c of level.captives)
      if (!map.inBounds(c.at) || map.cell(c.at) !== 'npc')
        errors.push(`${lw}: captive at ${c.at.x},${c.at.y} is not on an N`);
    for (const sc of level.secrets)
      if (!map.inBounds(sc.at) || map.edge(sc.at, sc.side) !== 'secret')
        errors.push(`${lw}: secret at ${sc.at.x},${sc.at.y},${sc.side} is not on a secret door`);
    for (const sp of level.specials) {
      if (!map.inBounds(sp.at))
        errors.push(`${lw}: ${sp.kind} at ${sp.at.x},${sp.at.y} is off the level`);
      if (sp.kind === 'teleporter' && !onFloor(sp.to.level, sp.to.at))
        errors.push(`${lw}: teleporter at ${sp.at.x},${sp.at.y} goes to a cell that isn't there`);
    }
    // Furniture dresses plain floor, one piece a cell, clear of stairs, traps, and people.
    const dressed = new Set<string>();
    for (const f of level.furniture ?? []) {
      const at = `${lw}: ${f.kind} at ${f.at.x},${f.at.y}`;
      if (!map.inBounds(f.at) || map.cell(f.at) !== 'floor')
        errors.push(`${at} is not on plain floor`);
      else if (dressed.has(`${f.at.x},${f.at.y}`)) errors.push(`${at} shares its cell`);
      dressed.add(`${f.at.x},${f.at.y}`);
    }
    for (const c of level.safe)
      if (!map.inBounds(c))
        errors.push(`${where}/${level.id}: safe square ${c.x},${c.y} is off the level`);
      // Pierce the Pallid Gate lands the party on safe squares with no trap to spring.
      else if (map.cell(c) === 'trap')
        errors.push(`${where}/${level.id}: safe square ${c.x},${c.y} is on a trap`);
    for (const l of level.links) {
      const at = `${where}/${level.id}: link at ${l.at.x},${l.at.y}`;
      if (!map.inBounds(l.at) || !['up', 'down'].includes(map.cell(l.at)))
        errors.push(`${at} is not on stairs`);
      if ('level' in l.to && !onFloor(l.to.level, l.to.at))
        errors.push(`${at} goes to a cell that isn't there`);
      if ('surface' in l.to && map.inBounds(l.at) && map.cell(l.at) !== 'up')
        errors.push(`${at} leads up to the surface from stairs down`);
    }
  }
  if (!onFloor(d.entry.level, d.entry.at)) {
    errors.push(`${where}: the entry isn't on a level`);
    return errors;
  }
  // Every open cell, on every level, reachable from the entry.
  const seen = new Set([key(d.entry.level, d.entry.at)]);
  const queue: [string, Cell][] = [[d.entry.level, d.entry.at]];
  while (queue.length > 0) {
    const [level, c] = queue.shift() as [string, Cell];
    const map = maps.get(level) as LevelMap;
    const next: [string, Cell][] = SIDES.filter((s) => map.edge(c, s) !== 'wall').map((s) => [
      level,
      { x: c.x + STEP[s].x, y: c.y + STEP[s].y },
    ]);
    for (const l of d.levels.find((x) => x.id === level)?.links ?? [])
      if (l.at.x === c.x && l.at.y === c.y && 'level' in l.to && onFloor(l.to.level, l.to.at))
        next.push([l.to.level, l.to.at]);
    for (const [lv, n] of next) {
      if (seen.has(key(lv, n))) continue;
      seen.add(key(lv, n));
      queue.push([lv, n]);
    }
  }
  for (const level of d.levels) {
    const map = maps.get(level.id) as LevelMap;
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const c = { x, y };
        const open = SIDES.some((s) => map.edge(c, s) !== 'wall') || map.cell(c) !== 'floor';
        if (open && !seen.has(key(level.id, c)))
          errors.push(`${where}/${level.id}: ${x},${y} can't be reached from the entry`);
      }
  }
  const region = content.regions.find((r) => r.id === d.region);
  if (!region) errors.push(`${where}: unknown region ${d.region}`);
  else {
    const glyph = region.terrain[d.entrance.row]?.[d.entrance.col];
    const terrain = content.terrains.find((t) => t.glyph === glyph);
    if (!terrain || terrain.movement === 'impassable')
      errors.push(`${where}: the entrance isn't on passable land`);
    else if (region.sites.some((s) => s.col === d.entrance.col && s.row === d.entrance.row))
      errors.push(`${where}: the entrance is in a town`);
  }
  return errors;
}

/** Each way down has a hex of its own: a dungeon on another's, or a ruin's, could never be entered. */
function sharedEntrances(content: ContentData): string[] {
  const taken = new Map<string, string>(
    content.ruins.map((r) => [`${r.region}:${r.col},${r.row}`, r.id]),
  );
  return content.dungeons.flatMap((d) => {
    const at = `${d.region}:${d.entrance.col},${d.entrance.row}`;
    const other = taken.get(at);
    taken.set(at, other ?? d.id);
    // A ruin's own levels, generated as `<ruin>-v<seed>`, stand on its hex.
    return other && !d.id.startsWith(`${other}-v`)
      ? [`dungeons/${d.id}: the entrance is on ${other}'s hex`]
      : [];
  });
}

/**
 * Every dungeon's level problems, then entrances on another's hex. With `only`, just those
 * dungeons' own levels are checked: one dungeon's levels never depend on another's.
 */
export function dungeonReferenceErrors(
  content: ContentData,
  only: readonly Dungeon[] = content.dungeons,
): string[] {
  return [...only.flatMap((d) => dungeonErrors(d, content)), ...sharedEntrances(content)];
}
