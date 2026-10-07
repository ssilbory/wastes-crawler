// Tremors of the Depths (vendor/wwn-srd/4.0 Magic and Spellcasting/4.5.0 Elementalist Spells.md;
// Sam's call, docs/rules-adaptation.md, Elementalist spells outside fights): cast at a bound
// garrison's post while the party still sees it from afar, the tremor brings the post down on its
// garrison. The post counts as beaten, with no loot and no XP, and its order holds elsewhere.
// Underground the tremor would bury the party too, so it is cast only above ground.
import type { GameData } from '../character/context.ts';
import { cannotCast } from './casting.ts';
import { note } from './members.ts';
import type { TownResult } from './services.ts';
import type { Member, World } from './types.ts';

export const TREMORS = 'tremors-of-the-depths';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** Why the tremor can't bring down what the party faces, or null if it can. */
export function cannotTopple(w: World): string | null {
  const e = w.encounter;
  if (!e) return 'There is nothing here to bring down.';
  if (w.dungeon) return 'Below ground, the tremors would bury the party too.';
  // Groves are held too, but they are no structure.
  if (!e.garrison || !e.order) return "Only a garrison's post can be brought down.";
  if (!e.spotted) return 'It is too late: the garrison is upon the party.';
  return null;
}

/** Tremors of the Depths on the garrison post ahead. */
export function topple(w: World, data: GameData, memberId: string): TownResult {
  const why = cannotTopple(w);
  if (why) return no(why);
  const m = w.members.find((x) => x.id === memberId);
  const bar = cannotCast(data, m, TREMORS);
  if (bar) return no(bar);
  const e = w.encounter as NonNullable<World['encounter']>;
  (m as Member).spellsCast += 1;
  w.beaten.push(e.garrison as string);
  w.encounter = null;
  note(
    w,
    `${(m as Member).character.name} calls a tremor up from the depths. For five long minutes the earth heaves, and the post comes down on its garrison.`,
  );
  return { ok: true };
}
