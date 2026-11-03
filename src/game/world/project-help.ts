// Factions and major projects (docs/rules-adaptation.md, Major projects: Faction help and
// Opposition; Sam's calls, Phase 22b; vendor/wwn-srd/7.0 Major Projects/Player Run Factions and
// Major Projects.md, 7.9.0). The party asks the allied faction for help in a town it holds; on its
// next turn it spends that turn's action and 1 Treasure to cut the project by half its ratings,
// doubled when the project suits it. A project pushed through a faction still standing against it
// leaves lingering trouble: on that faction's next turn it strikes the place, and a hit sacks it
// and shuts the project's effect for a month.
import { attackerWins } from '../../rules/factions.ts';
import { factionHelp } from '../../rules/projects.ts';
import type { GameData } from '../character/context.ts';
import { factionOf, isActive, locationName, news, ratings } from '../factions/state.ts';
import { sack } from '../factions/strikes.ts';
import { finishCovered, progressFor, progressOf, projectOf } from './major-projects.ts';
import { note } from './members.ts';
import type { TownResult } from './services.ts';
import { currentTown } from './town-prices.ts';
import type { World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** Why the party can't ask the allied faction to help with a project here, or null if it can. */
export function cannotAsk(w: World, data: GameData, id: string): string | null {
  const p = projectOf(data, id);
  const ally = data.content.projects.help.faction;
  const name = factionOf(data, ally).name;
  const s = progressOf(w, id);
  if (s.done !== null) return `${p.name} is finished.`;
  if (s.help.some((h) => h.faction === ally)) return `${name} have been asked already.`;
  const f = w.factions[ally];
  if (!isActive(f)) return `${name} can't help anyone now.`;
  const town = w.dungeon ? undefined : currentTown(w, data);
  const holds = (at: string) =>
    f.bases.some((b) => b.at === at) || f.assets.some((a) => a.at === at);
  if (!town || !holds(town.id)) return `Ask ${name} in a town they hold.`;
  if (p.region !== w.region) return `${name} help only with projects on their own map.`;
  return null;
}

/** Asks the allied faction to help with a project on its next turn. */
export function askHelp(w: World, data: GameData, id: string): TownResult {
  const why = cannotAsk(w, data, id);
  if (why) return no(why);
  const ally = data.content.projects.help.faction;
  progressFor(w, id).help.push({ faction: ally, points: 0 });
  note(
    w,
    `${factionOf(data, ally).name} agree to help with ${projectOf(data, id).name} next month.`,
  );
  return { ok: true };
}

/** The faction strikes the place of a project pushed through it; true if it did. */
function strikeBack(w: World, data: GameData, id: string): boolean {
  const target = data.content.projects.projects.find((p) => progressOf(w, p.id).trouble === id);
  if (!target) return false;
  const s = progressFor(w, target.id);
  s.trouble = null;
  const self = w.factions[id] as NonNullable<World['factions'][string]>;
  // The faction holding the place defends it; an unheld place has only its people.
  const holder = Object.entries(w.factions).find(
    ([other, f]) => other !== id && isActive(f) && f.bases.some((b) => b.at === target.at),
  )?.[1];
  const hit = attackerWins(
    w.rng,
    { rating: self.force, dice: 1 },
    { rating: holder?.force ?? 0, dice: 1 },
  );
  const who = factionOf(data, id).name;
  const where = locationName(data, target.at);
  if (!hit) {
    news(w, `${who} struck at ${where} over ${target.name}, and were driven off.`);
    return true;
  }
  news(w, `${who} struck at ${where} over ${target.name}.`);
  sack(w, data, target.at);
  s.shutUntil = w.day + 1 + data.content.overlandRules.daysPerMonth;
  note(w, `${target.name} does nothing for a month.`);
  return true;
}

/** The faction gives the help it was asked for, if it has the Treasure; true if it did. */
function giveHelp(w: World, data: GameData, id: string): boolean {
  const self = w.factions[id] as NonNullable<World['factions'][string]>;
  for (const p of data.content.projects.projects) {
    const s = progressOf(w, p.id);
    const asked = s.help.find((h) => h.faction === id && h.points === 0);
    if (!asked || s.done !== null) continue;
    if (self.treasure < 1) {
      news(w, `${factionOf(data, id).name} have no Treasure to spare for ${p.name} this month.`);
      return false;
    }
    self.treasure -= 1;
    asked.points = factionHelp(ratings(self), data.content.projects.help.suits.includes(p.kind));
    news(w, `${factionOf(data, id).name} put their weight behind ${p.name}: ${asked.points} off.`);
    finishCovered(w, data);
    return true;
  }
  return false;
}

/**
 * A faction's turn, before its own action: a strike over lingering trouble, else help it was asked
 * for. Returns true when that took the turn's action.
 */
export function projectTurn(w: World, data: GameData, id: string): boolean {
  return strikeBack(w, data, id) || giveHelp(w, data, id);
}
