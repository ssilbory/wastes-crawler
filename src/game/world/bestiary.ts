// Know (docs/rules-adaptation.md, Skills): when the party meets a group, its best scholar with Know
// tries to name each kind of monster the party hasn't named before, Int/Know against a difficulty
// that grows with the monster's hit dice. A named monster's statistics stay known.
import type { Monster } from '../../data/schemas/index.ts';
import { findMonster, type GameData } from '../character/context.ts';
import { awake, bestAt, memberCheck } from './members.ts';
import type { World } from './types.ts';

/** Tries to name each new kind of monster in the rows; returns what the scholar recognizes, or ''. */
export function identify(w: World, data: GameData, rows: readonly (readonly string[])[]): string {
  const rules = data.content.skillRules.know;
  const scholars = w.members.filter((m) => awake(m) && m.character.skills.know !== undefined);
  const scholar = bestAt(data, scholars, 'know', rules.attributes);
  if (!scholar) return '';
  const named: string[] = [];
  for (const id of new Set(rows.flat())) {
    if (w.bestiary.includes(id)) continue;
    const monster = findMonster(data, id) as Monster;
    const difficulty = rules.difficulty + Math.floor(monster.hitDice / rules.hitDicePerStep);
    if (!memberCheck(w, data, scholar, 'know', rules.attributes, difficulty).success) continue;
    w.bestiary.push(id);
    named.push(monster.name);
  }
  return named.length > 0 ? `${scholar.character.name} knows the ${named.join(' and the ')}.` : '';
}
