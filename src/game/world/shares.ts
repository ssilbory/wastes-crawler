// Hirelings' pay (Sam's call; docs/rules-adaptation.md, Hirelings): no daily wage. A hireling
// signs on for a flat fee and takes a share of the loot dice won while with the party (npcs.ts,
// accrueShares), paid when the party next comes into a town. Short of crowns, the party cashes in
// its loot; still short, the hireling takes everything there is and leaves. A dead hireling's
// share is owed to their kin: refusing it closes the town to hiring for a month.
import { toTenths } from '../../rules/economy.ts';
import type { GameData } from '../character/context.ts';
import type { WorldEvent } from './bus.ts';
import { note } from './members.ts';
import { hirelings, removeNpc } from './npcs.ts';
import type { TownResult } from './services.ts';
import { exchangeLoot } from './shop.ts';
import { townHere } from './town.ts';
import type { World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** Pays each hireling what they are owed on coming into a town. */
export function payShares(w: World, data: GameData): void {
  for (const n of hirelings(w)) {
    if (n.owed === 0) continue;
    if (w.purse < n.owed && w.loot.length > 0) {
      note(w, `The party cashes in its loot to pay ${n.name}.`);
      exchangeLoot(w, data);
    }
    if (w.purse >= n.owed) {
      w.purse = toTenths(w.purse - n.owed);
      note(w, `${n.name} takes their share: ${n.owed} crowns.`);
      n.owed = 0;
      continue;
    }
    note(w, `${n.name} is owed ${n.owed} crowns, takes the ${w.purse} there is, and leaves.`);
    w.purse = 0;
    removeNpc(w, n.id);
  }
}

/** Why the party can't hire here, or null. */
export function hireBlocked(w: World, data: GameData): string | null {
  const town = townHere(w, data);
  const [dead] = w.deadShares;
  if (dead) return `First settle ${dead.name}'s share with their kin.`;
  const until = w.hireBans[town.id];
  if (until !== undefined && until > w.day)
    return `No one in ${town.name} will sign on with the party until day ${until + 1}.`;
  return null;
}

/** Pays a dead hireling's share to their kin, in town. */
export function payDeadShare(w: World, data: GameData, index: number): TownResult {
  townHere(w, data);
  const dead = w.deadShares[index];
  if (!dead) return no('No such share is owed.');
  if (w.purse < dead.owed) return no(`The share is ${dead.owed} crowns; cash in loot first.`);
  w.purse = toTenths(w.purse - dead.owed);
  w.deadShares.splice(index, 1);
  note(w, `The party pays ${dead.name}'s kin their share: ${dead.owed} crowns.`);
  return { ok: true };
}

/** Refuses a dead hireling's share: this town won't hire for the party for a month. */
export function refuseDeadShare(w: World, data: GameData, index: number): TownResult {
  const town = townHere(w, data);
  const dead = w.deadShares[index];
  if (!dead) return no('No such share is owed.');
  w.deadShares.splice(index, 1);
  w.hireBans[town.id] = w.day + data.content.overlandRules.daysPerMonth;
  note(
    w,
    `The party won't pay ${dead.name}'s share. Word spreads: ${town.name} won't sign on with them for a month.`,
  );
  return { ok: true };
}

/** The shares' bus listener: a hireling who dies leaves their share owed to their kin. */
export function sharesListener(w: World, _data: GameData, e: WorldEvent): void {
  if (e.kind === 'npc-died' && e.npc.kind === 'hireling' && e.npc.owed > 0)
    w.deadShares.push({ name: e.npc.name, owed: e.npc.owed });
}
