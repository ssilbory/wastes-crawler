// vendor/wwn-srd/1.0 Character Creation/1.6.0 Foci.md and 1.2.0 Skills.md (1.2.2); racial foci,
// focus categories, and the no-duplicate rule: docs/rules-adaptation.md (Foci).
import { RACIAL_FOCI } from '../../data/focus-content.ts';
import type {
  Attribute,
  BonusSkill,
  FocusCategory,
  Lineage,
  People,
  Progression,
} from '../../data/schemas/index.ts';
import type { ModifierBonuses } from '../../rules/attributes.ts';
import type { GameData } from './context.ts';
import { addCreationSkill, COMBAT_SKILLS, type Skills } from './skills.ts';
import { fail, INCOMPLETE, OK, type StepStatus } from './steps.ts';

export interface FocusInfo {
  id: string;
  name: string;
  description: string;
  levels: { level: number; text: string }[];
  /** Null for racial foci, which class picks can't take. */
  category: FocusCategory | null;
  bonusSkill: BonusSkill | undefined;
  attributeChoice: boolean;
  dieHard: boolean;
  pickable: boolean;
}

export function focusInfo(data: GameData, id: string): FocusInfo | undefined {
  const racial = data.content.racialFoci.find((f) => f.id === id);
  if (racial) {
    const { bonusSkill, ...rest } = racial;
    return {
      ...rest,
      category: null,
      bonusSkill,
      attributeChoice: false,
      dieHard: false,
      pickable: false,
    };
  }
  const srd = data.srd.foci.find((f) => f.id === id);
  const rule = data.content.focusRules.find((r) => r.id === id);
  if (!srd || !rule) return undefined;
  return {
    id,
    name: srd.name,
    description: srd.description,
    levels: srd.levels,
    category: rule.category,
    bonusSkill: rule.bonusSkill,
    attributeChoice: rule.attributeChoice === true,
    dieHard: rule.dieHard === true,
    pickable: rule.availability === 'pickable',
  };
}

export type SlotKind = 'signature' | 'racial' | 'any' | 'combat' | 'non-combat';

export interface FocusSlot {
  kind: SlotKind;
  /** The focus a signature slot always holds. */
  fixed?: string;
  /** The foci a racial slot may take. */
  options?: string[];
}

/** Signature foci, then racial fill-in picks, then the class's level-1 picks (SRD 1.6.0). */
export function focusSlots(
  people: People,
  lineage: Lineage | undefined,
  progression: Progression | undefined,
): FocusSlot[] {
  const signature = [...people.signatureFoci, ...(lineage?.signatureFoci ?? [])];
  const slots: FocusSlot[] = signature.map((id) => ({ kind: 'signature', fixed: id }));
  for (let i = signature.length; i < RACIAL_FOCI; i++) {
    slots.push({ kind: 'racial', options: people.racialFocusPicks });
  }
  const KIND = { any: 'any', warrior: 'combat', expert: 'non-combat' } as const;
  for (const pick of progression?.levels[0]?.focusPicks ?? []) {
    for (let i = 0; i < pick.count; i++) slots.push({ kind: KIND[pick.category] });
  }
  return slots;
}

/** A player's choice for one slot: `skill` resolves or replaces a bonus skill. */
export interface FocusChoice {
  id: string;
  skill?: string;
  attribute?: Attribute | undefined;
}

export interface HeldFocus {
  id: string;
  level: number;
  attribute?: Attribute | undefined;
}

export interface FociOutcome {
  status: StepStatus;
  skills: Skills;
  /** The skills before each slot that was reached, so a UI can offer replacements. */
  skillsBefore: Skills[];
  foci: HeldFocus[];
  bonuses: ModifierBonuses;
}

/** The skills a bonus skill may become, before any level-1 replacement. */
export function allowedSkills(data: GameData, b: BonusSkill): string[] {
  const all = data.srd.skills.map((s) => s.id);
  if (b.kind === 'skill') return [b.skill];
  if (b.kind === 'one-of') return b.skills;
  if (b.kind === 'any-combat') return [...COMBAT_SKILLS];
  if (b.kind === 'any') return all;
  return all.filter((s) => !b.except.includes(s));
}

/**
 * The bonus skill counts as a creation pick (SRD 2.7.1.6). If every skill the focus offers is
 * already level-1, the player picks any other skill instead (1.2.2).
 */
function gainBonusSkill(
  data: GameData,
  skills: Skills,
  focus: FocusInfo,
  chosen: string | undefined,
): { skills: Skills } | { error: StepStatus } {
  if (!focus.bonusSkill) return { skills };
  const allowed = allowedSkills(data, focus.bonusSkill);
  const exhausted = allowed.every((s) => skills[s] === 1);
  const target = chosen ?? (allowed.length === 1 ? allowed[0] : undefined);
  if (target === undefined) return { error: INCOMPLETE };
  if (!allowed.includes(target) && !(exhausted && data.srd.skills.some((s) => s.id === target))) {
    return { error: fail(`${focus.name} can't give ${target}`) };
  }
  const next = addCreationSkill(skills, target);
  if (next === 'already-level-1') {
    return { error: fail(`${target} is already level-1; choose another skill`) };
  }
  return { skills: next };
}

function slotError(slot: FocusSlot, focus: FocusInfo, racial: Set<string>): string | null {
  if (slot.kind === 'signature') return slot.fixed === focus.id ? null : 'wrong signature focus';
  if (slot.kind === 'racial') {
    if (!slot.options?.includes(focus.id)) return `${focus.name} isn't on your people's list`;
    return racial.has(focus.id) ? `${focus.name} is already one of your racial foci` : null;
  }
  if (racial.has(focus.id)) return `${focus.name} is one of your racial foci`;
  if (!focus.pickable) return `${focus.name} can't be picked in this version`;
  if (slot.kind === 'combat' && focus.category === 'non-combat')
    return `${focus.name} isn't a combat focus`;
  if (slot.kind === 'non-combat' && focus.category === 'combat')
    return `${focus.name} isn't a non-combat focus`;
  return null;
}

export function evaluateFoci(
  data: GameData,
  slots: readonly FocusSlot[],
  choices: readonly (FocusChoice | null)[],
  startSkills: Skills,
): FociOutcome {
  let skills = startSkills;
  const foci: HeldFocus[] = [];
  const bonuses: ModifierBonuses = {};
  const racial = new Set<string>();
  const skillsBefore: Skills[] = [];
  const done = (status: StepStatus): FociOutcome => ({
    status,
    skills,
    skillsBefore,
    foci,
    bonuses,
  });
  if (choices.length > slots.length) return done(fail(`expected ${slots.length} foci`));

  for (const [i, slot] of slots.entries()) {
    skillsBefore.push(skills);
    const choice = choices[i] ?? (slot.fixed ? { id: slot.fixed } : null);
    if (!choice) return done(INCOMPLETE);
    const focus = focusInfo(data, choice.id);
    if (!focus) return done(fail(`unknown focus ${choice.id}`));
    const error = slotError(slot, focus, racial);
    if (error) return done(fail(error));
    if (slot.kind === 'signature' || slot.kind === 'racial') racial.add(focus.id);

    if (focus.attributeChoice) {
      if (!choice.attribute) return done(INCOMPLETE);
      if (bonuses[choice.attribute]) {
        return done(fail(`${focus.name} already improves ${choice.attribute}`));
      }
      bonuses[choice.attribute] = 1;
      foci.push({ id: focus.id, level: 1, attribute: choice.attribute });
      continue;
    }
    const held = foci.find((f) => f.id === focus.id);
    if (held) {
      // A second pick adds the next level; only the first level grants a bonus skill.
      if (held.level >= focus.levels.length) return done(fail(`${focus.name} has no next level`));
      held.level += 1;
      continue;
    }
    const gain = gainBonusSkill(data, skills, focus, choice.skill);
    if ('error' in gain) return done(gain.error);
    skills = gain.skills;
    foci.push({ id: focus.id, level: 1 });
  }
  return done(OK);
}

/** Die Hard adds 2 hit points per level (1.6.0 Foci.md, 1.7.1). */
export function hasDieHard(data: GameData, foci: readonly HeldFocus[]): boolean {
  return foci.some((f) => focusInfo(data, f.id)?.dieHard === true);
}

export function modifierBonuses(foci: readonly HeldFocus[]): ModifierBonuses {
  const out: ModifierBonuses = {};
  for (const f of foci) if (f.attribute) out[f.attribute] = 1;
  return out;
}
