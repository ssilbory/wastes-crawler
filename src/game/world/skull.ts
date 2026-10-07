// Query the Skull (vendor/wwn-srd/4.0 Magic and Spellcasting/4.6.0 Necromancer Spells.md; Sam's
// call, docs/rules-adaptation.md, Necromancer spells outside fights): the corpses where the party
// last won a fight, dead no more than a day per caster level, answer one question per caster level.
// The questions are fixed: below ground, the level's map, its traps, or its secret doors; above
// ground, the lay of the land around. The spell may not be cast twice on the same corpses.
import { cellKey, FACINGS, type Cell } from '../../rules/grid.ts';
import { distance, hexKey } from '../../rules/hex.ts';
import { characterLevel } from '../../rules/progression.ts';
import type { GameData } from '../character/context.ts';
import { levelOf } from '../dungeon/explore.ts';
import { edgeKey } from '../dungeon/secrets.ts';
import { cannotCast } from './casting.ts';
import { note } from './members.ts';
import { corpsesHere } from './necromancy.ts';
import { regionMap } from './region.ts';
import type { TownResult } from './services.ts';
import type { Member, World } from './types.ts';

export const QUERY_THE_SKULL = 'query-the-skull';

export type SkullQuestion = 'map' | 'traps' | 'secrets' | 'land';

/** How far around the party the dead describe the land, in hexes (Sam's call). */
export const LAND_RADIUS = 3;

const no = (reason: string): TownResult => ({ ok: false, reason });

/** The questions the dead can answer where the party stands. */
export const skullQuestions = (w: World): SkullQuestion[] =>
  w.dungeon ? ['map', 'traps', 'secrets'] : ['land'];

/** Why the corpses here can't be questioned by this caster, or null if they can. */
export function cannotQuery(w: World, m: Member): string | null {
  const c = w.corpses;
  if (!c || corpsesHere(w).length === 0) return 'There are no corpses here.';
  if (c.queried) return 'These dead have already spoken.';
  if (w.day - c.day > characterLevel(m.character.classes))
    return 'These dead are too long gone to answer.';
  return null;
}

function cells(w: World, data: GameData): { level: string; all: Cell[] } {
  const s = w.dungeon as NonNullable<World['dungeon']>;
  const { map } = levelOf(data, s.dungeon, s.level);
  const all: Cell[] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) all.push({ x, y });
  return { level: s.level, all };
}

const answers: Record<SkullQuestion, (w: World, data: GameData) => string> = {
  map: (w, data) => {
    const s = w.dungeon as NonNullable<World['dungeon']>;
    const { level, all } = cells(w, data);
    s.seen[level] = [...new Set([...(s.seen[level] ?? []), ...all.map(cellKey)])];
    return 'The dead recall every passage of this level.';
  },
  traps: (w, data) => {
    const s = w.dungeon as NonNullable<World['dungeon']>;
    const known = { ...s.traps[s.level] };
    for (const t of levelOf(data, s.dungeon, s.level).level.traps) {
      const key = cellKey(t.at);
      if (known[key] !== 'disarmed') known[key] = 'noticed';
    }
    s.traps[s.level] = known;
    return 'The dead name every snare on this level.';
  },
  secrets: (w, data) => {
    const s = w.dungeon as NonNullable<World['dungeon']>;
    const { map } = levelOf(data, s.dungeon, s.level);
    const found = new Set(s.found[s.level] ?? []);
    for (const c of cells(w, data).all)
      for (const side of FACINGS) if (map.edge(c, side) === 'secret') found.add(edgeKey(c, side));
    s.found[s.level] = [...found];
    return 'The dead tell of every hidden door on this level.';
  },
  land: (w, data) => {
    const map = regionMap(data, w.region);
    for (let row = 0; row < map.height; row++)
      for (let col = 0; col < map.width; col++)
        if (distance(w.position, { col, row }) <= LAND_RADIUS) w.visited.add(hexKey({ col, row }));
    return 'The dead describe the land about.';
  },
};

/** Query the Skull: the corpses here answer the chosen questions, one per caster level. */
export function queryTheSkull(
  w: World,
  data: GameData,
  memberId: string,
  questions: SkullQuestion[],
): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const m = w.members.find((x) => x.id === memberId);
  const why = cannotCast(data, m, QUERY_THE_SKULL);
  if (why) return no(why);
  const caster = m as Member;
  const dead = cannotQuery(w, caster);
  if (dead) return no(dead);
  const asked = [...new Set(questions)];
  const open = skullQuestions(w);
  if (asked.length === 0 || asked.some((q) => !open.includes(q)))
    return no('Ask the dead something they can answer here.');
  const level = characterLevel(caster.character.classes);
  if (asked.length > level)
    return no(
      `${caster.character.name} can ask no more than ${level} question${level === 1 ? '' : 's'}.`,
    );
  caster.spellsCast += 1;
  (w.corpses as NonNullable<World['corpses']>).queried = true;
  note(w, `${caster.character.name} questions the dead.`);
  for (const q of asked) note(w, answers[q](w, data));
  return { ok: true };
}
