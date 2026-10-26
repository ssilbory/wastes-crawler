// What the party knows of the Dark Lands' standing orders, raids (Phase 12b), and the endgame (Phase
// 12d), as text. Pure.
import type { GameData } from '../game/character/context.ts';
import { authorityFor, orderOf, pendingOrder } from '../game/world/orders.ts';
import { pendingNotes, setName } from '../game/world/notes.ts';
import { epilogue, sealBlocked } from '../game/world/seal.ts';
import type { World } from '../game/world/types.ts';
import { isRaided } from '../game/world/town-prices.ts';

const siteName = (data: GameData, id: string) =>
  data.content.regions.flatMap((r) => r.sites).find((s) => s.id === id)?.name ?? id;

/** One line for the ending, the clock, each threat, countersign, and token, in that order. */
export function settingNotes(w: World, data: GameData): string[] {
  const lines: string[] = [];
  const end = epilogue(w, data);
  if (end) lines.push(end);
  const { segments, perTier } = data.content.campaign.clock;
  if (w.clock > 0)
    lines.push(
      `The warlord's clock: ${w.clock} of ${segments}. Every ${perTier} segments, bolder patrols.`,
    );
  if (w.raid)
    lines.push(
      w.raid.fighting
        ? `Raiders are at the gates of ${siteName(data, w.raid.town)}.`
        : `Raiders will strike ${siteName(data, w.raid.town)} at the end of day ${w.raid.day}.`,
    );
  for (const [town, until] of Object.entries(w.raided))
    if (isRaided(w, town))
      lines.push(`${siteName(data, town)} was raided: prices are up until day ${until + 1}.`);
  for (const id of w.countersigns) {
    const o = orderOf(data, id);
    const ended = w.ordersEnded.includes(id) ? ' (ended)' : '';
    lines.push(`Countersign for ${o.name}: "${o.countersign}"${ended}`);
  }
  for (const id of w.authority) {
    const a = data.content.authorities.find((x) => x.id === id);
    if (a) lines.push(`Carrying ${a.name}.`);
  }
  return lines;
}

export interface OrderChoices {
  name: string;
  countersign: boolean;
  /** The token the party could show, if any. */
  authority: string | null;
  bluff: boolean;
}

/** What the party can do about the pending encounter's standing order, if it has one. */
export function orderChoices(w: World, data: GameData): OrderChoices | null {
  const o = pendingOrder(w, data);
  if (!o) return null;
  return {
    name: o.name,
    countersign: w.countersigns.includes(o.id),
    authority: authorityFor(w, data, o.id)?.name ?? null,
    bluff: !(w.encounter as NonNullable<World['encounter']>).parleyed,
  };
}

/** The raided surcharge, for the town bar. */
export function raidedText(w: World, town: string): string | null {
  return isRaided(w, town) ? 'Raided: prices up' : null;
}

/** Notes waiting for the party's decision, and whether an agent can buy them here. */
export function notesChoices(
  w: World,
  data: GameData,
  inTown: boolean,
): { id: string; name: string; canSell: boolean }[] {
  return pendingNotes(w).map((id) => ({ id, name: setName(data, id), canSell: inTown }));
}

/** Whether the seal's choice is open at this giver, in this town. */
export function sealOpen(w: World, data: GameData, giver: string, town: string): boolean {
  return data.content.campaign.seal.giver === giver && sealBlocked(w, data, town) === null;
}
