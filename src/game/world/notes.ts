// Crafter's notes (docs/setting.md, Flesh-crafting; docs/rules-adaptation.md, Crafter's notes in
// Phase 12d; Sam's call). A set found in a dungeon waits for the party's decision: burn it anywhere
// (the clock falls back), sell it to a warlord's agent in any town (crowns, and the clock
// advances), or keep it (the giver pays a little on the party's next visit, and it counts toward
// the ending).
import type { GameData } from '../character/context.ts';
import type { WorldEvent } from './bus.ts';
import { moveClock } from './clock.ts';
import { alive, note } from './members.ts';
import type { TownResult } from './services.ts';
import { toTenths } from '../../rules/economy.ts';
import { regionMap } from './region.ts';
import type { World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });
const rules = (data: GameData) => data.content.campaign.notes;

export function setName(data: GameData, id: string): string {
  const s = rules(data).sets.find((x) => x.id === id);
  if (!s) throw new Error(`unknown notes ${id}`);
  return s.name;
}

/** Sets found and not yet decided. */
export const pendingNotes = (w: World) =>
  Object.entries(w.notes)
    .filter(([, st]) => st === 'found')
    .map(([id]) => id);

export function findNotes(w: World, data: GameData, set: string, text: string): void {
  if (w.notes[set]) return;
  w.notes[set] = 'found';
  note(w, `${text} The party takes ${setName(data, set)}.`);
}

function decide(w: World, set: string): TownResult | null {
  return w.notes[set] === 'found' ? null : no('The party has no such notes to decide on.');
}

export function burnNotes(w: World, data: GameData, set: string): TownResult {
  const blocked = decide(w, set);
  if (blocked) return blocked;
  w.notes[set] = 'burned';
  note(w, `The party burns ${setName(data, set)}.`);
  for (const m of alive(w).filter((x) => x.character.people === 'beastman'))
    note(w, `${m.character.name} watches them burn: no more beastmen from these, free or slave.`);
  moveClock(w, data, -1, 'The warlord will never have them.');
  return { ok: true };
}

const inTown = (w: World, data: GameData) =>
  !w.dungeon && regionMap(data, w.region).siteAt(w.position) !== undefined;

export function sellNotes(w: World, data: GameData, set: string): TownResult {
  const blocked = decide(w, set);
  if (blocked) return blocked;
  if (!inTown(w, data)) return no("A warlord's agent can only be found in a town.");
  w.notes[set] = 'sold';
  w.purse = toTenths(w.purse + rules(data).sell);
  note(w, `A warlord's agent pays ${rules(data).sell} crowns for ${setName(data, set)}.`);
  moveClock(w, data, 1, 'The notes reach the warlord.');
  return { ok: true };
}

export function keepNotes(w: World, data: GameData, set: string): TownResult {
  const blocked = decide(w, set);
  if (blocked) return blocked;
  w.notes[set] = 'kept';
  note(w, `The party keeps ${setName(data, set)}, to put in safe hands.`);
  return { ok: true };
}

/** The notes' bus listener: the giver pays for kept sets when the party comes to their town. */
export function notesListener(w: World, data: GameData, e: WorldEvent): void {
  if (e.kind !== 'town-entered') return;
  const r = rules(data);
  const giver = data.content.missionGivers.find((g) => g.id === r.giver);
  if (giver?.town !== e.town) return;
  for (const [set, st] of Object.entries(w.notes))
    if (st === 'kept') {
      w.notes[set] = 'paid';
      w.purse = toTenths(w.purse + r.keep);
      note(w, `${giver.name} locks ${setName(data, set)} away and pays ${r.keep} crowns.`);
    }
}
