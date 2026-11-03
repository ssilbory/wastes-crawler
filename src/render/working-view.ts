// Workings as the party sees them (docs/rules-adaptation.md, Major projects: Workings): those it
// could begin where it stands, with the best lead's design and the price, and those under way or
// standing anywhere. Pure reads of game state.
import type { GameData } from '../game/character/context.ts';
import { isCampaign } from '../game/world/region.ts';
import { currentTown } from '../game/world/town-prices.ts';
import type { World } from '../game/world/types.ts';
import {
  beginListed,
  cannotBegin,
  designPoints,
  difficultyOf,
  leaders,
  mageScore,
  unmet,
} from '../game/world/workings.ts';
import { workingDays } from '../rules/projects.ts';

export interface WorkingOffer {
  id: string;
  name: string;
  text: string;
  degree: string;
  difficulty: number;
  /** The best lead, by design points, and the points with the help as asked. */
  lead: { id: string; name: string; points: number; help: number } | null;
  /** Crowns and days at the usual cost, and at double. */
  cost: number;
  days: number;
  doubleCost: number;
  doubleDays: number;
  /** Why it can't be begun here with these hired mages, or null. */
  blocked: string | null;
}

export interface WorkingStanding {
  name: string;
  town: string;
  lead: string;
  /** Days left, or null once it stands. */
  daysLeft: number | null;
  /** Why the work isn't going on today, or null. */
  halted: string | null;
}

export interface WorkingsView {
  offers: WorkingOffer[];
  standing: WorkingStanding[];
  hiredMost: number;
  hireFee: number;
}

const siteName = (data: GameData, id: string) =>
  data.content.regions.flatMap((r) => r.sites).find((s) => s.id === id)?.name as string;

/** The Workings the party could begin here, with `hired` mages, and every one it has begun. */
export function workingsView(w: World, data: GameData, hired: number): WorkingsView {
  const rules = data.content.projects;
  const month = data.content.overlandRules.daysPerMonth;
  const town = w.dungeon || !isCampaign(w) ? undefined : currentTown(w, data);
  const best = [...leaders(w, data)].sort((a, b) => mageScore(data, b) - mageScore(data, a))[0];
  const offers = town
    ? rules.workings
        .filter((x) => unmet(w, data, x, town) === null)
        .map((x) => {
          const difficulty = difficultyOf(x);
          const points = best ? designPoints(w, data, best, hired) : null;
          return {
            id: x.id,
            name: x.name,
            text: x.text,
            degree: x.degree,
            difficulty,
            lead:
              best && points
                ? { id: best.id, name: best.character.name, points: points.lead, help: points.help }
                : null,
            cost: beginListed(data, x, hired, false),
            days: workingDays(difficulty, month, false),
            doubleCost: beginListed(data, x, hired, true),
            doubleDays: workingDays(difficulty, month, true),
            blocked: cannotBegin(w, data, x.id, best?.id ?? '', hired),
          };
        })
    : [];
  const standing = w.workings.map((s) => {
    const lead = w.members.find((m) => m.id === s.lead);
    const def = rules.workings.find((x) => x.id === s.working);
    return {
      name: def?.name as string,
      town: siteName(data, s.town),
      lead: lead?.character.name ?? 'someone gone',
      daysLeft: s.done === null ? s.daysLeft : null,
      halted:
        s.done !== null
          ? null
          : !lead || lead.dead
            ? 'its lead is down'
            : s.away > month
              ? 'its lead has been away over a month'
              : null,
    };
  });
  return { offers, standing, hiredMost: rules.hiredMage.most, hireFee: rules.hiredMage.fee };
}
