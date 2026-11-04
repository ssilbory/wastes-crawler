// Sieges (Phase 23a; docs/rules-adaptation.md, Sieges, Sam's calls): a faction's Attack on a
// settlement (vendor/wwn-srd/6.0 Factions/Faction Turn Actions.md, Attack) camps its assets on the
// hexes beside it instead of striking. The first assault comes a week later, or as soon as the
// party joins; then one each day (assault.ts) until the attackers' assets there, or the
// defenders' assets and base, are gone.
import type { Siege } from '../../data/schemas/index.ts';
import { hexKey, neighbors, type Hex } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import { note } from '../world/members.ts';
import { regionMap } from '../world/region.ts';
import { partyIn, settlementOf } from '../world/siege-state.ts';
import { currentLedger } from '../world/town-prices.ts';
import type { World } from '../world/types.ts';
import { workingAt } from '../world/working-effects.ts';
import { capture, reclaim, retaken } from './capture.ts';
import { factionOf, hasDamage, locationName, news, type HeldAsset } from './state.ts';

const rules = (data: GameData) => data.content.siegeRules;

/** The attacker's assets in the siege: those standing there that can attack. */
export function besiegers(w: World, data: GameData, s: Siege): HeldAsset[] {
  const f = w.factions[s.attacker];
  return f ? f.assets.filter((a) => a.at === s.town && hasDamage(data, a.asset)) : [];
}

/** The defender's assets there. */
export function holders(w: World, s: Siege): HeldAsset[] {
  return w.factions[s.defender]?.assets.filter((a) => a.at === s.town) ?? [];
}

/** Whether the defender's base there still stands. */
export const baseStands = (w: World, s: Siege) =>
  w.factions[s.defender]?.bases.some((b) => b.at === s.town) ?? false;

/** Whether the siege touches the party's ally, so the party hears of it at once. */
export const allied = (data: GameData, s: Siege) =>
  s.attacker === rules(data).ally || s.defender === rules(data).ally;

/** The hexes beside a settlement an army can camp on: on the map, passable, and no settlement. */
export function campHexes(data: GameData, town: string): Hex[] {
  const at = settlementOf(data, town);
  if (!at) return [];
  const map = regionMap(data, at.region);
  // Off the map, or on ground no army can stand on, costs nothing to enter: null.
  return neighbors(at.site).filter((h) => map.costOf(h) !== null && !map.siteAt(h));
}

/**
 * Keeps one camp per besieging asset: the fallen's camps are struck, and newcomers camp on the
 * first free hex beside the settlement, or share one once all are taken.
 */
export function pitchCamps(w: World, data: GameData, s: Siege): void {
  const assets = besiegers(w, data, s);
  s.camps = s.camps.filter((c) => assets.some((a) => a.uid === c.uid));
  const hexes = campHexes(data, s.town);
  for (const a of assets) {
    if (hexes.length === 0 || s.camps.some((c) => c.uid === a.uid)) continue;
    const taken = new Set(s.camps.map(hexKey));
    const h =
      hexes.find((x) => !taken.has(hexKey(x))) ?? (hexes[s.camps.length % hexes.length] as Hex);
    s.camps.push({ uid: a.uid, col: h.col, row: h.row });
  }
}

/** The siege the attacker holds on a settlement, if any. */
export const siegeOf = (w: World, town: string, attacker: string) =>
  w.sieges.find((s) => s.town === town && s.attacker === attacker);

/**
 * Begins a siege: the first assault a week off (longer with watch-lamps lit there; working
 * effects), or tonight with the party already inside, which joins it.
 */
export function beginSiege(
  w: World,
  data: GameData,
  attacker: string,
  town: string,
  defender: string,
): Siege {
  const at = settlementOf(data, town);
  if (!at) throw new Error(`no settlement ${town}`);
  const delay = Math.max(rules(data).firstAssault, workingAt(w, data, 'raid-warning', town));
  const here = partyIn(w, data, town);
  const ally = rules(data).ally;
  // A party inside is in a siege on or by the ally at once; a rivals' siege waits on its pick.
  const inside = here && (attacker === ally || defender === ally);
  const s: Siege = {
    town,
    attacker,
    defender,
    began: w.day,
    next: inside ? w.day : w.day + delay,
    camps: [],
    joined: inside,
    pass: false,
    stock: currentLedger(w, data, at.site).since,
    gate: null,
  };
  w.sieges.push(s);
  pitchCamps(w, data, s);
  const text = `${factionOf(data, attacker).name} lays siege to ${locationName(data, town)}, held by ${factionOf(data, defender).name}.`;
  if (allied(data, s))
    note(
      w,
      `${text} ${inside ? 'The assault comes tonight.' : `The first assault comes in ${delay} days.`}`,
    );
  else if (here) note(w, `${text} The party may take a side, or keep out of it.`);
  else news(w, text);
  return s;
}

/**
 * Ends a siege once a side is gone: lifted when no besieger is left, fallen when the defender has
 * nothing there. Lifting an ally's siege the party fought in pays Renown. Returns how it ended.
 */
export function settle(w: World, data: GameData, s: Siege): 'lifted' | 'fallen' | null {
  const end =
    besiegers(w, data, s).length === 0
      ? 'lifted'
      : holders(w, s).length === 0 && !baseStands(w, s)
        ? 'fallen'
        : null;
  if (!end) return null;
  w.sieges = w.sieges.filter((x) => x !== s);
  const town = locationName(data, s.town);
  if (end === 'fallen') {
    note(w, `${town} falls to ${factionOf(data, s.attacker).name}.`);
    // The ally's settlement is taken (Capture), or, the holder driven out, the ally returns.
    if (!capture(w, data, s.attacker, s.town) && reclaim(w, data, s.town) && s.joined)
      retaken(w, data, s.town);
    return end;
  }
  note(w, `The siege of ${town} is lifted.`);
  if (s.joined && s.defender === rules(data).ally) {
    w.renown += rules(data).renown;
    note(w, `${town} remembers who stood with it: ${rules(data).renown} Renown.`);
  }
  return end;
}
