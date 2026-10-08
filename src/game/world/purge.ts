// The Healer's Purge Ailment, reworked to lift Frailty (vendor/wwn-srd/1.0 Character Creation/
// 1.5.0 Class List/1.5.9 The Healer.md; Sam's call in docs/rules-adaptation.md, Purge Ailment):
// out of combat, Effort for the day and a Wis/Heal or Int/Heal check (Int for the SRD's Cha) lift
// one ally's Frailty. Like the physician's single attempt (SRD 2.5.1), each Healer gets one try at
// each Frailty, and the ally takes 1 System Strain as for magical healing (SRD 2.5.2). The game has
// no lasting poisons or diseases for the SRD's version to cure.
import { addStrain } from '../../rules/strain.ts';
import type { GameData } from '../character/context.ts';
import { characterSheet } from '../character/derived.ts';
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
