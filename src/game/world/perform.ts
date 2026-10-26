// Perform (docs/rules-adaptation.md, Skills): once a night one member plays the inn's common room.
// A good show pays the party's lodging, and a great one earns tips besides; a poor one leaves the
// inn wanting its usual price.
import { roll } from '../../rules/dice.ts';
import { toTenths } from '../../rules/economy.ts';
import type { GameData } from '../character/context.ts';
import { awake, memberCheck, note } from './members.ts';
import { restAtInn, type TownResult } from './services.ts';
import type { World } from './types.ts';
import { townHere } from './town-prices.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** Whether someone has already played the common room tonight. */
export const playedTonight = (w: World) => w.performedDay === w.day;

export function playForLodging(w: World, data: GameData, memberId: string): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const town = townHere(w, data);
  if (playedTonight(w)) return no('The common room has had its show tonight.');
  const m = w.members.find((x) => x.id === memberId && awake(x));
  if (!m) return no('Choose someone to play.');
  const rules = data.content.skillRules.perform;
  const difficulty = rules.difficulty[town.size];
  const check = memberCheck(w, data, m, 'perform', rules.attributes, difficulty);
  w.performedDay = w.day;
  const name = m.character.name;
  if (!check.success) {
    note(w, `${name} plays to a cold room. The inn still wants paying.`);
    return { ok: true };
  }
  const tips =
    check.score - difficulty >= rules.tipMargin ? roll(w.rng, rules.tips[town.size]).total : 0;
  note(w, `${name} plays the common room, and the inn gives the party its beds for the night.`);
  if (tips > 0) {
    w.purse = toTenths(w.purse + tips);
    note(w, `The crowd throws ${tips} crowns in tips.`);
  }
  restAtInn(w, data);
  return { ok: true };
}
