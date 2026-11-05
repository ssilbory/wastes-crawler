// Cross-references for data/content/projects.json (docs/rules-adaptation.md, Major projects,
// institutions, and recruits): every place, faction, quest, dungeon, route, skill, captive, and
// hireling a project names exists, and each project stands in the campaign.
import type { ContentData, SrdData } from './schemas/index.ts';
import type { ProjectContent } from './schemas/project-content.ts';
import { gameSkills } from './skills.ts';

type Opposition = ProjectContent['projects'][number]['difficulty']['opposition'][number];

export function projectReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const p = content.projects;
  const regions = new Map(content.regions.map((r) => [r.id, r]));
  // The campaign's maps are those no shipped realm plays (Where: campaign only).
  const realmMaps = new Set(content.realms.flatMap((r) => r.regions));
  const campaign = new Set(content.regions.map((r) => r.id).filter((id) => !realmMaps.has(id)));
  const sites = new Map(content.regions.flatMap((r) => r.sites.map((s) => [s.id, r.id])));
  const factions = new Set(content.factions.factions.map((f) => f.id));
  const locations = new Set(content.factions.locations.map((l) => l.id));
  const quests = new Set(content.quests.map((q) => q.id));
  const dungeons = new Set(content.dungeons.map((d) => d.id));
  const routes = new Set(content.coachRoutes.map((r) => r.id));
  const skills = new Set(gameSkills(srd, content).map((s) => s.id));
  const captives = new Set(content.captives.map((c) => c.id));
  const ids = new Set(p.projects.map((x) => x.id));

  const opposition = (where: string, list: Opposition[]) => {
    for (const b of list.flatMap((o) => o.beaten)) {
      if (b.kind === 'faction-gone') {
        if (!factions.has(b.faction)) errors.push(`${where}: unknown faction ${b.faction}`);
        if (!locations.has(b.at)) errors.push(`${where}: unknown faction location ${b.at}`);
      }
      if (b.kind === 'quest' && !quests.has(b.quest))
        errors.push(`${where}: unknown quest ${b.quest}`);
      if (b.kind === 'dungeon' && !dungeons.has(b.dungeon))
        errors.push(`${where}: unknown dungeon ${b.dungeon}`);
    }
  };
  const skill = (where: string, id: string) => {
    if (!skills.has(id)) errors.push(`${where}: unknown skill ${id}`);
    else if (!p.buildAttributes[id]) errors.push(`${where}: no attributes for ${id}`);
  };
  const site = (where: string, id: string, region: string) => {
    if (sites.get(id) !== region) errors.push(`${where}: ${id} is not a site in ${region}`);
  };

  for (const x of p.projects) {
    const where = `projects/${x.id}`;
    if (!regions.has(x.region)) errors.push(`${where}: unknown region ${x.region}`);
    else if (!campaign.has(x.region)) errors.push(`${where}: ${x.region} is not a campaign map`);
    site(where, x.at, x.region);
    opposition(where, x.difficulty.opposition);
    if (x.build) skill(where, x.build.skill);
    for (const a of x.adventures) {
      if (!a.quest === !a.dungeon) errors.push(`${where}: an adventure names one quest or dungeon`);
      if (a.quest && !quests.has(a.quest)) errors.push(`${where}: unknown quest ${a.quest}`);
      if (a.dungeon && !dungeons.has(a.dungeon))
        errors.push(`${where}: unknown dungeon ${a.dungeon}`);
    }
    for (const id of x.after) if (!ids.has(id)) errors.push(`${where}: unknown project ${id}`);
    const e = x.effect;
    if ('at' in e) site(where, e.at, x.region);
    if (e.kind === 'road' && !routes.has(e.route))
      errors.push(`${where}: unknown coach route ${e.route}`);
    if (e.kind === 'coach') for (const t of e.towns) site(where, t, x.region);
    if (e.kind === 'tithe') {
      if (e.region !== x.region) errors.push(`${where}: tithe ends on another map`);
      if (e.faction && !factions.has(e.faction))
        errors.push(`${where}: unknown faction ${e.faction}`);
    }
  }
  const services = new Set<string>();
  for (const i of p.institutions) {
    const where = `projects/institutions/${i.service}`;
    if (services.has(i.service)) errors.push(`${where}: listed twice`);
    services.add(i.service);
    skill(where, i.build.skill);
    opposition(where, i.opposition);
    for (const c of i.specialist.captives)
      if (!captives.has(c)) errors.push(`${where}: unknown captive ${c}`);
  }
  if (!p.buildAttributes.exert) errors.push('projects/buildAttributes: no attributes for exert');
  if (!factions.has(p.help.faction))
    errors.push(`projects/help: unknown faction ${p.help.faction}`);
  if (!content.npcRules.hirelings.some((h) => h.id === p.hiredMage.hireling))
    errors.push(`projects/hiredMage: unknown hireling ${p.hiredMage.hireling}`);
  return errors;
}
