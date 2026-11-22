// Crafter places (docs/rules-adaptation.md, Crafters; Sam's calls): each tier of settlement makes
// room for one more kind of crafter, a smith, an alchemist, or a wizard (a village one, a town two,
// a city three; town-rules.json's crafterPlaces), one of each kind at most. The content's crafters
// fill places, and so do the party's own workshops, alchemist's shops, and sanctums, under way or
// open. A village grown into a town (Growth) has a town's room. Reads only.
import { contentCrafters, CRAFTER_KINDS, type CrafterKind } from '../../data/crafters.ts';
import type { Site } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { grownSize, institutionId, type Service } from './institution-projects.ts';
import type { World } from './types.ts';

/** The institution that brings each kind of crafter. */
const SERVICE: Record<CrafterKind, Service> = {
  smith: 'workshop',
  alchemist: 'alchemist',
  wizard: 'sanctum',
};

/** The kind of crafter an institution brings, if it brings one. */
export const crafterKindOf = (service: Service): CrafterKind | undefined =>
  CRAFTER_KINDS.find((k) => SERVICE[k] === service);

/** The kinds of crafter a settlement has or is getting. */
export function crafterKindsAt(w: World, data: GameData, town: string): CrafterKind[] {
  const own = contentCrafters(data.content, town);
  return CRAFTER_KINDS.filter(
    (k) => own.includes(k) || w.majorProjects[institutionId(SERVICE[k], town)] !== undefined,
  );
}

/** How many kinds of crafter a settlement has room for, at its size as things stand. */
export const crafterPlaces = (w: World, data: GameData, site: Site) =>
  data.content.townRules.crafterPlaces[grownSize(w, data, site)];

/** Whether a settlement has room for a crafter of this kind: it has one, or a place is free. */
export function crafterRoom(w: World, data: GameData, site: Site, kind: CrafterKind): boolean {
  const kinds = crafterKindsAt(w, data, site.id);
  return kinds.includes(kind) || kinds.length < crafterPlaces(w, data, site);
}
