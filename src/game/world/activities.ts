// Journey activities (docs/rules-adaptation.md, Overland travel): Hike with Lead the Way and the
// Exert check past two quarters a day, and camp quarters of resting, sleeping, foraging, hunting,
// making camp, and keeping watch. Forage difficulties follow SRD 2.12.5.
import type { Mishap } from '../../data/schemas/index.ts';
import { npcCheck } from '../../rules/checks.ts';
import { roll } from '../../rules/dice.ts';
import { hexKey } from '../../rules/hex.ts';
import { EXERT_DIFFICULTY, FREE_HIKES, HIKE_POINTS } from '../../rules/overland.ts';
import { stepDie } from '../../rules/resource-die.ts';
import { rollSave } from '../../rules/saves.ts';
import type { GameData } from '../character/context.ts';
import { characterSheet } from '../character/derived.ts';
import { addMemberStrain, alive, bestAt, hurt, memberCheck, note, restQuarter } from './members.ts';
import { guideOf } from './npcs.ts';
import { findPath, regionMap, seenHexes } from './region.ts';
import { enterTown } from './town.ts';
import type { Activity, Member, World } from './types.ts';

/** Effects that need the caller's attention after a mishap. */
export interface MishapOutcome {
  endMarch: boolean;
  extraChecks: number;
}

function pickMishap(w: World, data: GameData, table: Mishap['table']): Mishap {
  const list = data.content.mishaps.filter((m) => m.table === table);
  let pick = w.rng.int(
    1,
    list.reduce((sum, m) => sum + m.weight, 0),
  );
  return list.find((m) => (pick -= m.weight) <= 0) as Mishap;
}

export function mishap(w: World, data: GameData, table: Mishap['table']): MishapOutcome {
  const m = pickMishap(w, data, table);
  note(w, m.text);
  const out: MishapOutcome = { endMarch: false, extraChecks: 0 };
  const living = alive(w);
  const victims = (who: 'one' | 'all') =>
    who === 'all' ? living : [living[w.rng.int(0, living.length - 1)] as Member];
  const e = m.effect;
  switch (e.kind) {
    case 'end-march':
      out.endMarch = true;
      break;
    case 'damage':
      for (const v of victims(e.who)) hurt(w, v, roll(w.rng, e.dice).total);
      break;
    case 'strain':
      for (const v of victims(e.who)) addMemberStrain(w, data, v, e.amount, 'condition');
      break;
    case 'rations':
      w.rations = stepDie(w.rations, e.steps);
      break;
    case 'no-recovery':
      w.noRecovery = true;
      break;
    case 'encounter':
      out.extraChecks = 1;
      break;
  }
  return out;
}

/** The Overloaded house rule: a Physical save on entering each hex, or 1 System Strain. */
function overloadedSaves(w: World, data: GameData): void {
  for (const m of alive(w)) {
    const sheet = characterSheet(m.character, data);
    if (sheet.equipment.load.state === 'ok') continue;
    const steps = m.character.strain.broken ? -1 : 0;
    if (rollSave(w.rng, sheet.saves.physical, { steps }).success) continue;
    note(w, `${m.character.name} staggers under the load.`);
    addMemberStrain(w, data, m, 1, 'overloaded');
  }
}

const byId = (w: World, id: string | null) => alive(w).find((m) => m.id === id);

/**
 * Lead the Way: a PC's Wis/Survive check, or a Wilderness Guide's flat +1 (SRD 3.3.0, common
 * hirelings' total bonus); no leader at all is a failure.
 */
function leadTheWay(
  w: World,
  data: GameData,
  leaderId: string | null,
  difficulty: number,
  dark: boolean,
): boolean {
  const steps = dark ? -1 : 0;
  const leader = byId(w, leaderId);
  if (leader) return memberCheck(w, data, leader, 'survive', ['wis'], difficulty, steps).success;
  if (!guideOf(w, data, leaderId)) return false;
  const skillBonus = data.content.npcRules.skillBonus;
  return npcCheck(w.rng, { skillBonus, difficulty, steps }).success;
}

/** One quarter of hiking toward the destination. Returns extra encounter checks owed. */
export function hike(w: World, data: GameData, leaderId: string | null, dark: boolean): number {
  const map = regionMap(data, w.region);
  const path = w.destination && findPath(map, w.position, w.destination, seenHexes(map, w.visited));
  if (!path) {
    note(w, 'The party has nowhere it can hike to.');
    return 0;
  }
  if (w.hikes >= FREE_HIKES) {
    const tired = alive(w).filter(
      (m) => !memberCheck(w, data, m, 'exert', ['str', 'con'], EXERT_DIFFICULTY).success,
    );
    w.hikes += 1;
    if (tired.length > 0) {
      note(w, `${tired.map((m) => m.character.name).join(' and ')} can't go on; the march ends.`);
      return 0;
    }
  } else w.hikes += 1;
  let points = HIKE_POINTS;
  let extra = 0;
  for (const next of path) {
    const cost = map.costOf(next) as number;
    if (cost > points) break;
    points -= cost;
    w.position = next;
    overloadedSaves(w, data);
    const key = hexKey(next);
    let endMarch = false;
    // Following a road needs no guide.
    if (!w.visited.has(key) && map.dangerAt(next) !== 'road') {
      if (!leadTheWay(w, data, leaderId, map.terrainAt(next).survive, dark)) {
        const out = mishap(w, data, 'travel');
        endMarch = out.endMarch;
        extra += out.extraChecks;
      }
    }
    w.visited.add(key);
    const site = map.siteAt(next);
    if (site) enterTown(w, data, site.id);
    if (site || endMarch) break;
  }
  if (w.destination && hexKey(w.position) === hexKey(w.destination)) w.destination = null;
  return extra;
}

/** One camp quarter. Returns extra encounter checks owed and who keeps watch. */
export function camp(
  w: World,
  data: GameData,
  activities: Record<string, Activity>,
): { extraChecks: number; watcher: Member | undefined } {
  const map = regionMap(data, w.region);
  const terrain = map.terrainAt(w.position);
  const inTown = map.siteAt(w.position) !== undefined;
  const doing = (a: Activity) => alive(w).filter((m) => activities[m.id] === a);
  let extraChecks = 0;
  for (const m of [...doing('rest'), ...doing('sleep')]) restQuarter(m);
  for (const m of doing('sleep')) m.slept = true;
  const builder = doing('make-camp')[0];
  if (builder && w.camp !== 'made') {
    if (inTown || memberCheck(w, data, builder, 'survive', ['wis'], terrain.survive).success) {
      w.camp = 'made';
      note(w, `${builder.character.name} makes a good camp.`);
    } else {
      w.camp = 'failed';
      extraChecks += mishap(w, data, 'camp').extraChecks;
    }
  }
  const rules = data.content.overlandRules;
  const food = (who: Member[], difficulty: number | null, steps: number, verb: string) => {
    const best = bestAt(data, who, 'survive', ['wis']);
    if (!best || difficulty === null || inTown) return;
    extraChecks += 1;
    const ok = memberCheck(w, data, best, 'survive', ['wis'], difficulty).success;
    if (ok) w.rations = stepDie(w.rations, steps);
    note(w, ok ? `${best.character.name} ${verb} food.` : `${best.character.name} finds nothing.`);
  };
  food(doing('forage'), terrain.survive, rules.forageSteps, 'forages');
  // Fishing stands in for hunting on water with no game.
  food(
    doing('hunt'),
    terrain.hunt ?? (terrain.water ? terrain.survive : null),
    rules.huntSteps,
    'brings in',
  );
  return { extraChecks, watcher: doing('watch')[0] };
}
