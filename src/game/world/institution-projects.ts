// Institutions as major projects (docs/rules-adaptation.md, Major projects: Institutions; Sam's
// calls, Phase 22c): one founded in a settlement is a project with the id `inst-<service>-<town>`,
// its difficulty the institution's probability and opposition at the settlement's scope (a village,
// or a city for a town), and its building work the institution's. It opens its service once it is
// finished and its specialist has settled there. Reads only: no game module is imported here.
import type { Site } from '../../data/schemas/index.ts';
import type { AnyProject, Institution } from '../../data/schemas/project-content.ts';
import type { GameData } from '../character/context.ts';
import type { World } from './types.ts';

export type Service = Institution['service'];

const PREFIX = 'inst-';

export const institutionId = (service: Service, town: string) => `${PREFIX}${service}-${town}`;

export const isInstitutionId = (id: string) => id.startsWith(PREFIX);

/** The service and settlement an institution's id names, if it names a real pair. */
export function parseInstitutionId(
  data: GameData,
  id: string,
): { institution: Institution; site: Site; region: string } | null {
  if (!isInstitutionId(id)) return null;
  const rest = id.slice(PREFIX.length);
  const cut = rest.indexOf('-');
  const institution = data.content.projects.institutions.find(
    (i) => i.service === rest.slice(0, cut),
  );
  const town = rest.slice(cut + 1);
  const region = data.content.regions.find((r) => r.sites.some((s) => s.id === town));
  const site = region?.sites.find((s) => s.id === town);
  return institution && region && site ? { institution, site, region: region.id } : null;
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The project an institution's id stands for, or undefined if it names none. */
export function institutionProject(data: GameData, id: string): AnyProject | undefined {
  const found = parseInstitutionId(data, id);
  if (!found) return undefined;
  const { institution: i, site, region } = found;
  return {
    id,
    name: `${capital(i.name)} in ${site.name}`,
    kind: 'institution',
    region,
    at: site.id,
    text: `Build ${i.name} in ${site.name}, and settle ${i.specialist.name} there to run it.`,
    difficulty: {
      probability: i.probability,
      scope: site.size === 'village' ? 'village' : 'city',
      opposition: i.opposition,
      popular: false,
    },
    build: i.build,
    adventures: [],
    after: [],
    effect: null,
    ending: `${capital(i.name)} in ${site.name} still serves the party's friends.`,
  };
}

/** Whether an institution is built and staffed, so its service is open. */
export function isOpen(w: World, id: string): boolean {
  const s = w.majorProjects[id];
  return s !== undefined && s.done !== null && s.specialist !== null;
}

/** The services the party has opened in a settlement. */
export function openServices(w: World, data: GameData, town: string): Service[] {
  return Object.keys(w.majorProjects).flatMap((id) => {
    const found = parseInstitutionId(data, id);
    return found?.site.id === town && isOpen(w, id) ? [found.institution.service] : [];
  });
}

/** A settlement's size as things stand: a village with enough services open grows into a town. */
export function grownSize(w: World, data: GameData, site: Site): Site['size'] {
  return site.size === 'village' &&
    openServices(w, data, site.id).length >= data.content.projects.growAt
    ? 'town'
    : site.size;
}
