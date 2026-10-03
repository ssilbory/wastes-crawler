import { readFileSync } from 'node:fs';
import { loadContent } from '../../../src/data/content.ts';
import { loadSrd } from '../../../src/data/load.ts';
import type { Character } from '../../../src/data/schemas/index.ts';
import type { GameData } from '../../../src/game/character/context.ts';
import { importCharacter } from '../../../src/game/character/io.ts';
import { createBattle } from '../../../src/game/combat/battle.ts';
import type { Battle, Combatant } from '../../../src/game/combat/types.ts';
import { createRng, type Rng } from '../../../src/rules/rng.ts';

export const data: GameData = { srd: loadSrd(), content: loadContent() };

/** One of the sample characters in tools/sim/parties/starter/. */
export function starter(file: 'snag' | 'grukk' | 'lirael' | 'fizzwick'): Character {
  const r = importCharacter(readFileSync(`tools/sim/parties/starter/${file}.json`, 'utf8'), data);
  if (!r.ok) throw new Error(r.errors.join('; '));
  return r.character;
}

/** Snag and Grukk in front, Lirael and Fizzwick behind them, against the given enemy rows. */
export function standardBattle(
  enemies: string[][],
  rng: Rng = createRng('test'),
  log = true,
): Battle {
  return createBattle({
    data,
    rng,
    party: [
      { character: starter('snag'), row: 0, column: 0 },
      { character: starter('grukk'), row: 0, column: 1 },
      { character: starter('lirael'), row: 1, column: 0 },
      { character: starter('fizzwick'), row: 1, column: 1 },
    ],
    enemies,
    log,
  });
}

export function who(b: Battle, nameOrId: string): Combatant {
  const c = b.combatants.find((x) => x.id === nameOrId || x.name === nameOrId);
  if (!c) throw new Error(`no combatant ${nameOrId}`);
  return c;
}
