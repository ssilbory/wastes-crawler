// The Seal of Command (docs/rules-adaptation.md, The ending in Phase 12d; Sam's call: the party
// chooses). Once the warlord is dead and the party holds the seal, it can destroy it, give it to
// the campaign's giver, or keep it, and the bound obey it from then on. Each choice ends with its
// epilogue.
import type { GameData } from '../character/context.ts';
import { note } from './members.ts';
import type { TownResult } from './services.ts';
import { toTenths } from '../../rules/economy.ts';
import type { World } from './types.ts';

export type SealChoice = 'destroy' | 'give' | 'keep';

const rules = (data: GameData) => data.content.campaign.seal;

/** Why the party can't decide the seal's fate here and now, or null. */
export function sealBlocked(w: World, data: GameData, town: string | undefined): string | null {
  const r = rules(data);
  if (w.ending) return 'The seal’s fate is decided.';
  if (w.quests[r.quest]?.status !== 'done') return 'The warlord still lives.';
  if (!w.authority.includes(r.authority)) return 'The party does not hold the seal.';
  const giver = data.content.missionGivers.find((g) => g.id === r.giver);
  if (giver?.town !== town) return `Bring the seal to ${giver?.name ?? 'the giver'}.`;
  return null;
}

/** The epilogue for a decided seal, with the line on kept notes. */
export function epilogue(w: World, data: GameData): string | null {
  if (!w.ending) return null;
  const r = rules(data);
  const kept = Object.values(w.notes).filter((s) => s === 'kept' || s === 'paid').length;
  const notes =
    kept === 0 ? r.notesEpilogue.none : r.notesEpilogue.some.replace('{n}', String(kept));
  return `${r.epilogues[w.ending]} ${notes}`;
}

export function decideSeal(
  w: World,
  data: GameData,
  town: string | undefined,
  choice: SealChoice,
): TownResult {
  const blocked = sealBlocked(w, data, town);
  if (blocked) return { ok: false, reason: blocked };
  const r = rules(data);
  if (choice !== 'keep') w.authority = w.authority.filter((a) => a !== r.authority);
  if (choice === 'give') w.purse = toTenths(w.purse + r.give);
  if (choice === 'destroy')
    for (const m of w.members) {
      if (m.dead) m.pendingXp += r.destroyXp;
      else m.character = { ...m.character, xp: m.character.xp + r.destroyXp };
    }
  w.ending = choice;
  note(w, epilogue(w, data) as string);
  return { ok: true };
}
