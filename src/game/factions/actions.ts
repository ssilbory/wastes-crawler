// Faction actions (vendor/wwn-srd/6.0 Factions/Faction Turn Actions.md): Attack with every asset
// that can, Repair, Create Asset at a Base of Influence, and Move Asset. Every location in the
// Dark Lands lies within one turn's move of every other (Asset Locations and Movement.md: about a
// hundred miles a month), and no faction forbids another's assets entry (docs/rules-adaptation.md,
// Factions).
import type { FactionState } from '../../data/schemas/index.ts';
import { assetRepair, factionMaxHp, factionRepair } from '../../rules/factions.ts';
import type { GameData } from '../character/context.ts';
import type { World } from '../world/types.ts';
import { defenderAt, strike, type StrikeResult } from './combat.ts';
import {
  addAsset,
  assetName,
  factionOf,
  hasDamage,
  heldOf,
  isActive,
  locationName,
  magicAllows,
  news,
  ratings,
  srdAsset,
} from './state.ts';

/** Called after each strike, for goals and the clock. */
export type OnStrike = (victim: string, at: string, result: StrikeResult) => void;

/** The rival that answers an attack here: the goal's target first, then the rivals in order. */
export function victimAt(w: World, data: GameData, id: string, at: string): string | null {
  const s = w.factions[id] as FactionState;
  const order = [s.goal?.target?.faction, ...factionOf(data, id).enemies];
  for (const e of order) {
    const v = e === undefined ? undefined : w.factions[e];
    if (isActive(v) && defenderAt(v, at)) return e as string;
  }
  return null;
}

/** Assets that could attack a rival where they stand now. */
export function readyAttackers(w: World, data: GameData, id: string) {
  const s = w.factions[id] as FactionState;
  return s.assets.filter((a) => hasDamage(data, a.asset) && victimAt(w, data, id, a.at));
}

/** Attack: every ready asset strikes once, except any held back at `holdAt` for a raid. */
export function attackAction(
  w: World,
  data: GameData,
  id: string,
  onStrike: OnStrike,
  holdAt: string | null = null,
): void {
  const stolen = new Set<string>();
  for (const held of readyAttackers(w, data, id).filter((a) => a.at !== holdAt)) {
    // An earlier strike may have razed or destroyed everything here.
    const victim = victimAt(w, data, id, held.at);
    if (!victim) continue;
    news(
      w,
      `${factionOf(data, id).name}'s ${assetName(data, id, held.asset)} strikes at ${factionOf(data, victim).name} in ${locationName(data, held.at)}.`,
    );
    onStrike(victim, held.at, strike(w, data, id, held, victim, stolen));
  }
}

/** Whether the faction or any of its assets is hurt. */
export function isHurt(data: GameData, s: FactionState): boolean {
  return s.hp < factionMaxHp(ratings(s)) || s.assets.some((a) => a.hp < srdAsset(data, a.asset).hp);
}

/** Repair: one fix for the faction, then one for each hurt asset, a Treasure each while it lasts. */
export function repairAction(data: GameData, s: FactionState): void {
  const max = factionMaxHp(ratings(s));
  if (s.hp < max && s.treasure > 0) {
    s.treasure -= 1;
    s.hp = Math.min(max, s.hp + factionRepair(ratings(s)));
  }
  for (const a of s.assets) {
    const asset = srdAsset(data, a.asset);
    if (a.hp >= asset.hp || s.treasure === 0) continue;
    s.treasure -= 1;
    a.hp = Math.min(asset.hp, a.hp + assetRepair(s[asset.attribute]));
  }
}

/** The price after Populist (Faction Tags.md): one less for assets of 5 or less, at least 1. */
export function assetCost(data: GameData, id: string, asset: string): number {
  const cost = srdAsset(data, asset).cost;
  return factionOf(data, id).tags.includes('populist') && cost <= 5 ? Math.max(1, cost - 1) : cost;
}

/**
 * Create Asset: the dearest asset the faction can afford, rate, and hold another of, at its HQ or
 * else its first base (a faction keeping the peace uses its least-held base); one that can attack
 * first when `fighters` is set. Returns whether it bought.
 */
export function createAction(w: World, data: GameData, id: string, fighters: boolean): boolean {
  const s = w.factions[id] as FactionState;
  const f = factionOf(data, id);
  const home = s.bases.find((b) => b.at === f.hq) ?? s.bases[0];
  if (!home) return false;
  // A faction keeping the peace guards its least-held base; others build at home.
  const held = (at: string) => s.assets.filter((a) => a.at === at).length;
  const base =
    s.goal?.kind === 'peaceable-kingdom'
      ? s.bases.reduce((a, b) => (held(b.at) < held(a.at) ? b : a))
      : home;
  const options = f.buys.filter((asset) => {
    const a = srdAsset(data, asset);
    return (
      a.rating <= s[a.attribute] &&
      magicAllows(data, id, asset) &&
      heldOf(data, s, a.attribute).length < s[a.attribute] &&
      assetCost(data, id, asset) <= s.treasure
    );
  });
  const armed = options.filter((a) => hasDamage(data, a));
  const pool = fighters && armed.length > 0 ? armed : options;
  if (pool.length === 0) return false;
  const pick = pool.reduce((a, b) => (assetCost(data, id, b) > assetCost(data, id, a) ? b : a));
  s.treasure -= assetCost(data, id, pick);
  addAsset(data, s, pick, base.at);
  news(w, `${f.name} raises ${assetName(data, id, pick)} at ${locationName(data, base.at)}.`);
  return true;
}

/** Move Asset: every asset that can attack and isn't there yet marches on `to`. */
export function moveAction(w: World, data: GameData, id: string, to: string): void {
  const s = w.factions[id] as FactionState;
  const moving = s.assets.filter((a) => hasDamage(data, a.asset) && a.at !== to);
  for (const a of moving) a.at = to;
  if (moving.length > 0)
    news(w, `${factionOf(data, id).name} marches on ${locationName(data, to)}.`);
}
