// The Burrower Below in a dungeon (vendor/wwn-srd/4.0 Magic and Spellcasting/4.5.0 Elementalist
// Spells.md; Sam's call, docs/rules-adaptation.md, The Burrower Below): the caster carves a passage
// through the wall the party faces into the cell beyond. It takes a turn and one of the day's
// spells, and the passage stays open for the rest of the visit.
import { ahead } from '../../rules/grid.ts';
import type { GameData } from '../character/context.ts';
import { cannotCast } from '../world/casting.ts';
import { alive, note } from '../world/members.ts';
import type { TownResult } from '../world/services.ts';
import type { Member, World } from '../world/types.ts';
import { levelOf } from './explore.ts';
import { edgeKey, knownEdges } from './secrets.ts';
import { passTurn } from './time.ts';

export const BURROWER = 'the-burrower-below';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** Living members with The Burrower Below prepared. */
export const burrowers = (w: World): Member[] =>
  alive(w).filter((m) => m.character.spells.prepared.includes(BURROWER));

/** Carves a passage through the wall ahead of the party. */
export function burrow(w: World, data: GameData, memberId: string): TownResult {
  const s = w.dungeon;
  if (!s) throw new Error('the party is not in a dungeon');
  if (w.encounter) return no('Settle the encounter first.');
  const m = w.members.find((x) => x.id === memberId);
  const why = cannotCast(data, m, BURROWER);
  if (why) return no(why);
  const edge = knownEdges(w, data)(s.at, s.facing);
  if (edge === 'open' || edge === 'door') return no('There is no wall ahead to dig through.');
  // The outer wall of a level has nothing beyond it to dig into.
  if (!levelOf(data, s.dungeon, s.level).map.inBounds(ahead(s.at, s.facing)))
    return no('Only solid rock lies beyond.');
  (m as Member).spellsCast += 1;
  s.dug[s.level] = [...(s.dug[s.level] ?? []), edgeKey(s.at, s.facing)];
  note(w, `${(m as Member).character.name} parts the stone, and a passage opens ahead.`);
  passTurn(w, data);
  return { ok: true };
}
