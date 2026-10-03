// Wandering encounters (vendor/wwn-srd/2.0 The Rules of the Game/2.12.0, 2.12.6): a check die by
// danger each quarter, a weighted table by terrain, a reaction roll (5.0 Monsters and Foes/
// Reaction Rolls and Parlayeing.md), and an opposed Wis/Notice check to spot the other side first.
import type { Monster } from '../../data/schemas/index.ts';
import { npcCheck, pcWinsOpposed } from '../../rules/checks.ts';
import { roll } from '../../rules/dice.ts';
import { hexKey } from '../../rules/hex.ts';
import { encounterCheck } from '../../rules/overland.ts';
import { reactionRoll, type Reaction } from '../../rules/reaction.ts';
import type { GameData } from '../character/context.ts';
import { characterSheet } from '../character/derived.ts';
import { alive, memberCheck, note } from './members.ts';
import { reactionBonus } from './minds.ts';
import { captiveOf } from './npcs.ts';
import { regionMap } from './region.ts';
import type { Member, World } from './types.ts';

const MAX_PER_ROW = 8;

export function rollEnemies(
  w: World,
  data: GameData,
  tableId: string,
): { rows: string[][]; nature: 'hostile' | 'wary'; captive: string | null } {
  const table = data.content.encounterTables.find((t) => t.id === tableId);
  if (!table) throw new Error(`unknown encounter table ${tableId}`);
  const total = table.entries.reduce((sum, e) => sum + e.weight, 0);
  let pick = w.rng.int(1, total);
  const entry = table.entries.find((e) => (pick -= e.weight) <= 0) as (typeof table.entries)[0];
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
  return (data.srd.monsters.find((m) => m.id === id) as Monster).name;
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
  const { rows, nature, captive } = rollEnemies(w, data, map.terrainAt(w.position).encounters);
  const able = alive(w).filter((m) => m.character.hp.current > 0);
  const cha = Math.max(0, ...able.map((m) => characterSheet(m.character, data).modifiers.cha));
  const { reaction } = reactionRoll(w.rng, cha + reactionBonus(w, data));
  let spotted = false;
  if (watcher) {
    const monsters = rows.flat().map((id) => data.srd.monsters.find((m) => m.id === id) as Monster);
    const theirs = npcCheck(w.rng, {
      skillBonus: Math.max(...monsters.map((m) => m.skill)),
      difficulty: 0,
    });
    const ours = memberCheck(w, data, watcher, 'notice', ['wis'], 0, dark ? -1 : 0);
    spotted = pcWinsOpposed(ours.score, theirs.score);
  }
  const counts = new Map<string, number>();
  for (const id of rows.flat()) counts.set(id, (counts.get(id) ?? 0) + 1);
  const who = [...counts].map(([id, n]) => `${n} ${monsterName(data, id)}`).join(' and ');
  const held = captive ? ` ${captiveOf(data, captive).text}` : '';
  const text = `${spotted ? `${watcher?.character.name} spots` : 'The party meets'} ${who}.${held} ${MOODS[reaction]}`;
  w.encounter = {
    enemies: rows,
    nature,
    reaction,
    parleyed: false,
    captive,
    offer: null,
    hostile: fights(nature, reaction),
    spotted,
    text,
  };
  note(w, `${text} (${hexKey(w.position)})`);
  return true;
}

/** Slipping away from a spotted group, or letting a peaceful one pass. */
export function leaveEncounter(w: World): boolean {
  const e = w.encounter;
  if (!e || (e.hostile && !e.spotted)) return false;
  note(w, e.hostile ? 'The party slips away unseen.' : 'The two groups go their ways.');
  w.encounter = null;
  return true;
}
