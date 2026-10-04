// Faction state (Phase 13; vendor/wwn-srd/6.0 Factions/): each faction starts from its content,
// with a Base of Influence at its headquarters whose hit points match the faction's maximum
// (Creating Factions.md), and lookups the turn shares.
import type {
  Faction,
  FactionAsset,
  FactionAssetRule,
  FactionAttribute,
  FactionState,
} from '../../data/schemas/index.ts';
import { factionMaxHp, type Ratings } from '../../rules/factions.ts';
import type { GameData } from '../character/context.ts';
import { note } from '../world/members.ts';
import type { World } from '../world/types.ts';

export type HeldAsset = FactionState['assets'][number];

export function factionOf(data: GameData, id: string): Faction {
  const f = data.content.factions.factions.find((x) => x.id === id);
  if (!f) throw new Error(`unknown faction ${id}`);
  return f;
}

/** An asset's SRD statistics; content checks guarantee every held or bought asset exists. */
export const srdAsset = (data: GameData, id: string) =>
  data.srd['faction-assets'].find((a) => a.id === id) as FactionAsset;

export const assetRule = (data: GameData, id: string) =>
  data.content.factions.assets.find((a) => a.asset === id) as FactionAssetRule;

export const locationName = (data: GameData, id: string) =>
  data.content.factions.locations.find((l) => l.id === id)?.name ?? id;

/** What the faction calls an asset in the news. */
export const assetName = (data: GameData, faction: string, asset: string) =>
  factionOf(data, faction).names[asset] ?? srdAsset(data, asset).name;

export const ratings = (s: FactionState): Ratings => ({
  force: s.force,
  cunning: s.cunning,
  wealth: s.wealth,
});

export const isActive = (s: FactionState | undefined): s is FactionState =>
  s !== undefined && s.hp > 0;

/** Assets the faction holds of one attribute, for the cap of one per rating point. */
export const heldOf = (data: GameData, s: FactionState, attribute: FactionAttribute) =>
  s.assets.filter((a) => srdAsset(data, a.asset).attribute === attribute);

/** Adds an asset at full hit points. */
export function addAsset(data: GameData, s: FactionState, asset: string, at: string): HeldAsset {
  s.serial += 1;
  const held = { uid: `a${s.serial}`, asset, at, hp: srdAsset(data, asset).hp };
  s.assets.push(held);
  return held;
}

function startState(data: GameData, f: Faction): FactionState {
  const max = factionMaxHp(f);
  const s: FactionState = {
    force: f.force,
    cunning: f.cunning,
    wealth: f.wealth,
    hp: max,
    treasure: f.treasure,
    xp: 0,
    bases: [{ at: f.hq, hp: max, max }, ...f.bases.map((b) => ({ ...b, max: b.hp }))],
    assets: [],
    goal: null,
    goalIndex: 0,
    idle: false,
    serial: 0,
  };
  for (const a of f.assets) addAsset(data, s, a.asset, a.at);
  return s;
}

/** Starts any faction the world doesn't have yet: a new world, or an older save. */
export function startFactions(w: World, data: GameData): void {
  for (const f of data.content.factions.factions) w.factions[f.id] ??= startState(data, f);
}

/** A line of faction news in the journey log. */
export const news = (w: World, text: string) => note(w, `Word spreads: ${text}`);

const MAGIC = ['none', 'low', 'medium', 'high'] as const;

/** Whether the faction's Magic is enough for the asset. */
export const magicAllows = (data: GameData, faction: string, asset: string) =>
  MAGIC.indexOf(srdAsset(data, asset).magic) <= MAGIC.indexOf(factionOf(data, faction).magic);

/** Whether the asset's Attack does damage (others have no Attack, or a special one). */
export function hasDamage(data: GameData, asset: string): boolean {
  const attack = srdAsset(data, asset).attack;
  return attack?.kind === 'check' && attack.damage !== null;
}
