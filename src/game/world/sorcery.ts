// High Magic cast outside fights (vendor/wwn-srd/4.0 Magic and Spellcasting/4.4.0 High Magic Spells
// by Level.md; Sam's calls, docs/rules-adaptation.md, High Magic in combat): The Excellent
// Transpicuous Transformation hides the party from a group that spotted it first, so it slips away
// as from one it spotted, and Conjunct
// the Vital Viscera moves hit points to a hurt member from the one with the most to spare.
import type { GameData } from '../character/context.ts';
import { cannotCast } from './casting.ts';
import { alive, note } from './members.ts';
import { settleByLeaving } from './quarter.ts';
import type { TownResult } from './services.ts';
import type { Member, World } from './types.ts';

export const VANISH = 'the-excellent-transpicuous-transformation';
export const VISCERA = 'conjunct-the-vital-viscera';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** The caster, if they can cast the spell now; else why not. */
function caster(w: World, data: GameData, memberId: string, spell: string): Member | string {
  const m = w.members.find((x) => x.id === memberId);
  return cannotCast(data, m, spell) ?? (m as Member);
}

/** The Excellent Transpicuous Transformation: the party turns transparent and slips away. */
export function vanish(w: World, data: GameData, memberId: string): TownResult {
  const e = w.encounter;
  if (!e) return no('There is no one to slip away from.');
  if (!e.hostile || e.spotted) return no('The party can leave without magic.');
  const m = caster(w, data, memberId, VANISH);
  if (typeof m === 'string') return no(m);
  m.spellsCast += 1;
  note(w, `${m.character.name} turns the party clear as glass.`);
  // Unseen now, the party slips away as from a group it spotted first, and takes as long.
  e.spotted = true;
  settleByLeaving(w, data);
  return { ok: true };
}

/** Hit points a member can give and stay at half their maximum or more. */
const spare = (m: Member) =>
  Math.max(0, m.character.hp.current - Math.ceil(m.character.hp.max / 2));

/** Members Conjunct the Vital Viscera can mend: hurt, with someone else to give. */
export function infusable(w: World): Member[] {
  return alive(w).filter(
    (m) =>
      m.character.hp.current < m.character.hp.max && alive(w).some((d) => d !== m && spare(d) > 0),
  );
}

/** Conjunct the Vital Viscera: hit points flow to the target from the member with most to spare. */
export function infuse(w: World, data: GameData, casterId: string, targetId: string): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const target = infusable(w).find((m) => m.id === targetId);
  if (!target) return no('No one can give that member hit points.');
  const m = caster(w, data, casterId, VISCERA);
  if (typeof m === 'string') return no(m);
  const donor = alive(w)
    .filter((d) => d !== target)
    .reduce((best, d) => (spare(d) > spare(best) ? d : best));
  const hp = target.character.hp;
  const amount = Math.min(spare(donor), hp.max - hp.current);
  m.spellsCast += 1;
  donor.character = {
    ...donor.character,
    hp: { ...donor.character.hp, current: donor.character.hp.current - amount },
  };
  target.character = { ...target.character, hp: { ...hp, current: hp.current + amount } };
  note(w, `${amount} hit points flow from ${donor.character.name} into ${target.character.name}.`);
  return { ok: true };
}
