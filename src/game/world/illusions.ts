// High Magic that works on the minds of a group met (vendor/wwn-srd/4.0 Magic and Spellcasting/4.4.0
// High Magic Spells by Level.md; Sam's calls, docs/rules-adaptation.md, High Magic outside fights).
// The Inexorable Imputation takes the place of the encounter's one parley with people: unless their
// best saver makes a Mental save, their mood moves two bands friendlier, or the bound believe they
// may let the party pass. Phantasmal Mimesis lets the party slip away from a group that spotted it
// first, unless its best saver makes a Mental save; the mindless pay illusions no heed.
import type { PendingEncounter } from '../../data/schemas/index.ts';
import type { Reaction } from '../../rules/reaction.ts';
import { rollSave } from '../../rules/saves.ts';
import type { GameData } from '../character/context.ts';
import { cannotCast, spendCast } from './casting.ts';
import { fights, MOODS } from './encounters.ts';
import { note } from './members.ts';
import { mindOf } from './minds.ts';
import { monsterOf } from './npcs.ts';
import { BANDS, goodwill } from './parley.ts';
import { settleByLeaving } from './quarter.ts';
import type { TownResult } from './services.ts';
import type { Member, World } from './types.ts';

export const IMPUTATION = 'the-inexorable-imputation';
export const MIMESIS = 'phantasmal-mimesis';

const no = (reason: string): TownResult => ({ ok: false, reason });

function caster(w: World, data: GameData, memberId: string, spell: string): Member | string {
  const m = w.members.find((x) => x.id === memberId);
  return cannotCast(data, m, spell) ?? (m as Member);
}

/** The group's best saver tries a Mental save (a monster has one save target). */
function resists(w: World, data: GameData, e: PendingEncounter): boolean {
  const best = Math.min(...e.enemies.flat().map((id) => monsterOf(data, id).save));
  return rollSave(w.rng, best).success;
}

/** Why the Imputation can't be spoken to this group, or null if it can. */
export function cannotImpute(w: World, data: GameData): string | null {
  const e = w.encounter;
  if (!e) return 'There is no one here to tell.';
  if (e.quest) return 'Nothing they could hear would turn them from this fight.';
  if (e.parleyed) return 'They have heard enough.';
  if (!e.enemies.flat().every((id) => mindOf(data, id) === 'sapient'))
    return 'Only people can be made to believe.';
  return null;
}

/** The Inexorable Imputation: one sentence, believed. */
export function impute(w: World, data: GameData, memberId: string): TownResult {
  const why = cannotImpute(w, data);
  if (why) return no(why);
  // cannotImpute finds no fault only with a group met.
  const e = w.encounter as PendingEncounter;
  const m = caster(w, data, memberId, IMPUTATION);
  if (typeof m === 'string') return no(m);
  spendCast(data, m, IMPUTATION);
  e.parleyed = true;
  if (resists(w, data, e)) {
    note(w, `${m.character.name} speaks, but they aren't persuaded.`);
    return { ok: true };
  }
  if (e.order && !w.ordersEnded.includes(e.order)) {
    e.hostile = false;
    e.spotted = true;
    note(w, `${m.character.name} speaks, and the bound believe the party may pass.`);
    return { ok: true };
  }
  e.reaction = BANDS[Math.min(BANDS.length - 1, BANDS.indexOf(e.reaction) + 2)] as Reaction;
  e.hostile = fights(e.nature, e.reaction);
  note(w, `${m.character.name} speaks, and they believe every word. ${MOODS[e.reaction]}`);
  goodwill(w, data);
  return { ok: true };
}

/** Phantasmal Mimesis: an illusion holds the group's eyes while the party slips away. */
export function mimesis(w: World, data: GameData, memberId: string): TownResult {
  const e = w.encounter;
  if (!e) return no('There is no one here to fool.');
  if (!e.hostile || e.spotted) return no('The party can leave without magic.');
  if (e.enemies.flat().some((id) => mindOf(data, id) === 'mindless'))
    return no('The mindless pay illusions no heed.');
  const m = caster(w, data, memberId, MIMESIS);
  if (typeof m === 'string') return no(m);
  spendCast(data, m, MIMESIS);
  if (resists(w, data, e)) {
    note(w, `${m.character.name}'s illusion is seen for what it is.`);
    return { ok: true };
  }
  note(w, `${m.character.name}'s illusion draws their eyes away.`);
  e.spotted = true;
  settleByLeaving(w, data);
  return { ok: true };
}
