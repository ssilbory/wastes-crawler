// The Hardcore window's options (docs/rules-adaptation.md, Hardcore options): each one's name,
// what it does, and whether it is on.
import type { HardcoreOption } from '../data/schemas/index.ts';
import { HARDCORE_NAMES } from '../game/world/hardcore.ts';
import type { World } from '../game/world/types.ts';

const TEXT: Record<HardcoreOption, string> = {
  noStrainCasting: 'No casting a spell without a slot by taking System Strain.',
  deathAtZero:
    'A PC brought to zero hit points dies instead of lying Mortally Wounded. Die Hard, Vital Furnace, Unliving Persistence, Abnegation of Life, and the Invincible Citadel still save them.',
  noCraftingXp: 'Days of crafting, brewing, scribing, enchanting, and forging earn no XP.',
  noQuestXp: 'Quests pay their crowns and loot, but no XP.',
  harshHealing:
    'Healing Touch and Merciful Healing add 1 more System Strain when they revive the downed. Purge Ailment adds 1 System Strain for a poison or disease. After a fight, each ally can be healed by magic once.',
  healerStrain:
    'Healing Touch and Merciful Healing cost the healer 1 System Strain each use, as well as the patient. A healer who is Broken, or would pass their maximum, can’t heal.',
};

const ORDER: HardcoreOption[] = [
  'noStrainCasting',
  'deathAtZero',
  'noCraftingXp',
  'noQuestXp',
  'harshHealing',
  'healerStrain',
];

export interface HardcoreLine {
  option: HardcoreOption;
  name: string;
  text: string;
  on: boolean;
}

/** Every hardcore option, in the window's order. */
export const hardcoreView = (w: World): HardcoreLine[] =>
  ORDER.map((option) => ({
    option,
    name: HARDCORE_NAMES[option],
    text: TEXT[option],
    on: w.hardcore[option],
  }));
