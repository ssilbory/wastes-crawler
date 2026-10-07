// Changing form outside a fight (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.15 The
// Skinshifter.md; docs/rules-adaptation.md, The Skinshifter): Change Form spends Effort for the
// day, or a minute and no Effort with Pliant Flesh; going back is free. A form lasts until changed.
import type { GameData } from '../character/context.ts';
import type { SheetMagic } from '../character/derived.ts';
import { memberSheet, note } from './members.ts';
import type { TownResult } from './services.ts';
import type { Member, World } from './types.ts';
import { wearForm } from './wear.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** Living, awake Skinshifters with forms to take. */
export const shifters = (w: World): Member[] =>
  w.members.filter(
    (m) =>
      !m.dead &&
      !m.reviving &&
      m.character.hp.current > 0 &&
      m.character.arts.includes('change-form') &&
      (m.character.forms ?? []).length > 0,
  );

export function shiftMember(
  w: World,
  data: GameData,
  memberId: string,
  form: number | null,
): TownResult {
  const m = shifters(w).find((x) => x.id === memberId);
  if (!m) return no('No one is able to change form.');
  const name = m.character.name;
  if (form === null) {
    if (m.form === null) return no(`${name} is in their own shape.`);
    wearForm(data, m, null);
    note(w, `${name} returns to their own shape.`);
    return { ok: true };
  }
  const shape = m.character.forms?.[form];
  if (!shape) return no(`${name} has no such form.`);
  if (m.form === form) return no(`${name} is already in the ${shape.name} form.`);
  // Pliant Flesh: a minute's change costs no Effort (1.5.15).
  if (!m.character.arts.includes('pliant-flesh')) {
    const effort = (memberSheet(data, m).magic as SheetMagic).effort;
    if (m.effortDay >= effort) return no(`${name} has no Effort left today.`);
    m.effortDay += 1;
  }
  wearForm(data, m, form);
  note(w, `${name} takes the ${shape.name} form.`);
  return { ok: true };
}
