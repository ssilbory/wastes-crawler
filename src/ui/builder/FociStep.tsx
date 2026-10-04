import type { Attribute } from '../../data/schemas/index.ts';
import { ATTRIBUTES } from '../../game/character/attributes.ts';
import type { StepStatus } from '../../game/character/creation.ts';
import {
  allowedSkills,
  focusInfo,
  type FocusChoice,
  type FocusSlot,
  type SlotKind,
} from '../../game/character/foci.ts';
import type { Skills } from '../../game/character/skills.ts';
import { ATTRIBUTE_NAMES, data, skillName, skills } from './data.ts';
import { Select, Step } from './Field.tsx';

const SLOT_LABEL: Record<SlotKind, string> = {
  signature: 'Signature focus',
  racial: 'Racial focus',
  combat: 'Combat focus',
  'non-combat': 'Non-combat focus',
  any: 'Any focus',
};

const pickable = data.content.focusRules.filter((r) => r.availability === 'pickable');

function slotLabels(slots: readonly FocusSlot[]): string[] {
  return slots.map((slot, i) => {
    const same = slots.filter((s) => s.kind === slot.kind);
    if (slot.fixed) return focusInfo(data, slot.fixed)?.name ?? slot.fixed;
    if (same.length === 1) return SLOT_LABEL[slot.kind];
    return `${SLOT_LABEL[slot.kind]} ${slots.slice(0, i + 1).filter((s) => s.kind === slot.kind).length}`;
  });
}

function slotOptions(slot: FocusSlot, racial: Set<string>) {
  const ids =
    slot.kind === 'racial'
      ? (slot.options ?? [])
      : pickable
          .filter((r) => !racial.has(r.id))
          .filter((r) => slot.kind === 'any' || r.category === 'both' || r.category === slot.kind)
          .map((r) => r.id);
  return ids.map((id) => ({ value: id, label: focusInfo(data, id)?.name ?? id }));
}

/** The bonus skill or attribute a chosen focus still needs (SRD 1.2.2, 1.6.0). */
function FocusDetails(props: {
  label: string;
  choice: FocusChoice;
  prior: Skills;
  repeat: boolean;
  onChange: (choice: FocusChoice) => void;
}) {
  const { choice } = props;
  const focus = focusInfo(data, choice.id);
  if (!focus) return null;
  const level = focus.levels[props.repeat ? 1 : 0];
  const set = (patch: { skill?: string | undefined; attribute?: Attribute | undefined }) => {
    const next: FocusChoice = { id: choice.id };
    const skill = 'skill' in patch ? patch.skill : choice.skill;
    const attribute = 'attribute' in patch ? patch.attribute : choice.attribute;
    if (skill) next.skill = skill;
    if (attribute) next.attribute = attribute;
    props.onChange(next);
  };
  let skillSelect = null;
  if (focus.bonusSkill && !props.repeat) {
    const allowed = allowedSkills(data, focus.bonusSkill);
    const exhausted = allowed.every((s) => props.prior[s] === 1);
    const fixed = allowed.length === 1 && !exhausted;
    if (!fixed) {
      const ids = exhausted ? skills.map((s) => s.id).filter((s) => !allowed.includes(s)) : allowed;
      skillSelect = (
        <Select
          label={`${exhausted ? 'Replacement skill' : 'Bonus skill'} for ${props.label}`}
          value={choice.skill ?? ''}
          options={ids.map((id) => ({ value: id, label: skillName(id) }))}
          onChange={(v) => set({ skill: v === '' ? undefined : v })}
        />
      );
    }
  }
  return (
    <>
      {level && (
        <p class="hint">
          {props.repeat ? 'Level 2: ' : ''}
          {level.text}
        </p>
      )}
      {skillSelect}
      {focus.attributeChoice && (
        <Select
          label={`Attribute for ${props.label}`}
          value={choice.attribute ?? ''}
          options={ATTRIBUTES.map((a) => ({ value: a, label: ATTRIBUTE_NAMES[a] }))}
          onChange={(v) => set({ attribute: v === '' ? undefined : (v as Attribute) })}
        />
      )}
    </>
  );
}

/** Three racial foci, then the class's level-1 picks (docs/rules-adaptation.md, Foci). */
export function FociStep(props: {
  slots: readonly FocusSlot[];
  choices: readonly (FocusChoice | null)[];
  skillsBefore: readonly Skills[];
  fallbackSkills: Skills;
  status: StepStatus;
  ready: boolean;
  onChange: (choices: (FocusChoice | null)[]) => void;
}) {
  const labels = slotLabels(props.slots);
  const racial = new Set<string>();
  props.slots.forEach((slot, i) => {
    const id = slot.fixed ?? (slot.kind === 'racial' ? props.choices[i]?.id : undefined);
    if (id) racial.add(id);
  });
  const set = (i: number, choice: FocusChoice | null) => {
    const next = props.slots.map((_, j) => props.choices[j] ?? null);
    next[i] = choice;
    props.onChange(next);
  };
  return (
    <Step title="5. Foci" status={props.status}>
      {!props.ready && (
        <p class="hint">Choose a people, background, and class to see your focus picks.</p>
      )}
      {props.ready &&
        props.slots.map((slot, i) => {
          const label = labels[i] ?? '';
          const choice = props.choices[i] ?? (slot.fixed ? { id: slot.fixed } : null);
          const repeat =
            choice !== null &&
            props.slots.slice(0, i).some((_, j) => props.choices[j]?.id === choice.id);
          return (
            <div key={i} class="focus">
              {slot.fixed ? (
                <p>
                  <strong>{label}</strong> <span class="hint">(signature)</span>
                </p>
              ) : (
                <Select
                  label={label}
                  value={choice?.id ?? ''}
                  options={slotOptions(slot, slot.kind === 'racial' ? new Set() : racial)}
                  onChange={(v) => set(i, v === '' ? null : { id: v })}
                />
              )}
              {choice && (
                <FocusDetails
                  label={label}
                  choice={choice}
                  prior={props.skillsBefore[i] ?? props.fallbackSkills}
                  repeat={repeat}
                  onChange={(c) => set(i, c)}
                />
              )}
            </div>
          );
        })}
    </Step>
  );
}
