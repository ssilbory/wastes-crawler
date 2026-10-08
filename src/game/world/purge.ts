// The Healer's Purge Ailment (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.9 The
// Healer.md; Sam's calls in docs/rules-adaptation.md, Purge Ailment): out of combat it cures an
// ally of a lingering poison or a disease, as the SRD has it. Sam's call adds lifting Frailty:
// Effort for the day and a Wis/Heal or Int/Heal check (Int for the SRD's Cha). Like the
// physician's single attempt (SRD 2.5.1), each Healer gets one try at each Frailty, and the ally
// takes 1 System Strain as for magical healing (SRD 2.5.2).
import { characterLevel } from '../../rules/progression.ts';
import { addStrain } from '../../rules/strain.ts';
import type { GameData } from '../character/context.ts';
import { characterSheet } from '../character/derived.ts';
import { findDisease } from './ailing.ts';
import { cure } from './ailments.ts';
import { cannotUseArt } from './healer.ts';
import { alive, cureFrailty, memberCheck, note } from './members.ts';
import type { TownResult } from './services.ts';
import type { Member, World } from './types.ts';

export const PURGE = 'purge-ailment';

const ART = { id: PURGE, name: 'Purge Ailment', unable: 'No one is able to purge an ailment.' };

/** The Frail allies a Healer could still tend: living members they haven't tried, not themselves. */
export const frailAllies = (w: World, healerId: string): Member[] =>
  alive(w).filter((m) => m.frail && m.id !== healerId && !m.purgeTries.includes(healerId));

/**
 * Purge Ailment on a Frail ally the Healer hasn't tried. The Effort, the try, and the ally's strain
 * are spent whether or not the check succeeds; an ally who can't bear the strain is refused.
 */
export function purgeFrailty(
  w: World,
  data: GameData,
  healerId: string,
  targetId: string,
): TownResult {
  if (w.encounter) return { ok: false, reason: 'Settle the encounter first.' };
  const healer = w.members.find((m) => m.id === healerId);
  const why = cannotUseArt(data, healer, ART);
  if (why) return { ok: false, reason: why };
  const h = healer as Member;
  const target = frailAllies(w, h.id).find((m) => m.id === targetId);
  if (!target) return { ok: false, reason: 'Choose a Frail ally you haven’t tried to purge.' };
  const c = target.character;
  const max = characterSheet(c, data).strainMax;
  const strain = addStrain({ strain: c.strain.value, max, broken: c.strain.broken }, 1, 'healing');
  if (strain.kind !== 'applied') return { ok: false, reason: `${c.name} can't bear more strain.` };
  h.effortDay += 1;
  target.purgeTries = [...target.purgeTries, h.id];
  target.character = { ...c, strain: { value: strain.state.strain, broken: strain.state.broken } };
  const rules = data.content.skillRules.purgeAilment;
  const name = h.character.name;
  if (!memberCheck(w, data, h, 'heal', rules.attributes, rules.difficulty).success) {
    note(w, `${name} tends ${c.name}, but the Frailty holds.`);
    return { ok: true };
  }
  cureFrailty(target);
  note(w, `${name} purges ${c.name}'s Frailty.`);
  return { ok: true };
}

export type Sickness = 'poison' | 'disease';

const has = (m: Member, s: Sickness) => (s === 'poison' ? m.poisoned : m.disease !== null);

/** The Poisoned or sick allies a Healer could tend: living members other than the Healer. */
export const sickAllies = (w: World, healerId: string, s: Sickness): Member[] =>
  alive(w).filter((m) => has(m, s) && m.id !== healerId);

/**
 * Purge Ailment as the SRD has it (1.5.9): Effort for the day cures an ally of a poison or a
 * disease; a disease with a purge difficulty needs a Wis/Heal or Int/Heal check against it first.
 * From 7th level it takes Effort for the scene, which a Healer with Effort left keeps.
 */
export function purgeSickness(
  w: World,
  data: GameData,
  healerId: string,
  targetId: string,
  s: Sickness,
): TownResult {
  if (w.encounter) return { ok: false, reason: 'Settle the encounter first.' };
  const healer = w.members.find((m) => m.id === healerId);
  const why = cannotUseArt(data, healer, ART);
  if (why) return { ok: false, reason: why };
  const h = healer as Member;
  const target = sickAllies(w, h.id, s).find((m) => m.id === targetId);
  if (!target)
    return { ok: false, reason: `Choose an ally who is ${s === 'poison' ? 'Poisoned' : 'sick'}.` };
  const rules = data.content.ailments;
  if (characterLevel(h.character.classes) < rules.purgeSceneLevel) h.effortDay += 1;
  const name = h.character.name;
  const patient = target.character.name;
  const disease = target.disease && findDisease(data, target.disease.id);
  const difficulty = s === 'disease' ? (disease?.purgeDifficulty ?? null) : null;
  const attrs = data.content.skillRules.purgeAilment.attributes;
  if (difficulty !== null && !memberCheck(w, data, h, 'heal', attrs, difficulty).success) {
    note(w, `${name} tends ${patient}, but the ${disease?.name} holds.`);
    return { ok: true };
  }
  cure(target, s);
  note(w, `${name} purges ${patient} of ${s === 'poison' ? 'the poison' : disease?.name}.`);
  return { ok: true };
}
