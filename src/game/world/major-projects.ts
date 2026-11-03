// Major projects (docs/rules-adaptation.md, Major projects, institutions, and recruits; Sam's
// calls; vendor/wwn-srd/7.0 Major Projects/): the party earns Renown as one pool, puts it or crowns
// into projects from any settlement on the project's map, and a project is finished the moment its
// Renown covers its difficulty, which falls as its opposition is beaten and its tied adventures are
// done and its building work, if any, is finished (project-building.ts). A project pushed through
// a faction still standing against it leaves lingering trouble (project-help.ts).
import type { AnyProject, Project } from '../../data/schemas/project-content.ts';
import { institutionProject, isInstitutionId } from './institution-projects.ts';
import {
  greatestOpposition,
  loweredDifficulty,
  projectDifficulty,
  renownPrice,
} from '../../rules/projects.ts';
import { toTenths } from '../../rules/economy.ts';
import type { GameData } from '../character/context.ts';
import { ruinOfDungeon } from '../dungeon/hidden-ruins.ts';
import { dungeonOf } from '../dungeon/levels.ts';
import { isActive } from '../factions/state.ts';
import type { WorldEvent } from './bus.ts';
import { note } from './members.ts';
import type { TownResult } from './services.ts';
import { currentTown } from './town-prices.ts';
import type { MajorProjectState } from '../../data/schemas/index.ts';
import type { World } from './types.ts';

type Opposition = Project['difficulty']['opposition'][number];
type Beaten = Opposition['beaten'][number];

const no = (reason: string): TownResult => ({ ok: false, reason });

/** A project from the list, or an institution founded in a settlement (institution-projects.ts). */
export function projectOf(data: GameData, id: string): AnyProject {
  const p = data.content.projects.projects.find((x) => x.id === id) ?? institutionProject(data, id);
  if (!p) throw new Error(`unknown project ${id}`);
  return p;
}

/** Every project in play: the list's, and the institutions the party has founded. */
export function allProjects(w: World, data: GameData): AnyProject[] {
  return [
    ...data.content.projects.projects,
    ...Object.keys(w.majorProjects)
      .filter(isInstitutionId)
      .map((id) => projectOf(data, id)),
  ];
}

/** A project's progress, empty before any Renown, crowns, or help goes in. */
export const progressOf = (w: World, id: string): MajorProjectState =>
  w.majorProjects[id] ?? {
    renown: 0,
    bought: 0,
    done: null,
    daysLeft: null,
    help: [],
    trouble: null,
    shutUntil: null,
    specialist: null,
  };

/** A project's progress, stored so it can be changed. */
export function progressFor(w: World, id: string): MajorProjectState {
  const s = progressOf(w, id);
  w.majorProjects[id] = s;
  return s;
}

/**
 * Whether a won fight's key (`dungeon/level/x,y`) names a guarded hoard or a ruin's vault: a boss
 * fight (docs/rules-adaptation.md, Bosses). Garrison posts' keys name no cache.
 */
export function isGuardedHoard(data: GameData, key: string): boolean {
  const [dungeon, level, cell] = key.split('/');
  if (!dungeon || !level || !cell) return false;
  if (!data.content.dungeons.some((d) => d.id === dungeon) && !ruinOfDungeon(data, dungeon))
    return false;
  const [x, y] = cell.split(',').map(Number);
  const special = dungeonOf(data, dungeon)
    .levels.find((l) => l.id === level)
    ?.specials.find((s) => s.kind === 'cache' && s.at.x === x && s.at.y === y);
  return special?.kind === 'cache' && special.guards !== undefined;
}

/** Whether every loot cache in a hand-made dungeon has been taken: the dungeon is cleared. */
function cleared(w: World, data: GameData, dungeon: string): boolean {
  const d = data.content.dungeons.find((x) => x.id === dungeon);
  const keys = (d?.levels ?? []).flatMap((l) =>
    l.specials.flatMap((s) =>
      s.kind === 'cache' ? [`${dungeon}/${l.id}/${s.at.x},${s.at.y}`] : [],
    ),
  );
  return keys.length > 0 && keys.every((k) => w.caches.includes(k));
}

/** Whether one way of beating an opposing power has come about. */
export function hasCome(w: World, data: GameData, b: Beaten): boolean {
  if (b.kind === 'quest') return w.quests[b.quest]?.status === 'done';
  if (b.kind === 'dungeon') return cleared(w, data, b.dungeon);
  // A faction not yet started still holds its ground; a collapsed one holds nothing.
  const s = w.factions[b.faction];
  if (!s) return false;
  if (!isActive(s)) return true;
  return !s.assets.some((a) => a.at === b.at) && !s.bases.some((x) => x.at === b.at);
}

/** The powers still standing against a project (SRD 7.4.0); any one way beats each. */
export function standing(w: World, data: GameData, list: readonly Opposition[]): Opposition[] {
  return list.filter((o) => !o.beaten.some((b) => hasCome(w, data, b)));
}

/** The share of the goal its tied adventures have taken off, in percent (SRD 7.5.0). */
export function adventuresDone(w: World, data: GameData, p: AnyProject): number {
  return p.adventures
    .filter((a) =>
      a.quest
        ? w.quests[a.quest]?.status === 'done'
        : hasCome(w, data, { kind: 'dungeon', dungeon: a.dungeon as string }),
    )
    .reduce((sum, a) => sum + a.percent, 0);
}

/**
 * A project's difficulty as things stand: its greatest standing opposition, less its adventures'
 * shares and the help factions have given (SRD 7.9.0).
 */
export function difficultyNow(w: World, data: GameData, p: AnyProject): number {
  const left = standing(w, data, p.difficulty.opposition).map((o) => o.level);
  const full = projectDifficulty({ ...p.difficulty, opposition: greatestOpposition(left) });
  const help = progressOf(w, p.id).help.reduce((sum, h) => sum + h.points, 0);
  return loweredDifficulty(full, adventuresDone(w, data, p), help);
}

/** Why the party can't work on a project here and now, or null if it can. */
export function cannotWork(w: World, data: GameData, p: AnyProject): string | null {
  if (progressOf(w, p.id).done !== null) return `${p.name} is finished.`;
  if (w.dungeon || !currentTown(w, data)) return 'Projects are worked from a settlement.';
  if (w.region !== p.region) return `${p.name} is worked from a settlement on its own map.`;
  return null;
}

/** Records Renown put into a project, then finishes it if that covers it. */
function putIn(w: World, data: GameData, p: AnyProject, renown: number, bought: number): void {
  const s = progressFor(w, p.id);
  s.renown += renown;
  s.bought += bought;
  finishCovered(w, data);
}

/** Renown still needed to cover a project now. */
export const renownNeeded = (w: World, data: GameData, p: AnyProject) =>
  Math.max(0, difficultyNow(w, data, p) - progressOf(w, p.id).renown);

/** Puts `points` of the party's Renown into a project, no more than it still needs. */
export function spendRenown(w: World, data: GameData, id: string, points: number): TownResult {
  const p = projectOf(data, id);
  const why = cannotWork(w, data, p);
  if (why) return no(why);
  const needed = renownNeeded(w, data, p);
  if (needed < 1) return no(`${p.name} has all the Renown it needs.`);
  if (w.renown < 1) return no('The party has no Renown to put in.');
  const n = Math.min(points, w.renown, needed);
  w.renown -= n;
  note(w, `The party puts ${n} Renown into ${p.name}.`);
  putIn(w, data, p, n, 0);
  return { ok: true };
}

/** What buying `points` more Renown for a project costs, or null if it can't be bought. */
export function buyPrice(w: World, data: GameData, id: string, points: number): number | null {
  return renownPrice(data.content.projects.buying, progressOf(w, id).bought, points);
}

/** Buys Renown for a project with the purse's crowns (SRD 7.5.0 at 1/50). */
export function buyRenown(w: World, data: GameData, id: string, points: number): TownResult {
  const p = projectOf(data, id);
  const why = cannotWork(w, data, p);
  if (why) return no(why);
  const n = Math.min(points, renownNeeded(w, data, p));
  if (n < 1) return no(`${p.name} has all the Renown it needs.`);
  const price = buyPrice(w, data, id, n);
  if (price === null) return no('No more Renown can be bought for it.');
  if (price > w.purse) return no(`That costs ${price} crowns.`);
  w.purse = toTenths(w.purse - price);
  note(w, `The party spends ${price} crowns on ${p.name}: ${n} Renown.`);
  putIn(w, data, p, n, n);
  return { ok: true };
}

/** The faction still standing against a project, if any: it holds a grudge once it is done. */
function grudge(w: World, data: GameData, p: AnyProject): string | null {
  for (const o of standing(w, data, p.difficulty.opposition))
    for (const b of o.beaten) if (b.kind === 'faction-gone') return b.faction;
  return null;
}

/**
 * Finishes every project whose Renown covers it now and whose building work, if any, is done. One
 * pushed through a faction still standing against it paid its way through (SRD 7.6.0): that faction
 * strikes the place on its next turn (Sam's call: lingering trouble; project-help.ts).
 */
export function finishCovered(w: World, data: GameData): void {
  for (const p of allProjects(w, data)) {
    const s = w.majorProjects[p.id];
    if (!s || s.done !== null || (p.build && s.daysLeft !== 0)) continue;
    if (s.renown < difficultyNow(w, data, p)) continue;
    s.done = w.day;
    s.trouble = grudge(w, data, p);
    note(w, `${p.name} is done. ${p.ending}`);
  }
}

/** Adds Renown to the pool, with a line saying why. */
function earn(w: World, points: number, why: string): void {
  if (points < 1) return;
  w.renown += points;
  note(w, `${why}: ${points} Renown (${w.renown} to spend).`);
}

/**
 * The bus listener (campaign only): Renown for a quest turned in, the campaign warlord's fall (the
 * Seal's quest), a guarded hoard won, and a captive brought home; then any project these finish.
 */
export function majorProjectsListener(w: World, data: GameData, e: WorldEvent): void {
  const r = data.content.projects.renown;
  if (e.kind === 'quest-done') {
    earn(w, r.quest, 'The quest is told in every tavern');
    if (e.quest === data.content.campaign.seal.quest) earn(w, r.warlord, 'The warlord is dead');
  } else if (e.kind === 'fight-won' && e.garrison && isGuardedHoard(data, e.garrison))
    earn(w, r.boss, 'Word of the hoard spreads');
  else if (e.kind === 'captive-home') earn(w, r.captive, 'A captive tells of their rescue');
  else return;
  finishCovered(w, data);
}

/**
 * Renown already earned in a save from before projects (Sam's call: count what's done): quests
 * turned in, the warlord's fall, and guarded hoards won. Captives brought home left no record.
 */
export function renownEarned(w: World, data: GameData): number {
  const r = data.content.projects.renown;
  const quests = Object.entries(w.quests).filter(([, q]) => q.status === 'done');
  const warlord = w.quests[data.content.campaign.seal.quest]?.status === 'done' ? r.warlord : 0;
  const hoards = w.beaten.filter((k) => isGuardedHoard(data, k)).length;
  return quests.length * r.quest + warlord + hoards * r.boss;
}
