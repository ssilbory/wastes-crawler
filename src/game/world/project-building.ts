// Building work on a major project (docs/rules-adaptation.md, Major projects: Building work; Sam's
// calls, Phase 22b): its crowns are paid to start it, in the settlement it is worked from, at any
// time, beside its Renown. Then each day the party spends on site, as a day at a town's workshop,
// every living PC rolls the building's skill, or Exert where plain labor helps, whichever is better;
// each pass takes a day off and earns half an XP, and the party sleeps at the inn. Hirelings don't
// build.
import type { Attribute } from '../../data/schemas/index.ts';
import type { Project } from '../../data/schemas/project-content.ts';
import type { GameData } from '../character/context.ts';
import { finishCovered, progressFor, progressOf, projectOf } from './major-projects.ts';
import { alive, checkBonus, memberCheck, note } from './members.ts';
import { innListed, stayAtInn, type TownResult } from './services.ts';
import { currentTown, priceHere, spend } from './town-prices.ts';
import type { Member, World } from './types.ts';
import { daysText } from './wording.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** The site's name; content checks guarantee the place a project is worked from. */
const placeName = (data: GameData, id: string) =>
  data.content.regions.flatMap((r) => r.sites).find((s) => s.id === id)?.name as string;

/** Why the party can't build on a project here and now, or null if it can. */
export function cannotBuild(w: World, data: GameData, p: Project): string | null {
  if (!p.build) return `${p.name} needs no building work.`;
  if (progressOf(w, p.id).done !== null) return `${p.name} is finished.`;
  if (w.dungeon || currentTown(w, data)?.id !== p.at)
    return `The work on ${p.name} is done on site, in ${placeName(data, p.at)}.`;
  return null;
}

/** Pays for a project's materials, so its building work can start. */
export function startBuild(w: World, data: GameData, id: string): TownResult {
  const p = projectOf(data, id);
  const why = cannotBuild(w, data, p);
  if (why) return no(why);
  const build = p.build as NonNullable<Project['build']>;
  if (progressOf(w, id).daysLeft !== null) return no(`The work on ${p.name} is under way.`);
  const price = priceHere(w, data, build.crowns);
  if (!spend(w, data, build.crowns)) return no(`The materials cost ${price} crowns.`);
  progressFor(w, id).daysLeft = build.days;
  note(w, `The party pays ${price} crowns for ${p.name}: ${daysText(build.days)} of work to do.`);
  return { ok: true };
}

/** The skill a member builds with: the building's own, or Exert where it is allowed and better. */
function builderSkill(
  data: GameData,
  m: Member,
  p: Project,
): { skill: string; attrs: Attribute[] } {
  const build = p.build as NonNullable<Project['build']>;
  const attrsOf = (skill: string) => data.content.projects.buildAttributes[skill] as Attribute[];
  const own = { skill: build.skill, attrs: attrsOf(build.skill) };
  if (!build.exert) return own;
  const exert = { skill: 'exert', attrs: attrsOf('exert') };
  return checkBonus(data, m, exert.skill, exert.attrs) > checkBonus(data, m, own.skill, own.attrs)
    ? exert
    : own;
}

/** The party spends the day building on site, then sleeps at the inn. */
export function buildDay(w: World, data: GameData, id: string): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const p = projectOf(data, id);
  const why = cannotBuild(w, data, p);
  if (why) return no(why);
  const s = progressOf(w, id);
  if (s.daysLeft === null) return no(`Pay for the materials for ${p.name} first.`);
  if (s.daysLeft === 0) return no(`The building work on ${p.name} is done.`);
  const inn = priceHere(w, data, innListed(w, data));
  if (inn > w.purse) return no(`A night at the inn after the work costs ${inn} crowns.`);
  const rules = data.content.projects;
  let passes = 0;
  for (const m of alive(w)) {
    const { skill, attrs } = builderSkill(data, m, p);
    if (!memberCheck(w, data, m, skill, attrs, rules.buildDifficulty).success) continue;
    passes += 1;
    m.character = { ...m.character, xp: m.character.xp + rules.buildXp };
  }
  const before = s.daysLeft;
  const left = Math.max(0, before - passes);
  progressFor(w, id).daysLeft = left;
  note(
    w,
    left === 0
      ? `The party finishes the building work on ${p.name}.`
      : `The party works on ${p.name}: ${daysText(before - left)} of work done, ${daysText(left)} left.`,
  );
  const night = stayAtInn(w, data);
  finishCovered(w, data);
  return night;
}
