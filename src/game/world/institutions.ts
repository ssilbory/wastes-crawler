// Founding institutions and settling their specialists (docs/rules-adaptation.md, Major projects:
// Institutions, Recruits, Owner perks, Growth; Sam's calls, Phase 22c). The party founds an
// institution where a settlement lacks the service (a settlement keeps at most one place that
// raises the dead); it is then a major project like any other. Its specialist is a journeyman hired
// at a tavern where that service already stands, who travels with the party as a non-combatant and
// settles on reaching the place, or a freed captive who settles there instead of going home. A
// captive who waits (the Sealed Vale's, Sam's call) settles on reaching home, or waits there until
// the party founds an institution they can run. The party's own arena pays it a share of a month of
// its fees as each month begins.
import type { ArenaBout } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { builtArena } from './built-services.ts';
import type { WorldEvent } from './bus.ts';
import { workshopHere } from './crafting.ts';
import {
  institutionId,
  isOpen,
  openServices,
  parseInstitutionId,
  type Service,
} from './institution-projects.ts';
import { progressFor, progressOf } from './major-projects.ts';
import { note } from './members.ts';
import { addNpc, captiveOf, removeNpc } from './npcs.ts';
import { hasProjects } from './region.ts';
import type { TownResult } from './services.ts';
import { currentTown, priceHere, spend } from './town-prices.ts';
import type { World } from './types.ts';
import { toTenths } from '../../rules/economy.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

const RAISERS: readonly Service[] = ['crypt', 'mortuary', 'temple'];

/** Whether a settlement has a service, the content's or the party's own. */
export function hasService(w: World, data: GameData, town: string, service: Service): boolean {
  if (openServices(w, data, town).includes(service)) return true;
  const c = data.content;
  if (service === 'arena') return c.arenaCards.some((a) => a.town === town);
  if (service === 'alchemist') return c.alchemy.alchemists.some((a) => a.town === town);
  if (service === 'workshop') {
    const region = c.regions.find((r) => r.sites.some((s) => s.id === town));
    const site = region?.sites.find((s) => s.id === town);
    return site !== undefined && site.size !== 'village';
  }
  return c.missionGivers.some((g) => g.town === town && g.raises === service);
}

/** Why the party can't found an institution for this service where it stands, or null. */
export function cannotFound(w: World, data: GameData, service: Service): string | null {
  const town = w.dungeon || !hasProjects(w, data) ? undefined : currentTown(w, data);
  if (!town) return 'Institutions are founded in a settlement where the party can build.';
  const i = data.content.projects.institutions.find((x) => x.service === service);
  const name = i?.name as string;
  const id = institutionId(service, town.id);
  if (w.majorProjects[id]) return `${town.name} has ${name} under way already.`;
  if (
    service === 'workshop' ? workshopHere(w, data) !== null : hasService(w, data, town.id, service)
  )
    return `${town.name} has ${name} already.`;
  if (RAISERS.includes(service)) {
    const raiser =
      data.content.missionGivers.some((g) => g.town === town.id && g.raises) ||
      RAISERS.some((r) => w.majorProjects[institutionId(r, town.id)]);
    if (raiser) return `${town.name} already has a place that raises the dead.`;
  }
  return null;
}

/** Founds an institution where the party stands; then it is worked like any project. */
export function foundInstitution(w: World, data: GameData, service: Service): TownResult {
  const why = cannotFound(w, data, service);
  if (why) return no(why);
  const town = currentTown(w, data) as NonNullable<ReturnType<typeof currentTown>>;
  const id = institutionId(service, town.id);
  progressFor(w, id);
  const i = data.content.projects.institutions.find((x) => x.service === service);
  note(w, `The party sets out to found ${i?.name} in ${town.name}.`);
  // A freed captive waiting here takes it on at once (Sam's call: found before it is founded).
  const waiter = w.waiting.find(
    (x) => x.town === town.id && i?.specialist.captives.includes(x.captive),
  );
  if (waiter) {
    w.waiting = w.waiting.filter((x) => x !== waiter);
    progressFor(w, id).specialist = waiter.name;
    note(w, `${waiter.name}, who waited in ${town.name}, will run it.`);
  }
  return { ok: true };
}

/** Why the party can't hire a journeyman here for an institution, or null if it can. */
export function cannotHire(w: World, data: GameData, id: string): string | null {
  const found = parseInstitutionId(data, id);
  if (!found || !w.majorProjects[id]) return 'Found the institution first.';
  const { institution: i, site } = found;
  if (progressOf(w, id).specialist) return `${i.specialist.name} already runs it.`;
  if (w.npcs.some((n) => n.kind === 'recruit' && n.type === id))
    return `${i.specialist.name} is already on the way.`;
  const realm = realmOfSite(data, site.id);
  if (realm && settlementsIn(data, realm).every((s) => s.id === site.id))
    return `No journeyman can reach ${realm.name}: free ${i.specialist.name} held captive.`;
  const town = w.dungeon ? undefined : currentTown(w, data);
  const fromAny = !servedInRealm(w, data, site.id, i.service);
  if (!town || town.id === site.id || !(fromAny || hasService(w, data, town.id, i.service)))
    return fromAny
      ? `Hire ${i.specialist.name} in another settlement.`
      : `Hire ${i.specialist.name} in a town that has ${i.name}.`;
  return null;
}

/**
 * Whether a journeyman for an institution in a realm's settlement can be found where the service
 * stands (true everywhere outside a realm). A realm none of whose other settlements has the
 * service sends for one from any of them instead (Sam's call: the Wastes have no workshop to
 * hire a smith from).
 */
function servedInRealm(w: World, data: GameData, site: string, service: Service): boolean {
  const realm = realmOfSite(data, site);
  if (!realm) return true;
  return settlementsIn(data, realm).some(
    (s) => s.id !== site && hasService(w, data, s.id, service),
  );
}

type Realm = GameData['content']['realms'][number];

/** The shipped realm a settlement lies in, or undefined on the campaign. */
function realmOfSite(data: GameData, site: string): Realm | undefined {
  const region = data.content.regions.find((r) => r.sites.some((s) => s.id === site))?.id;
  return data.content.realms.find((r) => region !== undefined && r.regions.includes(region));
}

/** A realm's settlements. */
const settlementsIn = (data: GameData, realm: Realm) =>
  data.content.regions
    .filter((r) => realm.regions.includes(r.id))
    .flatMap((r) => r.sites)
    .filter((s) => s.kind === 'town');

/** Hires a journeyman, who travels with the party to the institution and settles there. */
export function hireJourneyman(w: World, data: GameData, id: string): TownResult {
  const why = cannotHire(w, data, id);
  if (why) return no(why);
  const { institution: i, site } = parseInstitutionId(data, id) as NonNullable<
    ReturnType<typeof parseInstitutionId>
  >;
  const price = priceHere(w, data, i.specialist.hireFee);
  if (price > w.purse) return no(`Hiring ${i.specialist.name} costs ${price} crowns.`);
  const n = addNpc(w, data, 'recruit', id, data.content.projects.recruitMonster, null, false);
  if (!n) return no('There is no room in the party for them.');
  spend(w, data, i.specialist.hireFee);
  note(w, `${n.name}, ${i.specialist.name}, joins the party to settle in ${site.name}.`);
  return { ok: true };
}

/** The freed captives in the party who could settle as an institution's specialist. */
export function settlers(w: World, data: GameData, id: string) {
  const i = parseInstitutionId(data, id)?.institution;
  return w.npcs.filter((n) => n.kind === 'captive' && i?.specialist.captives.includes(n.type));
}

/** A freed captive settles where the party stands to run its institution, instead of going home. */
export function settleCaptive(w: World, data: GameData, npcId: string, id: string): TownResult {
  const found = parseInstitutionId(data, id);
  const n = settlers(w, data, id).find((x) => x.id === npcId);
  if (!found || !n || !w.majorProjects[id]) return no("They can't run that.");
  if (progressOf(w, id).specialist)
    return no(`${found.institution.specialist.name} already runs it.`);
  if (w.dungeon || currentTown(w, data)?.id !== found.site.id)
    return no(`They settle in ${found.site.name}, where it stands.`);
  removeNpc(w, n.id);
  progressFor(w, id).specialist = n.name;
  note(
    w,
    `${n.name} stays in ${found.site.name} to run ${found.institution.name}, and asks no reward of ${captiveOf(data, n.type).reward} crowns.`,
  );
  return { ok: true };
}

/** Journeymen bound for the town the party has reached settle there. */
function settleJourneymen(w: World, data: GameData, town: string): void {
  for (const n of [...w.npcs]) {
    const found = n.kind === 'recruit' ? parseInstitutionId(data, n.type) : null;
    if (!found || found.site.id !== town) continue;
    removeNpc(w, n.id);
    progressFor(w, n.type).specialist = n.name;
    note(w, `${n.name} settles in ${found.site.name} to run ${found.institution.name}.`);
  }
}

/**
 * Freed captives who wait, home at last: each settles to run an institution of theirs under way
 * here, or else waits here for the party to found one (Sam's call: the Sealed Vale). They take no
 * reward, as a captive who settles doesn't.
 */
function settleWaiters(w: World, data: GameData, town: string): void {
  const site = data.content.regions.flatMap((r) => r.sites).find((s) => s.id === town);
  for (const n of [...w.npcs]) {
    if (n.kind !== 'captive') continue;
    const c = captiveOf(data, n.type);
    if (!c.waits || c.destination !== town) continue;
    removeNpc(w, n.id);
    const runs = data.content.projects.institutions.filter((i) =>
      i.specialist.captives.includes(c.id),
    );
    const id = runs
      .map((i) => institutionId(i.service, town))
      .find((x) => w.majorProjects[x] && !progressOf(w, x).specialist);
    if (id) {
      progressFor(w, id).specialist = n.name;
      const name = parseInstitutionId(data, id)?.institution.name;
      note(w, `${n.name} is home, and stays in ${site?.name} to run ${name}.`);
      continue;
    }
    w.waiting.push({ captive: c.id, name: n.name, town });
    const names = runs.map((i) => i.name).join(' or ');
    note(w, `${n.name} is home, and will run ${names} once the party founds it in ${site?.name}.`);
  }
}

/** The party's arenas pay it their share of a month of their card's fees. */
function arenaShares(w: World, data: GameData): void {
  const { arenaSharePercent: share } = data.content.projects;
  const month = data.content.overlandRules.daysPerMonth;
  for (const id of Object.keys(w.majorProjects)) {
    const found = parseInstitutionId(data, id);
    if (found?.institution.service !== 'arena' || !isOpen(w, id)) continue;
    // Open, so its card is there (built-services.ts).
    const bouts = builtArena(w, data, found.site.id) as ArenaBout[];
    const fees = bouts.reduce((sum, b) => sum + b.fee, 0) / Math.max(1, bouts.length);
    const paid = toTenths((fees * month * share) / 100);
    w.purse = toTenths(w.purse + paid);
    note(w, `The arena in ${found.site.name} pays the party its share: ${paid} crowns.`);
  }
}

/**
 * The bus listener (wherever the party can build): journeymen and waiting captives settle on
 * arrival; arenas pay as a month begins.
 */
export function institutionsListener(w: World, data: GameData, e: WorldEvent): void {
  if (e.kind === 'town-entered') {
    settleJourneymen(w, data, e.town);
    settleWaiters(w, data, e.town);
  }
  if (e.kind === 'day-passed' && (w.day + 1) % data.content.overlandRules.daysPerMonth === 0)
    arenaShares(w, data);
}
