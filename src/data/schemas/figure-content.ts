import { z } from 'zod';

/**
 * How a combatant is drawn on the fight screen (docs/presentation-plan.md, V3): presentation only,
 * never read by the rules. Each name is an SVG figure in src/ui/arena/Figures.tsx.
 */
export const MonsterFigureSchema = z.enum([
  'commoner',
  'soldier',
  'brute',
  'caster',
  'giant',
  'walking-dead',
  'automaton',
  'beast',
  'great-beast',
  'grazer',
  'crawler',
  'serpent',
  'winged',
  'wyrm',
  'swarm',
  'ooze',
  'fungus',
  'tree',
  'spirit',
]);
export type MonsterFigure = z.infer<typeof MonsterFigureSchema>;

/** A people's build and the mark on its head; armor, weapon, and shield come from the sheet. */
export const PeopleLookSchema = z.strictObject({
  body: z.enum(['standard', 'small', 'centaur']),
  head: z.enum(['plain', 'ears', 'horns', 'tusks', 'beard']),
});
export type PeopleLook = z.infer<typeof PeopleLookSchema>;

/** The shape of a weapon in hand. */
export const HeldSchema = z.enum([
  'blade',
  'great',
  'dagger',
  'axe',
  'mace',
  'maul',
  'spear',
  'polearm',
  'staff',
  'bow',
  'gun',
  'fist',
]);
export type Held = z.infer<typeof HeldSchema>;
