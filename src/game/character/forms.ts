// A Skinshifter's alternate forms (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.15
// The Skinshifter.md; docs/rules-adaptation.md, The Skinshifter): which forms a character may keep,
// and what wearing one changes on the sheet.
import type { Character, Form, FocusEffect, NaturalWeapon } from '../../data/schemas/index.ts';
import {
  boostedModifier,
  type AttributeScores,
  type ModifierBonuses,
} from '../../rules/attributes.ts';
import { formModifier, intrinsicAc, talonsBonus } from '../../rules/forms.ts';
import { castingRow, characterLevel, type ClassLevels } from '../../rules/progression.ts';
import { classOption } from './class-step.ts';
import type { GameData } from './context.ts';

/** Arts the Skinshifter holds for themselves, never applied to a form (1.5.15.1). */
const INTRINSIC = ['change-form', 'pliant-flesh'];

/** The arts table of the Skinshifter class held at the highest level, and that level. */
function shifterClass(data: GameData, classes: ClassLevels) {
  const held = Object.entries(classes.levels).flatMap(([id, level]) => {
    const t = classOption(data, id)?.mage?.traditions.find((x) => x.tradition === 'skinshifter');
    return t && level >= 1 ? [{ table: t.arts, level }] : [];
  });
  return held.sort((a, b) => b.level - a.level)[0];
}

/** The hit bonus in a non-humanoid form, from the Skinshifter's own level (1.5.15). */
export function formBonus(data: GameData, classes: ClassLevels): number {
  const held = shifterClass(data, classes);
  const table = held && data.srd['casting-progressions'].find((t) => t.id === held.table);
  return table && held ? castingRow(table, held.level).formBonus : 0;
}

/** The arts the character holds that can be applied to a form. */
export const formArts = (data: GameData, c: Character): string[] =>
  c.arts.filter(
    (id) =>
      !INTRINSIC.includes(id) &&
      data.srd.arts.find((a) => a.id === id)?.tradition === 'skinshifter',
  );

/** One form per character level, for a Skinshifter (1.5.15). */
export const maxForms = (data: GameData, c: Character): number =>
  shifterClass(data, c.classes) ? characterLevel(c.classes) : 0;

/** Why a set of forms can't be kept, or null if it can. */
export function formProblem(data: GameData, c: Character, forms: readonly Form[]): string | null {
  const most = maxForms(data, c);
  if (forms.length > most) return `${c.name} can keep ${most} form${most === 1 ? '' : 's'}`;
  const names = forms.map((f) => f.name.trim().toLowerCase());
  if (new Set(names).size < names.length) return 'each form needs its own name';
  const held = formArts(data, c);
  for (const f of forms) {
    if (new Set(f.arts).size < f.arts.length) return `${f.name}: each art can be applied once`;
    const stray = f.arts.find((a) => !held.includes(a));
    if (stray) return `${f.name}: ${c.name} can't give a form ${stray}`;
    if (f.arts.includes('feral-prowess') !== (f.feral !== undefined))
      return `${f.name}: Feral Prowess needs an attribute, and only Feral Prowess takes one`;
  }
  return null;
}

/** What a form changes on the sheet: modifiers, attacks, base AC, and the attack bonus floor. */
export interface FormShape {
  bonuses: ModifierBonuses;
  effects: FocusEffect[];
  innateAc: number | null;
  attackFloor: number;
}

export function formShape(
  data: GameData,
  c: Character,
  form: Form,
  scores: AttributeScores,
  bonuses: ModifierBonuses,
): FormShape {
  const level = characterLevel(c.classes);
  const has = (id: string) => form.arts.includes(id);
  const raised = { ...bonuses };
  // Each raised modifier goes in as a focus bonus, so saves and checks see it too.
  const raise = (a: 'str' | 'dex' | 'con' | 'cha') => {
    const now = boostedModifier(scores[a], raised[a]);
    raised[a] = (raised[a] ?? 0) + formModifier(now) - now;
  };
  if (form.feral) raise(form.feral);
  if (has('sculptors-beauty')) raise('cha');
  const extra = talonsBonus(level);
  const talons: NaturalWeapon = {
    id: 'savage-talons',
    name: 'Savage Talons',
    damage: { count: 1, sides: 8, modifier: extra },
    shock: { damage: 2 + extra, maxAc: 13 },
    attributes: ['str', 'dex'],
    skill: 'punch',
  };
  return {
    bonuses: raised,
    effects: [
      ...(has('savage-talons')
        ? [{ kind: 'natural-weapon' as const, level: 1, weapon: talons }]
        : []),
      ...(has('warform')
        ? [{ kind: 'hit-bonus' as const, level: 1, amount: 2, modes: ['melee' as const] }]
        : []),
    ],
    innateAc: has('intrinsic-armor') ? intrinsicAc(level) : null,
    attackFloor: !form.humanoid || has('warform') ? formBonus(data, c.classes) : 0,
  };
}
