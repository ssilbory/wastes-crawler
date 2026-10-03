// Party members on the overland map: checks, strain, damage, and full recovery. Strain follows
// vendor/wwn-srd/2.0 The Rules of the Game/2.5.0 (2.5.2) and the System Strain outcomes in
// docs/rules-adaptation.md.
import type { Attribute } from '../../data/schemas/index.ts';
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

const sheet = (data: GameData, m: Member) => characterSheet(m.character, data);

/** A member's best attribute modifier among `attrs` plus their skill (−1 untrained). */
export function checkBonus(data: GameData, m: Member, skill: string, attrs: Attribute[]): number {
  const mods = sheet(data, m).modifiers;
  return (m.character.skills[skill] ?? -1) + Math.max(...attrs.map((a) => mods[a]));
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
  const mods = sheet(data, m).modifiers;
  return skillCheck(w.rng, {
    skill: m.character.skills[skill] ?? null,
    attributeModifier: Math.max(...attrs.map((a) => mods[a])),
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
  const state = { strain: c.strain.value, max: sheet(data, m).strainMax, broken: c.strain.broken };
  const outcome = addStrain(state, amount, source);
  m.character = { ...c, strain: { value: outcome.state.strain, broken: outcome.state.broken } };
  if (outcome.kind === 'dead') {
    m.dead = true;
    note(w, `${c.name} dies of exhaustion and privation.`);
  } else if (outcome.state.broken && !c.strain.broken) note(w, `${c.name} is Broken.`);
}

/** Recovers strain for a quarter of rest; none while Hungry, Sleepless, or Cold. */
export function restQuarter(m: Member): void {
  if (m.hungry || m.sleepless || m.cold) return;
  const s = m.character.strain;
  m.character = { ...m.character, strain: { ...s, value: Math.max(0, s.value - 1) } };
}

export function setHp(m: Member, hp: number): void {
  m.character = { ...m.character, hp: { ...m.character.hp, current: hp } };
}

/** Travel and camp mishaps hurt but don't knock anyone out: they leave at least 1 HP. */
export function hurt(w: World, m: Member, amount: number): void {
  setHp(m, Math.max(1, m.character.hp.current - amount));
  note(w, `${m.character.name} takes ${amount} damage.`);
}

/** Natural healing (SRD 2.5.3): HP equal to the character's level each morning. */
export function healNight(data: GameData, m: Member): void {
  if (m.frail) return;
  const { level } = sheet(data, m);
  setHp(m, Math.min(m.character.hp.max, m.character.hp.current + level));
}

/** A full rest in town: everything restored, the dead raised (stand-in towns, Phase 5). */
export function restoreMember(m: Member): void {
  Object.assign(m, {
    dead: false,
    frail: false,
    hungry: false,
    sleepless: false,
    cold: false,
    spellsCast: 0,
    effortDay: 0,
  });
  m.character = {
    ...m.character,
    hp: { ...m.character.hp, current: m.character.hp.max },
    strain: { value: 0, broken: false },
  };
}
