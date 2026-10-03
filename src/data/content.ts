import backgrounds from '../../data/content/backgrounds.json';
import peoples from '../../data/content/peoples.json';
import { ContentSchemas, type ContentData, type SrdData } from './schemas/index.ts';

export function loadContent(): ContentData {
  return {
    peoples: ContentSchemas.peoples.parse(peoples),
    backgrounds: ContentSchemas.backgrounds.parse(backgrounds),
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
  for (const [name, list] of Object.entries(content)) {
    const ids = list.map((r) => r.id);
    for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) {
      errors.push(`${name}: duplicate id ${id}`);
    }
  }
  return errors;
}
