import backgrounds from '../../data/content/backgrounds.json';
import focusRules from '../../data/content/focus-rules.json';
import peoples from '../../data/content/peoples.json';
import racialFoci from '../../data/content/racial-foci.json';
import equipmentRules from '../../data/content/equipment-rules.json';
import shields from '../../data/content/shields.json';
import startingPackages from '../../data/content/starting-packages.json';
import traditions from '../../data/content/traditions.json';
import classOptions from '../../data/content/class-options.json';
import combatMagic from '../../data/content/combat-magic.json';
import monsterCombat from '../../data/content/monster-combat.json';
import { combatReferenceErrors } from './combat-check.ts';
import { equipmentReferenceErrors } from './equipment-check.ts';
import { focusReferenceErrors } from './focus-content.ts';
import { magicReferenceErrors } from './magic-check.ts';
import { ContentSchemas, type ContentData, type SrdData } from './schemas/index.ts';

export function loadContent(): ContentData {
  return {
    peoples: ContentSchemas.peoples.parse(peoples),
    backgrounds: ContentSchemas.backgrounds.parse(backgrounds),
    racialFoci: ContentSchemas.racialFoci.parse(racialFoci),
    focusRules: ContentSchemas.focusRules.parse(focusRules),
    shields: ContentSchemas.shields.parse(shields),
    startingPackages: ContentSchemas.startingPackages.parse(startingPackages),
    equipmentRules: ContentSchemas.equipmentRules.parse(equipmentRules),
    traditions: ContentSchemas.traditions.parse(traditions),
    classOptions: ContentSchemas.classOptions.parse(classOptions),
    monsterCombat: ContentSchemas.monsterCombat.parse(monsterCombat),
    combatMagic: ContentSchemas.combatMagic.parse(combatMagic),
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
  const idLists: [string, { id: string }[]][] = [
    ['peoples', content.peoples],
    ['backgrounds', content.backgrounds],
    ['racialFoci', content.racialFoci],
    ['focusRules', content.focusRules],
    ['shields', content.shields],
    ['startingPackages', content.startingPackages],
    ['traditions', content.traditions],
    ['classOptions', content.classOptions],
    ['monsterCombat', content.monsterCombat],
    ['combatMagic', content.combatMagic],
    ...content.peoples.map((p): [string, { id: string }[]] => [
      `peoples/${p.id} lineages`,
      p.lineages ?? [],
    ]),
  ];
  for (const [name, list] of idLists) {
    const ids = list.map((r) => r.id);
    for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) {
      errors.push(`${name}: duplicate id ${id}`);
    }
  }
  return [
    ...errors,
    ...focusReferenceErrors(srd, content),
    ...equipmentReferenceErrors(srd, content),
    ...magicReferenceErrors(srd, content),
    ...combatReferenceErrors(srd, content),
  ];
}
