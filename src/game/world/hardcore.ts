// Hardcore options outside fights (docs/rules-adaptation.md, Hardcore options; Sam's calls): the
// player switches each on or off at any time, and the journal records the change. The fight's
// share is in combat/hardcore.ts.
import type { HardcoreOption } from '../../data/schemas/index.ts';
import { note } from './members.ts';
import type { World } from './types.ts';

/** Each option's name, as the journal and the Hardcore window give it. */
export const HARDCORE_NAMES: Record<HardcoreOption, string> = {
  noStrainCasting: 'No strain casting',
  deathAtZero: 'Death at zero hit points',
  noCraftingXp: 'No crafting XP',
  noQuestXp: 'No quest XP',
  harshHealing: 'Harsh healing',
};

/** Switches a hardcore option on or off; a change is noted in the journal. */
export function setHardcore(w: World, option: HardcoreOption, on: boolean): void {
  if (w.hardcore[option] === on) return;
  w.hardcore = { ...w.hardcore, [option]: on };
  note(w, `Hardcore: ${HARDCORE_NAMES[option]} is now ${on ? 'on' : 'off'}.`);
}

/** The XP a day of crafting is worth: none with No crafting XP. */
export const craftingXpPerDay = (w: World, perDay: number): number =>
  w.hardcore.noCraftingXp ? 0 : perDay;

/** The XP a quest pays each PC: none with No quest XP. */
export const questXp = (w: World, xp: number): number => (w.hardcore.noQuestXp ? 0 : xp);

/** The System Strain Purge Ailment's cure of a poison or disease lays on the ally. */
export const purgeStrain = (w: World): number => (w.hardcore.harshHealing ? 1 : 0);
