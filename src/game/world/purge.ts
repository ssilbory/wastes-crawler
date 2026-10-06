// The Healer's Purge Ailment, reworked to lift Frailty (vendor/wwn-srd/1.0 Character Creation/
// 1.5.0 Class List/1.5.9 The Healer.md; Sam's call in docs/rules-adaptation.md, Purge Ailment):
// out of combat, Effort for the day and a Wis/Heal or Int/Heal check (Int for the SRD's Cha) lift
// one ally's Frailty. The game has no lasting poisons or diseases for the SRD's version to cure.
import type { GameData } from '../character/context.ts';
import { cannotUseArt } from './healer.ts';
import { alive, memberCheck, note } from './members.ts';
import type { TownResult } from './services.ts';
import type { Member, World } from './types.ts';

export const PURGE = 'purge-ailment';

const ART = { id: PURGE, name: 'Purge Ailment', unable: 'No one is able to purge an ailment.' };

/** The Frail allies a Healer could tend: living members other than the Healer. */
export const frailAllies = (w: World, healerId: string): Member[] =>
  alive(w).filter((m) => m.frail && m.id !== healerId);

/** Purge Ailment on a Frail ally; the Effort is spent whether or not the check succeeds. */
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
  if (!target) return { ok: false, reason: 'Choose an ally who is Frail.' };
  h.effortDay += 1;
  const rules = data.content.skillRules.purgeAilment;
  const name = h.character.name;
  if (!memberCheck(w, data, h, 'heal', rules.attributes, rules.difficulty).success) {
    note(w, `${name} tends ${target.character.name}, but the Frailty holds.`);
    return { ok: true };
  }
  target.frail = false;
  note(w, `${name} purges ${target.character.name}'s Frailty.`);
  return { ok: true };
}
