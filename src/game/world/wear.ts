// Wearing a Skinshifter's form (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.15 The
// Skinshifter.md): the form and Feral Prowess's hit points go on and come off together.
import type { GameData } from '../character/context.ts';
import { shiftCharacter } from '../character/shift.ts';
import type { Member } from './types.ts';

/** Puts the member in a form, or back in their own shape (null). */
export function wearForm(data: GameData, m: Member, form: number | null): void {
  m.character = shiftCharacter(data, m.character, m.form, form);
  m.form = form;
}
