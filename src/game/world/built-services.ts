// The services the party's institutions open (docs/rules-adaptation.md, Major projects:
// Institutions; Sam's calls, Phase 22c): a built and staffed workshop is the party's to use and
// brings a smith, and an alchemist, an arena, or a place that raises the dead opens like any town's.
// A new smith, alchemist, or arena takes the lists or bout card of the nearest settlement on the map
// that has one (the first anywhere, if none does). Reads only, so the town lookups can use them.
import type {
  Alchemist,
  ArenaBout,
  Craftsman,
  MissionGiver,
  Site,
} from '../../data/schemas/index.ts';
import { distance } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import { institutionId, isOpen, type Service } from './institution-projects.ts';
import type { World } from './types.ts';

/** A settlement and the map it is on; content checks guarantee every one named. */
function placeOf(data: GameData, town: string): { site: Site; region: string } {
  const region = data.content.regions.find((r) => r.sites.some((s) => s.id === town));
  const site = region?.sites.find((s) => s.id === town) as Site;
  return { site, region: region?.id as string };
}

/** The entry of `items` whose town is nearest `town` on its map, or the first if none is there. */
function nearest<T extends { town: string }>(data: GameData, town: string, items: readonly T[]) {
  const here = placeOf(data, town);
  const near = items
    .map((x) => ({ x, at: placeOf(data, x.town) }))
    .filter((e) => e.at.region === here.region)
    .sort((a, b) => distance(a.at.site, here.site) - distance(b.at.site, here.site));
  return (near[0]?.x ?? items[0]) as T;
}

/** The name of the specialist running the party's open institution there, if it is open. */
function specialistOf(w: World, service: Service, town: string): string | null {
  const id = institutionId(service, town);
  // Open means finished and staffed: the specialist is there.
  return isOpen(w, id) ? (w.majorProjects[id]?.specialist as string) : null;
}

/** Whether the party's own workshop is open in a settlement. */
export const builtWorkshop = (w: World, town: string) => specialistOf(w, 'workshop', town) !== null;

/** The smith of the party's workshop there, trading from the nearest smith's lists. */
export function builtCraftsman(w: World, data: GameData, town: string): Craftsman | undefined {
  const name = specialistOf(w, 'workshop', town);
  if (!name) return undefined;
  const base = nearest(data, town, data.content.craftsmen);
  return { ...base, id: institutionId('workshop', town), name, town };
}

/** The party's alchemist there, with the nearest alchemist's wares. */
export function builtAlchemist(w: World, data: GameData, town: string): Alchemist | undefined {
  const name = specialistOf(w, 'alchemist', town);
  if (!name) return undefined;
  const base = nearest(data, town, data.content.alchemy.alchemists);
  return { ...base, id: institutionId('alchemist', town), name, town };
}

/** The party's arena there, with the nearest arena's bout card. */
export function builtArena(w: World, data: GameData, town: string): ArenaBout[] | undefined {
  if (!specialistOf(w, 'arena', town)) return undefined;
  return nearest(data, town, data.content.arenaCards).bouts;
}

/** The party's crypt, mortuary, or temple there, if one is open. */
export function builtRaiser(w: World, town: string): MissionGiver | undefined {
  for (const raises of ['crypt', 'mortuary', 'temple'] as const) {
    const name = specialistOf(w, raises, town);
    if (name)
      return {
        id: institutionId(raises, town),
        name,
        town,
        raises,
        text: `${name} keeps the party's ${raises}.`,
      };
  }
  return undefined;
}
