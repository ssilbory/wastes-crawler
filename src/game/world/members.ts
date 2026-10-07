// Party members on the overland map: checks, strain, damage, and full recovery. Strain follows
// vendor/wwn-srd/2.0 The Rules of the Game/2.5.0 (2.5.2) and the System Strain outcomes in
// docs/rules-adaptation.md.
import { wearForm } from './wear.ts';
import type { Attribute, Character, DefaultPreset } from '../../data/schemas/index.ts';
import { skillCheck, type CheckResult } from '../../rules/checks.ts';
import { addStrain, type StrainSource } from '../../rules/strain.ts';
import type { GameData } from '../character/context.ts';
import { characterSheet } from '../character/derived.ts';
import { quarterName } from './calendar.ts';
import type { Member, World } from './types.ts';

export function note(w: World, text: string): void {
  w.log.push(`Day ${w.day + 1}, ${quarterName(w.quarter)}: ${text}`);
}

export const alive = (w: World) => w.members.filter((m) => !m.dead);

/** Living, conscious, and not asleep after a Healer's revive. */
export const awake = (m: Member) => !m.dead && !m.reviving && m.character.hp.current > 0;

/** The member's sheet in the form they wear now (1.5.15). */
export const memberSheet = (data: GameData, m: Member) => characterSheet(m.character, data, m.form);

/** Eyes of the Hawk: +2 on Notice checks in a form that has it (1.5.15). */
const keen = (m: Member, skill: string) =>
  skill === 'notice' &&
  m.form !== null &&
  m.character.forms?.[m.form]?.arts.includes('eyes-of-the-hawk')
    ? 2
    : 0;

/** A member's best attribute modifier among `attrs` plus their skill (−1 untrained). */
export function checkBonus(data: GameData, m: Member, skill: string, attrs: Attribute[]): number {
  const mods = memberSheet(data, m).modifiers;
  return (
    (m.character.skills[skill] ?? -1) + Math.max(...attrs.map((a) => mods[a])) + keen(m, skill)
  );
}

/** The member best at a skill check, first in party order on ties. */
export function bestAt(
  data: GameData,
  members: readonly Member[],
  skill: string,
  attrs: Attribute[],
): Member | undefined {
  let best: Member | undefined;
  for (const m of members)
    if (!best || checkBonus(data, m, skill, attrs) > checkBonus(data, best, skill, attrs)) best = m;
  return best;
}

export function memberCheck(
  w: World,
  data: GameData,
  m: Member,
  skill: string,
  attrs: Attribute[],
  difficulty: number,
  steps = 0,
): CheckResult {
  const mods = memberSheet(data, m).modifiers;
  return skillCheck(w.rng, {
    skill: m.character.skills[skill] ?? null,
    attributeModifier: Math.max(...attrs.map((a) => mods[a])) + keen(m, skill),
    difficulty,
    steps: m.character.strain.broken ? steps - 1 : steps,
  });
}

export function addMemberStrain(
  w: World,
  data: GameData,
  m: Member,
  amount: number,
  source: StrainSource,
): void {
  const c = m.character;
  const state = {
    strain: c.strain.value,
    max: memberSheet(data, m).strainMax,
    broken: c.strain.broken,
  };
  const outcome = addStrain(state, amount, source);
  m.character = { ...c, strain: { value: outcome.state.strain, broken: outcome.state.broken } };
  if (outcome.kind === 'dead') {
    wearForm(data, m, null);
    m.dead = true;
    note(w, `${c.name} dies of exhaustion and privation.`);
  } else if (outcome.state.broken && !c.strain.broken) note(w, `${c.name} is Broken.`);
}

/**
 * A quarter of rest: limited arts come back (Sam's call, Phase 15), and strain recovers by 1, or
 * `extra` more with Refined Restoration's care; none while Hungry, Sleepless, or Cold.
 */
export function restQuarter(m: Member, extra = 0): void {
  m.artUses = {};
  if (m.hungry || m.sleepless || m.cold) return;
  const s = m.character.strain;
  m.character = { ...m.character, strain: { ...s, value: Math.max(0, s.value - 1 - extra) } };
}

export function setHp(m: Member, hp: number): void {
  m.character = { ...m.character, hp: { ...m.character.hp, current: hp } };
}

/** Travel and camp mishaps hurt but don't knock anyone out: they leave at least 1 HP. */
export function hurt(w: World, m: Member, amount: number): void {
  setHp(m, Math.max(1, m.character.hp.current - amount));
  note(w, `${m.character.name} takes ${amount} damage.`);
}

/**
 * Natural healing (SRD 2.5.3): HP equal to the character's level each morning, plus `extra` from a
 * physician's care (Sam's call).
 */
export function healNight(data: GameData, m: Member, extra = 0): void {
  if (m.frail) return;
  const { level } = memberSheet(data, m);
  setHp(m, Math.min(m.character.hp.max, m.character.hp.current + level + extra));
}

/** A new party member; their crowns go into the purse (docs/rules-adaptation.md, Towns). */
export function newMember(
  id: string,
  r: { character: Character; row: number; column: number; defaultAction: DefaultPreset },
): Member {
  return {
    id,
    character: { ...r.character, crowns: 0 },
    row: r.row,
    column: r.column,
    defaultAction: r.defaultAction,
    dead: false,
    frail: false,
    hungry: false,
    sleepless: false,
    cold: false,
    slept: false,
    spellsCast: 0,
    pointsSpent: 0,
    form: null,
    effortDay: 0,
    pendingXp: 0,
    reviving: false,
    artUses: {},
    prayedDay: null,
  };
}
