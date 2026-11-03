// Major projects as the party sees them (docs/rules-adaptation.md, Major projects): the Renown to
// spend, and each project on the party's map with what stands against it, what it still needs,
// and whether it can be worked here. Pure reads of game state.
import type { Project } from '../data/schemas/project-content.ts';
import type { GameData } from '../game/character/context.ts';
import {
  buyPrice,
  cannotWork,
  difficultyNow,
  hasCome,
  progressOf,
  renownNeeded,
  standing,
} from '../game/world/major-projects.ts';
import { cannotBuild } from '../game/world/project-building.ts';
import { cannotAsk } from '../game/world/project-help.ts';
import { isCampaign } from '../game/world/region.ts';
import { effectText } from './project-effect-text.ts';
import type { World } from '../game/world/types.ts';

export interface ProjectView {
  id: string;
  name: string;
  text: string;
  /** The settlement or site it is worked from. */
  place: string;
  /** Renown put in, and the difficulty as things stand. */
  renown: number;
  difficulty: number;
  needed: number;
  /** The greatest power still against it, and how many more stand behind. */
  opposition: string | null;
  /** Tied quests and dungeons, and whether each is done. */
  adventures: { name: string; done: boolean; percent: number }[];
  /** Its building work: the crowns to start it, the days it takes and has left (null before it
   * starts), and why it can't be done here, or null. */
  build: { crowns: number; days: number; daysLeft: number | null; blocked: string | null } | null;
  /** The allied faction's help: asked for, given (the points it took off), or not yet. */
  help: string | null;
  /** Why the party can't ask for help here, or null. */
  askBlocked: string | null;
  /** What it does once done, and whether a strike has it shut for now. */
  effect: string;
  shut: boolean;
  /** The faction set to strike it over lingering trouble. */
  trouble: string | null;
  done: boolean;
  ending: string;
  /** Why it can't be worked here, or null. */
  blocked: string | null;
  /** The crowns for one more point bought, or null if no more can be bought. */
  pointPrice: number | null;
}

export interface ProjectsView {
  renown: number;
  /** The faction the party can ask for help. */
  ally: string;
  projects: ProjectView[];
}

/** SRD 7.4.0's names for each level of opposition. */
const LEVEL: Record<string, string> = {
  minor: 'minor figures',
  local: 'local leaders',
  major: 'a major noble or beast',
  king: 'a king or famed monster',
};

/** A site's name; content checks guarantee every place, quest, and dungeon named (project-check.ts). */
const siteName = (data: GameData, id: string) =>
  data.content.regions.flatMap((r) => r.sites).find((x) => x.id === id)?.name as string;

function view(w: World, data: GameData, p: Project): ProjectView {
  const s = progressOf(w, p.id);
  const against = standing(w, data, p.difficulty.opposition);
  const [first] = against;
  const behind = against.length - 1;
  return {
    id: p.id,
    name: p.name,
    text: p.text,
    place: siteName(data, p.at),
    renown: s.renown,
    difficulty: difficultyNow(w, data, p),
    needed: renownNeeded(w, data, p),
    opposition: first
      ? `${first.name} (${LEVEL[first.level]})${behind > 0 ? `, and ${behind} more behind` : ''}`
      : null,
    adventures: p.adventures.map((a) => ({
      name: a.quest
        ? (data.content.quests.find((q) => q.id === a.quest)?.name as string)
        : `Clear ${data.content.dungeons.find((d) => d.id === a.dungeon)?.name as string}`,
      done: a.quest
        ? w.quests[a.quest]?.status === 'done'
        : hasCome(w, data, { kind: 'dungeon', dungeon: a.dungeon as string }),
      percent: a.percent,
    })),
    build: p.build
      ? {
          crowns: p.build.crowns,
          days: p.build.days,
          daysLeft: s.daysLeft,
          blocked: cannotBuild(w, data, p),
        }
      : null,
    help: s.help.map((h) => (h.points > 0 ? `${h.points} off` : 'asked')).join(', ') || null,
    askBlocked: cannotAsk(w, data, p.id),
    effect: effectText(data, p.effect),
    shut: s.shutUntil !== null && s.shutUntil > w.day,
    trouble: s.trouble
      ? (data.content.factions.factions.find((f) => f.id === s.trouble)?.name as string)
      : null,
    done: s.done !== null,
    ending: p.ending,
    blocked: cannotWork(w, data, p),
    pointPrice: buyPrice(w, data, p.id, 1),
  };
}

/**
 * The party's Renown and the projects on its map, unfinished first; none outside the campaign,
 * which alone has projects (Sam's call).
 */
export function projectsView(w: World, data: GameData): ProjectsView {
  const ally = data.content.factions.factions.find(
    (f) => f.id === data.content.projects.help.faction,
  )?.name as string;
  if (!isCampaign(w)) return { renown: 0, ally, projects: [] };
  const here = data.content.projects.projects
    .filter((p) => p.region === w.region)
    .map((p) => view(w, data, p));
  return {
    renown: w.renown,
    ally,
    projects: [...here.filter((p) => !p.done), ...here.filter((p) => p.done)],
  };
}
