import backgrounds from '../../data/content/backgrounds.json';
import focusRules from '../../data/content/focus-rules.json';
import peoples from '../../data/content/peoples.json';
import racialFoci from '../../data/content/racial-foci.json';
import { focusReferenceErrors } from './focus-content.ts';
import { ContentSchemas, type ContentData, type SrdData } from './schemas/index.ts';

export function loadContent(): ContentData {
  return {
    peoples: ContentSchemas.peoples.parse(peoples),
    backgrounds: ContentSchemas.backgrounds.parse(backgrounds),
    racialFoci: ContentSchemas.racialFoci.parse(racialFoci),
    focusRules: ContentSchemas.focusRules.parse(focusRules),
  };
}

/** Authored content may only reference SRD records that exist. */
export function contentReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const skills = new Set(srd.skills.map((s) => s.id));
  const errors: string[] = [];
  const check = (where: string, skill: string) => {
    if (!skills.has(skill)) errors.push(`${where}: unknown skill ${skill}`);
  };
  for (const b of content.backgrounds) {
    check(`backgrounds/${b.id} free skill`, b.freeSkill);
    b.growth.forEach(
      (e, i) => e.kind === 'skill' && check(`backgrounds/${b.id} growth ${i + 1}`, e.skill),
    );
    b.learning.forEach(
      (e, i) => e.kind === 'skill' && check(`backgrounds/${b.id} learning ${i + 1}`, e.skill),
    );
  }
  const peoples = new Set(content.peoples.map((p) => p.id));
  for (const b of content.backgrounds) {
    for (const p of b.peoples ?? []) {
      if (!peoples.has(p)) errors.push(`backgrounds/${b.id}: unknown people ${p}`);
    }
  }
  for (const p of content.peoples) {
    if (!content.backgrounds.some((b) => !b.peoples || b.peoples.includes(p.id))) {
      errors.push(`peoples/${p.id}: no background is open to it`);
    }
  }
  const lists: [string, { id: string }[]][] = [
    ...Object.entries(content),
    ...content.peoples.map((p): [string, { id: string }[]] => [
      `peoples/${p.id} lineages`,
      p.lineages ?? [],
    ]),
  ];
  for (const [name, list] of lists) {
    const ids = list.map((r) => r.id);
    for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) {
      errors.push(`${name}: duplicate id ${id}`);
    }
  }
  return [...errors, ...focusReferenceErrors(srd, content)];
}
