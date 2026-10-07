// How an attack line reads on the character sheet. Pure.
import type { AttackLine } from '../game/character/equipment.ts';

export const signed = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);

/** "Spear, Light (melee) +2, 1d6+1, Shock 2/AC 15". */
export function attackText(a: AttackLine): string {
  const dice = `${a.damage.count}d${a.damage.sides}`;
  const bonus = a.damage.modifier + a.damageBonus;
  const shock = a.shock
    ? `, Shock ${a.shock.damage}/${a.shock.maxAc === null ? 'any AC' : `AC ${a.shock.maxAc}`}`
    : '';
  return `${a.name} (${a.mode}) ${signed(a.hit)}, ${dice}${bonus === 0 ? '' : signed(bonus)}${shock}`;
}
