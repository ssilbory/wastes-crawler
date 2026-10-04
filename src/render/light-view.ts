// Read-only text for the party's light and exploration time underground.
import { carried, spareTorches } from '../game/dungeon/light.ts';
import type { World } from '../game/world/types.ts';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What is burning and what is left, such as "Torch (d6); 11 torches spare". */
export function lightText(w: World): string {
  const l = w.light;
  const burning =
    l.lit === 'lantern'
      ? `Lantern (d${l.lantern})`
      : l.lit === 'torch'
        ? `Torch (d${l.torch})`
        : 'No light';
  const left = [plural(spareTorches(w), 'torch', 'torches') + ' spare'];
  const oil = carried(w, 'oil-one-pint');
  if (carried(w, 'lantern') > 0) left.push(plural(oil, 'pint of oil', 'pints of oil'));
  return `${burning}; ${left.join(', ')}`;
}

/** The exploration turn, such as "Turn 3, step 5 of 12". */
export function turnText(w: World): string {
  const s = w.dungeon;
  return s ? `Turn ${s.turn + 1}, step ${s.steps + 1} of 12` : '';
}
