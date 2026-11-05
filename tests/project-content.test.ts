import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/data/content.ts';
import { loadSrd } from '../src/data/load.ts';
import { projectReferenceErrors } from '../src/data/project-check.ts';
import type { ContentData } from '../src/data/schemas/index.ts';
import type { Project, ProjectContent } from '../src/data/schemas/project-content.ts';

const srd = loadSrd();
const content = loadContent();
const p = content.projects;
const first = p.projects[0] as Project;

/** The content with these projects and the rest of the project file changed. */
function with_(change: Partial<ProjectContent>): ContentData {
  return { ...content, projects: { ...p, ...change } };
}

describe('project content (docs/rules-adaptation.md, Major projects; Sam’s calls)', () => {
  it('loads a clean first list on the campaign maps', () => {
    expect(projectReferenceErrors(srd, content)).toEqual([]);
    expect(new Set(p.projects.map((x) => x.kind))).toEqual(
      new Set(['fortify', 'road', 'grip', 'restore']),
    );
    expect(p.institutions.map((i) => i.service).sort()).toEqual(
      ['alchemist', 'arena', 'crypt', 'mortuary', 'temple', 'workshop'].sort(),
    );
    // SRD 7.5.0's table at 1/50, and 4.8.2's 1,000 silver a point at 1/50.
    expect(p.buying.map((b) => b.crowns)).toEqual([10, 40, 80, 160, 320, 640]);
    expect(p.workingCrownsPerPoint).toBe(20);
    // The Faithful oppose every new crypt.
    const crypt = p.institutions.find((i) => i.service === 'crypt');
    expect(crypt?.opposition.map((o) => o.level)).toEqual(['local']);
    // Beaten either way: nothing left at the Ember Shrine, or The Hollow Throne turned in.
    expect(crypt?.opposition[0]?.beaten.map((b) => b.kind)).toEqual(['faction-gone', 'quest']);
  });

  it('reports a project off the campaign, unknown places, and unknown references', () => {
    const broken: Project = {
      ...first,
      id: 'broken',
      region: 'wastes-fringe',
      at: 'nowhere',
      difficulty: {
        ...first.difficulty,
        opposition: [
          {
            name: 'a',
            level: 'minor',
            beaten: [{ kind: 'faction-gone', faction: 'no', at: 'no' }],
          },
          { name: 'b', level: 'minor', beaten: [{ kind: 'quest', quest: 'no' }] },
          { name: 'c', level: 'minor', beaten: [{ kind: 'dungeon', dungeon: 'no' }] },
        ],
      },
      build: { crowns: 1, days: 1, skill: 'juggling', exert: false },
      adventures: [{ percent: 10 }, { quest: 'no', percent: 10 }, { dungeon: 'no', percent: 10 }],
      after: ['no'],
      effect: { kind: 'road', route: 'no', ambushDie: 8, fareCut: 0 },
    };
    expect(projectReferenceErrors(srd, with_({ projects: [broken] }))).toEqual([
      'projects/broken: wastes-fringe is not a campaign map',
      'projects/broken: nowhere is not a site in wastes-fringe',
      'projects/broken: unknown faction no',
      'projects/broken: unknown faction location no',
      'projects/broken: unknown quest no',
      'projects/broken: unknown dungeon no',
      'projects/broken: unknown skill juggling',
      'projects/broken: an adventure names one quest or dungeon',
      'projects/broken: unknown quest no',
      'projects/broken: unknown dungeon no',
      'projects/broken: unknown project no',
      'projects/broken: unknown coach route no',
    ]);
  });

  it('reports an unknown map and effects pointing off the project’s map', () => {
    const lost: Project = { ...first, id: 'lost', region: 'atlantis' };
    const coach: Project = {
      ...first,
      id: 'coach',
      effect: { kind: 'coach', towns: ['westhold', 'cinderhold'], fare: 1, ambushDie: 6 },
    };
    const tithe: Project = {
      ...first,
      id: 'tithe',
      effect: {
        kind: 'tithe',
        region: 'borderlands',
        faction: 'no',
        sellPercent: 1,
        patrolPercent: 1,
      },
    };
    // A project waiting on another that exists is fine.
    const water: Project = {
      ...first,
      id: 'water',
      after: [first.id],
      effect: { kind: 'water', at: 'westhold', radius: 3 },
    };
    const projects = [first, lost, coach, tithe, water];
    expect(projectReferenceErrors(srd, with_({ projects }))).toEqual([
      'projects/lost: unknown region atlantis',
      'projects/lost: lanternfall is not a site in atlantis',
      'projects/lost: lanternfall is not a site in atlantis',
      'projects/coach: westhold is not a site in dark-lands',
      'projects/tithe: tithe ends on another map',
      'projects/tithe: unknown faction no',
      'projects/water: westhold is not a site in dark-lands',
    ]);
  });

  it('reports a service listed twice, unknown captives and skills, help, and the hired mage', () => {
    const [workshop] = p.institutions;
    if (!workshop) throw new Error('no institutions');
    const twice = {
      ...workshop,
      build: { ...workshop.build, skill: 'juggling' },
      specialist: { ...workshop.specialist, captives: ['nobody'] },
    };
    const trading = {
      ...workshop,
      service: 'arena' as const,
      build: { ...workshop.build, skill: 'trade' },
    };
    const noExert = Object.fromEntries(
      Object.entries(p.buildAttributes).filter(([skill]) => skill !== 'exert'),
    );
    const broken = with_({
      buildAttributes: noExert,
      institutions: [workshop, twice, trading],
      help: { faction: 'no', suits: [] },
      hiredMage: { hireling: 'no', fee: 1, points: 1, most: 2 },
    });
    expect(projectReferenceErrors(srd, broken)).toEqual([
      'projects/institutions/workshop: listed twice',
      'projects/institutions/workshop: unknown skill juggling',
      'projects/institutions/workshop: unknown captive nobody',
      'projects/institutions/arena: no attributes for trade',
      'projects/buildAttributes: no attributes for exert',
      'projects/help: unknown faction no',
      'projects/hiredMage: unknown hireling no',
    ]);
  });
});
