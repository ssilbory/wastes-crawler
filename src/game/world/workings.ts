// Magical Workings (docs/rules-adaptation.md, Major projects: Workings, Designing, Building a
// Working, Damaged Workings; Sam's calls, Phases 22 and 22d; vendor/wwn-srd/4.0 Magic and
// Spellcasting/4.8.0 Building Magical Workings.md). A spellcasting PC of 6th level or more leads
// the design, helped by the party's other spellcasters and up to two hired mages; the crowns are
// paid up front, at double to halve the time. The work goes on by the calendar while the lead
// lives and has not been off the Working's map for over a month; then the lead's Int/Magic check
// at 8 plus the degree finishes it, a fail costing a week. A sacking where it stands destroys it.
import type { Site } from '../../data/schemas/index.ts';
import type { Working } from '../../data/schemas/project-content.ts';
import {
  designable,
  designScore,
  workingCheck,
  workingDays,
  workingDifficulty,
} from '../../rules/projects.ts';
import type { GameData } from '../character/context.ts';
import type { WorldEvent } from './bus.ts';
import { hasService } from './institutions.ts';
import { allProjects, progressOf } from './major-projects.ts';
import { alive, memberCheck, memberSheet, note } from './members.ts';
import { coachRoutes } from './project-effects.ts';
import { isCampaign } from './region.ts';
import type { TownResult } from './services.ts';
import { currentTown, priceHere, spend } from './town-prices.ts';
import type { Member, World } from './types.ts';
import { daysText } from './wording.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

export function workingOf(data: GameData, id: string): Working {
  const x = data.content.projects.workings.find((k) => k.id === id);
  if (!x) throw new Error(`unknown Working ${id}`);
  return x;
}

/** A Working's difficulty: its points times its area (SRD 4.8.1). */
export const difficultyOf = (x: Working) => workingDifficulty(x.points, x.area);

/** Whether a member casts spells: a class with spell slots, not arts alone. */
export const castsSpells = (data: GameData, m: Member) =>
  (memberSheet(data, m).magic?.slots.maxSpellLevel ?? 0) > 0;

/** A spellcaster's design points: level × Magic × 2 (SRD 4.8.1). */
export const mageScore = (data: GameData, m: Member) =>
  designScore(memberSheet(data, m).level, m.character.skills.magic ?? 0);

/** Why a settlement can't take this Working, or null if it can (Sam's call: any service there). */
export function unmet(w: World, data: GameData, x: Working, town: Site): string | null {
  const needs = x.needs;
  if (needs.kind === 'service') {
    const has =
      needs.service === 'workshop'
        ? town.size !== 'village' || hasService(w, data, town.id, 'workshop')
        : hasService(w, data, town.id, needs.service);
    return has ? null : `It needs a ${needs.service} in ${town.name}.`;
  }
  if (needs.kind === 'walled') {
    const walled = allProjects(w, data).some(
      (p) => p.kind === 'fortify' && p.at === town.id && progressOf(w, p.id).done !== null,
    );
    return walled ? null : `It needs a wall built around ${town.name} first.`;
  }
  if (needs.kind === 'coach-stop')
    return coachRoutes(w, data).some((r) => r.towns.includes(town.id))
      ? null
      : `It needs a coach stop in ${town.name}.`;
  return null;
}

/** The party's spellcasters who could lead a design: 6th level or more, alive. */
export const leaders = (w: World, data: GameData) =>
  alive(w).filter((m) => castsSpells(data, m) && memberSheet(data, m).level >= 6);

/** The design points for a Working: the lead's, and the help of other casters and hired mages. */
export function designPoints(w: World, data: GameData, lead: Member, hired: number) {
  const help =
    alive(w)
      .filter((m) => m !== lead && castsSpells(data, m))
      .reduce((sum, m) => sum + mageScore(data, m), 0) +
    hired * data.content.projects.hiredMage.points;
  return { lead: mageScore(data, lead), help };
}

/** The crowns to begin a Working: 20 a point of difficulty, doubled to halve the time, and fees. */
export function beginListed(data: GameData, x: Working, hired: number, double: boolean): number {
  const rules = data.content.projects;
  return (
    difficultyOf(x) * rules.workingCrownsPerPoint * (double ? 2 : 1) + hired * rules.hiredMage.fee
  );
}

/** Why the party can't begin this Working here, led by that member, or null if it can. */
export function cannotBegin(
  w: World,
  data: GameData,
  id: string,
  leadId: string,
  hired: number,
): string | null {
  const x = workingOf(data, id);
  const town = w.dungeon || !isCampaign(w) ? undefined : currentTown(w, data);
  if (!town) return 'Workings are built in a settlement on the campaign.';
  if (w.workings.some((s) => s.working === id && s.town === town.id))
    return `${town.name} has ${x.name.toLowerCase()} already.`;
  const why = unmet(w, data, x, town);
  if (why) return why;
  const lead = leaders(w, data).find((m) => m.id === leadId);
  if (!lead) return 'The lead must be a spellcaster of 6th level or more.';
  const most = data.content.projects.hiredMage.most;
  if (hired > most) return `No more than ${most} hired mages can help.`;
  const points = designPoints(w, data, lead, hired);
  if (!designable(points.lead, points.help, difficultyOf(x)))
    return `${lead.character.name} can't design it: ${points.lead} points, and ${points.help} of help, against ${difficultyOf(x)}.`;
  return null;
}

/** Begins a Working where the party stands, paying for it through the town's prices. */
export function beginWorking(
  w: World,
  data: GameData,
  id: string,
  leadId: string,
  hired: number,
  double: boolean,
): TownResult {
  const why = cannotBegin(w, data, id, leadId, hired);
  if (why) return no(why);
  const x = workingOf(data, id);
  const listed = beginListed(data, x, hired, double);
  const price = priceHere(w, data, listed);
  if (!spend(w, data, listed)) return no(`It costs ${price} crowns.`);
  const town = currentTown(w, data) as Site;
  const days = workingDays(difficultyOf(x), data.content.overlandRules.daysPerMonth, double);
  w.workings.push({
    working: id,
    town: town.id,
    lead: leadId,
    daysLeft: days,
    away: 0,
    done: null,
  });
  const lead = w.members.find((m) => m.id === leadId) as Member;
  note(
    w,
    `${lead.character.name} begins ${x.name.toLowerCase()} in ${town.name} for ${price} crowns: ${daysText(days)} of work.`,
  );
  return { ok: true };
}

const regionOf = (data: GameData, town: string) =>
  data.content.regions.find((r) => r.sites.some((s) => s.id === town))?.id;

/** A day passes on every Working under way: the work goes on, or the lead's check is made. */
function workADay(w: World, data: GameData): void {
  const month = data.content.overlandRules.daysPerMonth;
  for (const s of w.workings) {
    if (s.done !== null) continue;
    const lead = w.members.find((m) => m.id === s.lead && !m.dead);
    if (!lead) continue;
    s.away = w.region === regionOf(data, s.town) ? 0 : s.away + 1;
    if (s.away > month) continue;
    if (s.daysLeft > 0) {
      s.daysLeft -= 1;
      continue;
    }
    const x = workingOf(data, s.working);
    const check = memberCheck(w, data, lead, 'magic', ['int'], workingCheck(x.degree));
    if (check.success) {
      s.done = w.day;
      note(w, `${lead.character.name} finishes ${x.name.toLowerCase()}. ${x.ending}`);
    } else {
      s.daysLeft = 7;
      note(w, `${x.name} won't hold yet: ${lead.character.name} needs another week.`);
    }
  }
}

/** A sacking destroys every Working in the settlement, standing or under way (Sam's call). */
export function destroyWorkings(w: World, data: GameData, town: string): void {
  const lost = w.workings.filter((s) => s.town === town);
  if (lost.length === 0) return;
  w.workings = w.workings.filter((s) => s.town !== town);
  for (const s of lost)
    note(w, `The sack breaks ${workingOf(data, s.working).name.toLowerCase()}.`);
}

/** The bus listener (campaign only): each day passed works on every Working under way. */
export function workingsListener(w: World, data: GameData, e: WorldEvent): void {
  if (e.kind === 'day-passed') workADay(w, data);
}
