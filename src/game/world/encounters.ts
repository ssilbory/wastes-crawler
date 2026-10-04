// Wandering encounters (vendor/wwn-srd/2.0 The Rules of the Game/2.12.0, 2.12.6): a check die by
// danger each quarter, a weighted table by terrain, a reaction roll (5.0 Monsters and Foes/
// Reaction Rolls and Parlayeing.md), and an opposed Wis/Notice check to spot the other side first.
import type { Monster, PendingEncounter } from '../../data/schemas/index.ts';
import { npcCheck, pcWinsOpposed } from '../../rules/checks.ts';
import { roll } from '../../rules/dice.ts';
import { hexKey } from '../../rules/hex.ts';
import { encounterCheck } from '../../rules/overland.ts';
import { reactionRoll, type Reaction } from '../../rules/reaction.ts';
import { findMonster, type GameData } from '../character/context.ts';
import { characterSheet } from '../character/derived.ts';
import { alive, memberCheck, note } from './members.ts';
import { reactionBonus } from './minds.ts';
import { captiveOf } from './npcs.ts';
import { regionMap } from './region.ts';
import type { Member, World } from './types.ts';

const MAX_PER_ROW = 8;

export interface Rolled {
  rows: string[][];
  nature: 'hostile' | 'wary';
  captive: string | null;
  /** A bound patrol's standing order (Phase 12b). */
  order?: string;
  /** Paladin "rescuers" (Phase 12b). */
  rescuers?: true;
}

export function rollEnemies(w: World, data: GameData, tableId: string): Rolled {
  const table = data.content.encounterTables.find((t) => t.id === tableId);
  if (!table) throw new Error(`unknown encounter table ${tableId}`);
  // Warlord patrols join the tables as the clock fills (Phase 12d).
  const entries = table.entries.filter((e) => (e.minClock ?? 0) <= w.clock);
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let pick = w.rng.int(1, total);
  const entry = entries.find((e) => (pick -= e.weight) <= 0) as (typeof entries)[0];
  const rows: string[][] = [[], [], []];
  for (const g of entry.groups) {
    const n = typeof g.count === 'number' ? g.count : Math.max(1, roll(w.rng, g.count).total);
    const row = rows[g.row] as string[];
    for (let i = 0; i < n && row.length < MAX_PER_ROW; i++) row.push(g.monster);
  }
  return {
    rows: rows.filter((r) => r.length > 0),
    nature: entry.nature,
    captive: entry.captive ?? null,
    ...(entry.order ? { order: entry.order } : {}),
    ...(entry.rescuers ? { rescuers: true as const } : {}),
  };
}

/** Whether a group of this nature fights at this reaction. */
export const fights = (nature: 'hostile' | 'wary', reaction: Reaction) =>
  FIGHTS[nature].includes(reaction);

const FIGHTS: Record<'hostile' | 'wary', Reaction[]> = {
  hostile: ['aggressive', 'unfriendly', 'expected'],
  wary: ['aggressive', 'unfriendly'],
};

export const MOODS: Record<Reaction, string> = {
  aggressive: 'They charge at once.',
  unfriendly: 'They look for a fight.',
  expected: 'They size the party up.',
  friendly: 'They seem in no mood for trouble.',
  helpful: 'They wave in greeting.',
};

function monsterName(data: GameData, id: string): string {
  return (findMonster(data, id) as Monster).name;
}

/** Makes the quarter's check; on a hit, sets up the encounter and returns true. */
export function maybeEncounter(
  w: World,
  data: GameData,
  watcher: Member | undefined,
  dark: boolean,
): boolean {
  const map = regionMap(data, w.region);
  const die = data.content.overlandRules.encounterDice[map.dangerAt(w.position)];
  if (map.siteAt(w.position) || !encounterCheck(w.rng, die)) return false;
  const rolled = rollEnemies(w, data, map.tableAt(w.position));
  // A patrol whose standing order has ended no longer walks the roads.
  if (rolled.order && w.ordersEnded.includes(rolled.order)) return false;
  startEncounter(w, data, rolled, watcher, dark ? -1 : 0, hexKey(w.position));
  return true;
}

/**
 * Sets up a rolled group: a reaction roll, and an opposed Wis/Notice check by the watcher, if any,
 * to spot them first. `steps` adjusts the watcher's check; null means they can't spot anything.
 */
export function startEncounter(
  w: World,
  data: GameData,
  rolled: Rolled,
  watcher: Member | undefined,
  steps: number | null,
  where: string,
): void {
  const { rows, captive } = rolled;
  const taken = rolled.rescuers ? rescueTarget(w) : undefined;
  const nature = taken ? 'hostile' : rolled.nature;
  const { reaction } = reactionRoll(w.rng, partyCha(w, data) + reactionBonus(w, data));
  let spotted = false;
  if (watcher && steps !== null) {
    const monsters = rows.flat().map((id) => findMonster(data, id) as Monster);
    const theirs = npcCheck(w.rng, {
      skillBonus: Math.max(...monsters.map((m) => m.skill)),
      difficulty: 0,
    });
    const ours = memberCheck(w, data, watcher, 'notice', ['wis'], 0, steps);
    spotted = pcWinsOpposed(ours.score, theirs.score);
  }
  const counts = new Map<string, number>();
  for (const id of rows.flat()) counts.set(id, (counts.get(id) ?? 0) + 1);
  const who = [...counts].map(([id, n]) => `${n} ${monsterName(data, id)}`).join(' and ');
  const held = captive
    ? ` ${captiveOf(data, captive).text}`
    : taken
      ? ` They have come to "rescue" ${taken.character.name}.`
      : '';
  const lead = `${spotted ? `${watcher?.character.name} spots` : 'The party meets'} ${who}.${held}`;
  const e = setEncounter(
    w,
    rows,
    nature,
    reaction,
    captive,
    null,
    taken !== undefined || fights(nature, reaction),
    spotted,
    lead,
    where,
  );
  if (rolled.order) e.order = rolled.order;
}

/**
 * Paladin "rescuers" (docs/setting.md, Human strongholds): the fanatics mean to carry off an elf or
 * gnome in the party, and fight for them whatever their mood.
 */
const RESCUED = ['elf', 'gnome'];
const rescueTarget = (w: World) => alive(w).find((m) => RESCUED.includes(m.character.people));

function setEncounter(
  w: World,
  rows: string[][],
  nature: 'hostile' | 'wary',
  reaction: Reaction,
  captive: string | null,
  quest: string | null,
  hostile: boolean,
  spotted: boolean,
  lead: string,
  where: string,
): PendingEncounter {
  const text = `${lead} ${MOODS[reaction]}`;
  const e: PendingEncounter = {
    enemies: rows,
    nature,
    reaction,
    parleyed: false,
    captive,
    offer: null,
    quest,
    hostile,
    spotted,
    text,
  };
  w.encounter = e;
  note(w, `${text} (${where})`);
  return e;
}

/** A group that means to fight whatever its mood: an ambush or a quest's fixed encounter. */
export function meetGroup(
  w: World,
  data: GameData,
  rows: string[][],
  nature: 'hostile' | 'wary',
  captive: string | null,
  quest: string | null,
  lead: string,
  where = hexKey(w.position),
): PendingEncounter {
  const { reaction } = reactionRoll(w.rng, partyCha(w, data) + reactionBonus(w, data));
  return setEncounter(w, rows, nature, reaction, captive, quest, true, false, lead, where);
}

function partyCha(w: World, data: GameData): number {
  const able = alive(w).filter((m) => m.character.hp.current > 0);
  return Math.max(0, ...able.map((m) => characterSheet(m.character, data).modifiers.cha));
}

/** Slipping away from a spotted group, or letting a peaceful one pass. */
export function leaveEncounter(w: World): boolean {
  const e = w.encounter;
  if (!e || (e.hostile && !e.spotted)) return false;
  note(w, e.hostile ? 'The party slips away unseen.' : 'The two groups go their ways.');
  w.encounter = null;
  return true;
}
