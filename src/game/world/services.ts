// The inn, the healer, and the crypt, mortuary, or temple (docs/rules-adaptation.md, Towns in
// Phase 6a and Raising the dead). Inn: SRD 3.3.1's common lifestyle by the night. Healer: SRD
// 3.3.1 magical healing, which adds System Strain like any magical healing (vendor/wwn-srd/2.0
// The Rules of the Game/2.5.0, 2.5.2), and magical curing of a disease; curing Frailty and
// poison and raising the dead are house prices.
import type { MissionGiver } from '../../data/schemas/index.ts';
import { addStrain, fullRest } from '../../rules/strain.ts';
import type { GameData } from '../character/context.ts';
import { characterSheet } from '../character/derived.ts';
import { cure } from './ailments.ts';
import { endOfDay } from './day.ts';
import { alive, cureFrailty, note, setHp } from './members.ts';
import { FULL_RATIONS, priceHere, spend, townHere } from './town.ts';
import type { Member, World } from './types.ts';

export type TownResult = { ok: true } | { ok: false; reason: string };

const OK: TownResult = { ok: true };
const no = (reason: string): TownResult => ({ ok: false, reason });

function pay(w: World, data: GameData, listed: number): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  townHere(w, data);
  return spend(w, data, listed) ? OK : no(`That costs ${priceHere(w, data, listed)} crowns.`);
}

export const innListed = (w: World, data: GameData) =>
  alive(w).length * data.content.townRules.innPerPc;

/**
 * A night at the inn: everyone sleeps fed and sheltered until the next morning, then wakes with
 * strain and Broken cleared (the full rest in town) and the rations die restocked.
 */
export function stayAtInn(w: World, data: GameData): TownResult {
  const paid = pay(w, data, innListed(w, data));
  if (!paid.ok) return paid;
  restAtInn(w, data);
  return OK;
}

/** The night at the inn itself, however it was paid for. */
export function restAtInn(w: World, data: GameData): void {
  for (const m of alive(w)) m.slept = true;
  w.camp = 'made';
  w.noRecovery = false;
  endOfDay(w, data);
  for (const m of alive(w)) {
    const s = m.character.strain;
    const rested = fullRest({ strain: s.value, max: 0, broken: s.broken });
    m.character = { ...m.character, strain: { value: rested.strain, broken: rested.broken } };
  }
  w.rations = FULL_RATIONS;
  w.day += 1;
  w.quarter = 0;
  note(w, `The party stays the night at the inn in ${townHere(w, data).name}.`);
}

const levelOf = (data: GameData, m: Member) => characterSheet(m.character, data).level;
const rules = (data: GameData) => data.content.townRules.healer;

export const healListed = (data: GameData, m: Member) =>
  (m.character.hp.max - m.character.hp.current) * rules(data).perHp;
export const raiseListed = (data: GameData, m: Member) =>
  levelOf(data, m) * data.content.townRules.raisePerLevel;

/** The town's necromancer or death priest, if it has one; villages never do. */
export function raiserHere(w: World, data: GameData): MissionGiver | undefined {
  const town = townHere(w, data).id;
  return data.content.missionGivers.find((g) => g.town === town && g.raises);
}

function member(w: World, id: string): Member {
  const m = w.members.find((x) => x.id === id);
  if (!m) throw new Error(`no party member ${id}`);
  return m;
}

/** Heals a living member to full in one application, which adds 1 System Strain. */
export function healerHeal(w: World, data: GameData, id: string): TownResult {
  const m = member(w, id);
  const c = m.character;
  if (m.dead) return no(`${c.name} is dead.`);
  if (c.hp.current >= c.hp.max) return no(`${c.name} is unhurt.`);
  const max = characterSheet(c, data).strainMax;
  const outcome = addStrain({ strain: c.strain.value, max, broken: c.strain.broken }, 1, 'healing');
  if (outcome.kind !== 'applied') return no(`${c.name} can't bear more magical healing.`);
  const paid = pay(w, data, healListed(data, m));
  if (!paid.ok) return paid;
  m.character = {
    ...c,
    strain: { value: outcome.state.strain, broken: outcome.state.broken },
  };
  setHp(m, c.hp.max);
  note(w, `The healer heals ${c.name}.`);
  return OK;
}

export function cureFrail(w: World, data: GameData, id: string): TownResult {
  const m = member(w, id);
  if (m.dead || !m.frail) return no(`${m.character.name} isn't Frail.`);
  const paid = pay(w, data, rules(data).cureFrail);
  if (!paid.ok) return paid;
  cureFrailty(m);
  note(w, `The healer cures ${m.character.name}'s Frailty.`);
  return OK;
}

/**
 * The healer neutralizes a lingering poison (Sam's price) or cures a disease (SRD 3.3.1, magical
 * curing of a disease, 500 sp).
 */
export function cureSickness(
  w: World,
  data: GameData,
  id: string,
  s: 'poison' | 'disease',
): TownResult {
  const m = member(w, id);
  const name = m.character.name;
  if (s === 'poison' && (m.dead || !m.poisoned)) return no(`${name} isn't Poisoned.`);
  if (s === 'disease' && (m.dead || !m.disease)) return no(`${name} isn't sick.`);
  const healer = rules(data);
  const paid = pay(w, data, s === 'poison' ? healer.curePoison : healer.cureDisease);
  if (!paid.ok) return paid;
  cure(m, s);
  note(w, `The healer cures ${name} of ${s === 'poison' ? 'the poison' : 'the disease'}.`);
  return OK;
}

/** The raised wake with 1 HP and no strain, and receive the XP they earned while dead. */
export function raiseDead(w: World, data: GameData, id: string): TownResult {
  const m = member(w, id);
  if (!m.dead) return no(`${m.character.name} isn't dead.`);
  const raiser = raiserHere(w, data);
  if (!raiser) return no(`No one in ${townHere(w, data).name} raises the dead.`);
  const paid = pay(w, data, raiseListed(data, m));
  if (!paid.ok) return paid;
  revive(m);
  note(w, `${raiser.name} raises ${m.character.name}.`);
  return OK;
}

/** Brings a dead member back: 1 HP, no strain, and the XP they earned while dead. */
export function revive(m: Member): void {
  Object.assign(m, { dead: false, hungry: false, sleepless: false, cold: false });
  cureFrailty(m);
  m.character = {
    ...m.character,
    xp: m.character.xp + m.pendingXp,
    strain: { value: 0, broken: false },
  };
  m.pendingXp = 0;
  setHp(m, 1);
}
