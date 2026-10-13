import type { ContentData, FocusEffect, SrdData } from './schemas/index.ts';
import { gameSkills } from './skills.ts';

/** Starting packages, shields, equipment rules, and focus effects reference real records. */
export function equipmentReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const skills = new Set(gameSkills(srd, content).map((s) => s.id));
  const weapons = new Set(srd.weapons.map((w) => w.id));
  const items = new Set([
    ...weapons,
    ...srd.armor.filter((a) => a.category !== 'shield').map((a) => a.id),
    ...srd.gear.map((g) => g.id),
    ...srd['gear-bundles'].map((b) => b.id),
    content.craftingRules.tools.id,
  ]);
  for (const s of content.shields) {
    if (items.has(s.id)) errors.push(`shields/${s.id}: clashes with another item id`);
  }
  const all = new Set([...items, ...content.shields.map((s) => s.id)]);
  for (const p of content.startingPackages) {
    for (const i of p.items) {
      if (!all.has(i.id)) errors.push(`startingPackages/${p.id}: unknown item ${i.id}`);
    }
  }
  const rules = content.equipmentRules;
  for (const id of rules.noUnskilledPenalty) {
    if (!weapons.has(id)) errors.push(`equipmentRules: unknown weapon ${id}`);
  }
  // Every weapon has a shape in hand on the fight screen, and only weapons do.
  for (const id of weapons)
    if (!(id in rules.held)) errors.push(`equipmentRules/held: no shape for weapon ${id}`);
  for (const id of Object.keys(rules.held))
    if (!weapons.has(id)) errors.push(`equipmentRules/held: unknown weapon ${id}`);
  if (!srd['weapon-traits'].some((t) => t.id === rules.numerous.trait)) {
    errors.push(`equipmentRules: unknown trait ${rules.numerous.trait}`);
  }
  const effects: [string, FocusEffect][] = [...content.focusRules, ...content.racialFoci].flatMap(
    (f) => (f.effects ?? []).map((e): [string, FocusEffect] => [f.id, e]),
  );
  for (const [id, e] of effects) {
    const skill =
      e.kind === 'damage-adds-skill'
        ? e.skill
        : e.kind === 'natural-weapon'
          ? e.weapon.skill
          : undefined;
    if (skill !== undefined && !skills.has(skill)) {
      errors.push(`foci/${id}: effect uses unknown skill ${skill}`);
    }
  }
  return errors;
}
