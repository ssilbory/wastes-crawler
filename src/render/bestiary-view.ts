// What the party knows of the monsters it has named with Know, and what a beast offering to follow
// would cost (docs/rules-adaptation.md, Skills).
import type { Dice, Monster } from '../data/schemas/index.ts';
import { findMonster, type GameData } from '../game/character/context.ts';
import type { World } from '../game/world/types.ts';
import { RESOURCE_DICE, stepDie } from '../rules/resource-die.ts';

export interface KnownFoe {
  id: string;
  name: string;
  stats: string;
}

const dice = (d: Dice) =>
  `${d.count}d${d.sides}${d.modifier > 0 ? `+${d.modifier}` : d.modifier < 0 ? d.modifier : ''}`;

/** "HD 2, AC 13, attack +2 for 1d6, Shock 1/13, move 30 ft, Morale 7, skill +1, save 14+". */
export function monsterStats(m: Monster): string {
  const damage = m.damage.kind === 'dice' ? dice(m.damage.dice) : `weapon +${m.damage.bonus}`;
  const shock =
    m.shock === null
      ? 'no Shock'
      : m.shock.kind === 'weapon'
        ? `Shock weapon +${m.shock.bonus}`
        : `Shock ${m.shock.damage}/${m.shock.maxAc ?? '-'}`;
  const attacks = m.attacks > 1 ? ` ×${m.attacks}` : '';
  return [
    `HD ${m.hitDice}`,
    `AC ${m.ac}${m.armored ? 'a' : ''}`,
    `attack +${m.attackBonus}${attacks} for ${damage}`,
    shock,
    `move ${m.move} ft`,
    `Morale ${m.morale}`,
    `skill +${m.skill}`,
    `save ${m.save}+`,
  ].join(', ');
}

/** The named monsters among these rows, once each. */
export function knownFoes(
  w: World,
  data: GameData,
  rows: readonly (readonly string[])[],
): KnownFoe[] {
  return [...new Set(rows.flat())]
    .filter((id) => w.bestiary.includes(id))
    .map((id) => {
      const m = findMonster(data, id) as Monster;
      return { id, name: m.name, stats: monsterStats(m) };
    });
}

const die = (n: number) => (n === 0 ? 'empty' : `d${n}`);

/** "Win the Herd Beast over (2 steps of rations: d8 to d4)", or why the rations fall short. */
export function beastOfferText(w: World, data: GameData): string | null {
  const id = w.encounter?.beast;
  if (!id) return null;
  const m = findMonster(data, id) as Monster;
  const steps = m.hitDice;
  if (RESOURCE_DICE.indexOf(w.rations) < steps)
    return `The ${m.name} wants ${steps} steps of rations; the rations are ${die(w.rations)}`;
  const after = stepDie(w.rations, -steps);
  const warning = after === 0 ? ', emptying the rations' : '';
  return `Win the ${m.name} over (${steps} steps of rations: ${die(w.rations)} to ${die(after)}${warning})`;
}
