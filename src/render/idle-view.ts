// The healing a party has the means for but no one needs just now, so its window can still be
// listed and say so (Sam's call: a class's powers are always in the menu). Pure.
import type { GameData } from '../game/character/context.ts';
import { REVIVE } from '../game/world/healer.ts';
import { awake } from '../game/world/members.ts';
import { PURGE } from '../game/world/purge.ts';
import { infusable, VISCERA } from '../game/world/sorcery.ts';
import type { World } from '../game/world/types.ts';
import { castersOf } from '../game/world/waygates.ts';
import { healerView } from './healer-view.ts';
import { purgeView } from './purge-view.ts';

export type IdleKind = 'revive' | 'purge' | 'conjunct';

const names = (list: string[]) =>
  list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;

const withArt = (w: World, art: string) =>
  w.members.filter((m) => awake(m) && m.character.arts.includes(art)).map((m) => m.character.name);

/**
 * The line a healing window shows while there is no one to tend, or null when the party has no
 * one with the power, an encounter is up, or the panel itself has something to offer.
 */
export function idleLine(w: World, data: GameData, kind: IdleKind): string | null {
  if (w.encounter) return null;
  if (kind === 'revive') {
    const who = withArt(w, REVIVE);
    if (who.length === 0 || healerView(w, data)) return null;
    return `${names(who)} can revive the slain where they fell, before the party moves on or rests. No one has fallen here.`;
  }
  if (kind === 'purge') {
    const who = withArt(w, PURGE);
    if (who.length === 0 || purgeView(w, data)) return null;
    return `${names(who)} can purge Frailty, poison, and disease. No one they can tend is ailing.`;
  }
  const who = castersOf(w, VISCERA).map((m) => m.character.name);
  if (who.length === 0 || infusable(w).length > 0) return null;
  return `${names(who)} can pass hit points from a hale member to a hurt one. No one is hurt, or no one has any to spare.`;
}
