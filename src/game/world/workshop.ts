// Working at a town's workshop (docs/rules-adaptation.md, Crafting and modifying gear; Sam's call):
// the whole party can wait in town while its crafters work, a day's rent and a night at the inn at a
// time, or a crafter can stay behind to finish alone, with the rent paid up front.
import { findItem } from '../character/items.ts';
import type { GameData } from '../character/context.ts';
import { daysText, tierName, workOn, workshopHere } from './crafting.ts';
import { note } from './members.ts';
import { innListed, stayAtInn, type TownResult } from './services.ts';
import { priceHere, spend, townHere } from './town.ts';
import type { World } from './types.ts';
import { followMaster } from './companion-sync.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

const rent = (w: World, data: GameData, days: number) =>
  workshopHere(w, data)?.owned ? 0 : data.content.craftingRules.workshop.rentPerDay * days;

/** The party's crafters work a day at the workshop, and everyone sleeps at the inn. */
export function workDay(w: World, data: GameData): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const town = townHere(w, data);
  if (!workshopHere(w, data)) return no(`${town.name} has no workshop.`);
  const working = w.projects.filter(
    (p) => !p.staying && !p.failed && w.members.some((m) => m.id === p.crafter && !m.dead),
  );
  if (working.length === 0) return no('No one in the party has work under way.');
  const listed = rent(w, data, 1);
  const total = priceHere(w, data, listed + innListed(w, data));
  if (total > w.purse) return no(`A day's work and a night at the inn cost ${total} crowns.`);
  spend(w, data, listed);
  note(w, `The party spends the day at the workshop in ${town.name}.`);
  for (const p of working) workOn(w, data, p);
  return stayAtInn(w, data);
}

/** A crafter stays at the workshop to finish their work while the party goes on. */
export function stayToWork(w: World, data: GameData, crafterId: string): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const town = townHere(w, data);
  if (!workshopHere(w, data)) return no(`${town.name} has no workshop.`);
  const p = w.projects.find((x) => x.crafter === crafterId && !x.staying && !x.failed);
  const m = w.members.find((x) => x.id === crafterId);
  if (!p || !m) throw new Error(`${crafterId} has no work to stay for`);
  if (!w.members.some((x) => x !== m && !x.dead))
    return no('Someone living must stay in the party.');
  // A half day left from a camp shift still takes the day's rent.
  const listed = rent(w, data, Math.ceil(p.daysLeft));
  const price = priceHere(w, data, listed);
  if (!spend(w, data, listed))
    return no(`${daysText(Math.ceil(p.daysLeft))}' rent costs ${price} crowns.`);
  Object.assign(p, { staying: true, town: town.id });
  followMaster(w, m);
  w.members = w.members.filter((x) => x !== m);
  w.benched.push(m);
  const name = findItem(data, p.item)?.name as string;
  note(
    w,
    `${m.character.name} stays at the workshop in ${town.name} to finish the ${tierName(p.quality)}${name} (${daysText(p.daysLeft)}).`,
  );
  return { ok: true };
}
