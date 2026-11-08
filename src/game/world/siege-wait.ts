// Waiting at an ally's inn for a siege (docs/rules-adaptation.md, Sieges: Waiting for a siege;
// Sam's calls, Phase 23c). The SRD's faction turn (vendor/wwn-srd/6.0 Factions/Faction Turn
// Actions.md) comes once a month, so a siege can begin only as a month turns: the Free Settlements
// put the party up free while it waits, its crafters working, until a siege or other news of the
// ally comes, or a month turns with none.
import type { GameData } from '../character/context.ts';
import { isActive } from '../factions/state.ts';
import { carriesFor, workOn, workshopHere } from './crafting.ts';
import { note } from './members.ts';
import type { TownResult } from './services.ts';
import { restAtInn } from './services.ts';
import { allyOf, allyTowns, besieged, holderOf, isAlly } from './siege-state.ts';
import { currentTown, month, townHere } from './town-prices.ts';
import type { World } from './types.ts';
import { workingAt } from './working-effects.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** Whether the party stands in a settlement of the ally's that the ally still holds. */
export function allyHosts(w: World, data: GameData): boolean {
  const town = w.dungeon ? undefined : currentTown(w, data)?.id;
  const ally = town === undefined ? null : allyOf(data, town);
  const s = ally === null ? undefined : w.factions[ally];
  if (!town || w.members.length === 0 || !isActive(s)) return false;
  return s.bases.some((b) => b.at === town);
}

/** What the party hears of the ally: the sieges on it and its held settlements, as one key. */
export function allyNews(w: World, data: GameData): string {
  const sieges = w.sieges
    .filter((s) => isAlly(data, s.attacker) || isAlly(data, s.defender))
    .map((s) => `${s.attacker}>${s.town}`);
  const held = allyTowns(data).filter((t) => holderOf(w, data, t) !== null);
  return [...sieges.sort(), '|', ...held].join(',');
}

/**
 * A day's work for the party's crafters while it waits: a workshop day, rent free, where the town
 * has a workshop (its heatless lamps included); otherwise a camp shift for each crafter carrying
 * the tools, as in the wilds (Crafting and modifying gear).
 */
export function waitingWork(w: World, data: GameData): void {
  const shop = workshopHere(w, data) !== null;
  const pace = 1 + workingAt(w, data, 'workshop-pace', townHere(w, data).id) / 100;
  const working = w.projects.filter((p) => {
    const m = w.members.find((x) => x.id === p.crafter && !x.dead);
    if (!m || p.staying || p.failed) return false;
    return shop || (p.kind !== 'strip' && carriesFor(data, m, p));
  });
  const days = shop ? pace : data.content.craftingRules.shiftDays;
  for (const p of working) workOn(w, data, p, days);
}

/**
 * The party waits at the inn for free, night after night, until a siege begins here (its assault
 * comes that night), news of the ally comes from elsewhere, a month turns with neither, or the
 * party is no longer here to wait.
 */
export function waitForSiege(w: World, data: GameData): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const town = townHere(w, data);
  if (!allyHosts(w, data)) return no('Only the Free Settlements put the party up while it waits.');
  if (besieged(w, town.id)) return no(`${town.name} is already under siege.`);
  const news = allyNews(w, data);
  note(w, `The party waits in ${town.name} for a siege, the Free Settlements' guests.`);
  // A month at most: the faction turn comes once a month.
  for (;;) {
    waitingWork(w, data);
    restAtInn(w, data);
    // Wiped out, or called to arms (an assault drives the party out only after its fight).
    if (w.members.length === 0 || w.encounter) return { ok: true };
    if (allyNews(w, data) !== news) {
      note(
        w,
        besieged(w, town.id)
          ? `The siege of ${town.name} ends the wait.`
          : 'News of the Free Settlements ends the wait.',
      );
      return { ok: true };
    }
    if (w.day % month(data) === 0) break;
  }
  note(w, `A month turns with no siege on ${town.name}; the wait ends.`);
  return { ok: true };
}
