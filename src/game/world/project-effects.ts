// What finished major projects change in play (docs/rules-adaptation.md, Major projects: Project
// kinds; Sam's calls, Phase 22b): walls turn raids back and soften a sacking, secured roads ambush
// less and cost less, new coaches run, ended tithes raise village prices and thin patrols, and
// restored land eases foraging and waters the hexes around it. A strike after lingering trouble
// shuts a project's effect for a month (project-help.ts).
import type { CoachRoute } from '../../data/schemas/index.ts';
import type { Project, ProjectEffect } from '../../data/schemas/project-content.ts';
import { distance } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import { progressOf } from './major-projects.ts';
import { regionMap } from './region.ts';
import type { World } from './types.ts';

type Effect<K extends ProjectEffect['kind']> = Extract<ProjectEffect, { kind: K }>;

/** The effects of the finished projects working today, with each project's map. */
function working<K extends ProjectEffect['kind']>(
  w: World,
  data: GameData,
  kind: K,
): { effect: Effect<K>; project: Project }[] {
  return data.content.projects.projects.flatMap((project) => {
    const s = progressOf(w, project.id);
    const on = s.done !== null && (s.shutUntil === null || s.shutUntil <= w.day);
    return on && project.effect.kind === kind
      ? [{ effect: project.effect as Effect<K>, project }]
      : [];
  });
}

/** Percent of raids on a settlement its walls turn back before they are fought; 0 unwalled. */
export function wallsHold(w: World, data: GameData, town: string): number {
  return Math.min(
    100,
    working(w, data, 'raid-guard')
      .filter((x) => x.effect.at === town)
      .reduce((sum, x) => sum + x.effect.percent, 0),
  );
}

/** A coach route with its secured road's ambush die and fare. */
function secured(w: World, data: GameData, route: CoachRoute): CoachRoute {
  return working(w, data, 'road')
    .filter((x) => x.effect.route === route.id)
    .reduce(
      (r, { effect }) => ({
        ...r,
        ambushDie: Math.max(r.ambushDie, effect.ambushDie),
        fare: Math.max(1, r.fare - effect.fareCut),
      }),
      route,
    );
}

/** Every coach route running: the content's, secured roads applied, and the new ones projects opened. */
export function coachRoutes(w: World, data: GameData): CoachRoute[] {
  const opened = working(w, data, 'coach').map(({ effect, project }) => ({
    id: project.id,
    towns: effect.towns,
    fare: effect.fare,
    ambushDie: effect.ambushDie,
  }));
  return [...data.content.coachRoutes, ...opened].map((r) => secured(w, data, r));
}

/** How many percent more the villages on the party's map pay, its tithe ended. */
export function titheSpoils(w: World, data: GameData): number {
  return working(w, data, 'tithe')
    .filter((x) => x.effect.region === w.region)
    .reduce((sum, x) => sum + x.effect.sellPercent, 0);
}

/** The percent of a faction's patrols that still ride on the party's map, its tithe ended. */
export function patrolsLeft(w: World, data: GameData, faction: string): number {
  return working(w, data, 'tithe')
    .filter((x) => x.effect.region === w.region && x.effect.faction === faction)
    .reduce((left, x) => Math.round((left * x.effect.patrolPercent) / 100), 100);
}

/** Whether the party's hex lies within an effect's reach of its settlement, on that map. */
function inReach(w: World, data: GameData, project: Project, at: string, radius: number): boolean {
  if (w.dungeon || project.region !== w.region) return false;
  const site = regionMap(data, w.region).sites.find((s) => s.id === at);
  return site !== undefined && distance(site, w.position) <= radius;
}

/** How much easier foraging and hunting are where the party stands. */
export function forageBonus(w: World, data: GameData): number {
  return working(w, data, 'forage')
    .filter((x) => inReach(w, data, x.project, x.effect.at, x.effect.radius))
    .reduce((sum, x) => sum + x.effect.bonus, 0);
}

/** Whether restored water reaches the party's hex: it fills the water die and isn't dry land. */
export function watered(w: World, data: GameData): boolean {
  return working(w, data, 'water').some((x) =>
    inReach(w, data, x.project, x.effect.at, x.effect.radius),
  );
}
