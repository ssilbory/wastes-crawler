// Faction Attacks (vendor/wwn-srd/6.0 Factions/Faction Turn Actions.md, Attack): the defender
// picks which of its assets present meets the attack, or its Base of Influence when none is; an
// attribute check (Attribute Checks.md, with tag dice from Faction Tags.md) decides whether the
// defender takes the attack's damage or the attacker takes the counter. Damage to a base is also
// done to the faction, without overflow; a faction at zero hit points collapses (Faction
// Statistics.md). Asset specials come from data/content/factions.json.
import type { Dice, FactionAttribute, FactionState, FactionTag } from '../../data/schemas/index.ts';
import { roll } from '../../rules/dice.ts';
import { attackerWins } from '../../rules/factions.ts';
import type { GameData } from '../character/context.ts';
import type { World } from '../world/types.ts';
import {
  assetName,
  assetRule,
  factionOf,
  locationName,
  news,
  srdAsset,
  type HeldAsset,
} from './state.ts';

const TAG_DICE: Record<FactionAttribute, FactionTag> = {
  force: 'martial',
  cunning: 'machiavellian',
  wealth: 'rich',
};

function dice(data: GameData, faction: string, attribute: FactionAttribute): number {
  return factionOf(data, faction).tags.includes(TAG_DICE[attribute]) ? 2 : 1;
}

const damage = (w: World, d: Dice) => Math.max(0, roll(w.rng, d).total);

/** The faction collapses: its members scatter and its assets and bases are gone. */
function collapse(w: World, data: GameData, id: string): void {
  const s = w.factions[id] as FactionState;
  s.assets = [];
  s.bases = [];
  news(w, `${factionOf(data, id).name} has collapsed.`);
}

/** Damages an asset; returns the hit points it lost. */
export function hurtAsset(
  w: World,
  data: GameData,
  owner: string,
  held: HeldAsset,
  amount: number,
): number {
  const s = w.factions[owner] as FactionState;
  const dealt = Math.min(amount, held.hp);
  held.hp -= dealt;
  if (held.hp === 0) {
    s.assets = s.assets.filter((a) => a !== held);
    news(
      w,
      `${factionOf(data, owner).name} loses its ${assetName(data, owner, held.asset)} at ${locationName(data, held.at)}.`,
    );
  }
  return dealt;
}

/** Damages the base at `at`, and the faction as much; returns the hit points it lost. */
export function hurtBase(w: World, data: GameData, owner: string, at: string, amount: number) {
  const s = w.factions[owner] as FactionState;
  const base = s.bases.find((b) => b.at === at);
  if (!base) return 0;
  const dealt = Math.min(amount, base.hp);
  base.hp -= dealt;
  s.hp = Math.max(0, s.hp - dealt);
  if (base.hp === 0) {
    s.bases = s.bases.filter((b) => b !== base);
    news(w, `${factionOf(data, owner).name} is driven out of ${locationName(data, at)}.`);
  }
  if (s.hp === 0) collapse(w, data, owner);
  return dealt;
}

/** The defender's choice: its sturdiest asset at the location, else its base there. */
export function defenderAt(s: FactionState, at: string): HeldAsset | 'base' | null {
  const here = s.assets.filter((a) => a.at === at);
  if (here.length > 0) return here.reduce((a, b) => (b.hp > a.hp ? b : a));
  return s.bases.some((b) => b.at === at) ? 'base' : null;
}

/** Temple Fanatics and the like take damage after they attack successfully or defend. */
function selfHarm(w: World, data: GameData, owner: string, held: HeldAsset): void {
  const special = assetRule(data, held.asset).special;
  if (held.hp > 0 && special?.kind === 'self-harm')
    hurtAsset(w, data, owner, held, damage(w, special.damage));
}

function steal(
  w: World,
  data: GameData,
  thief: string,
  victim: string,
  held: HeldAsset,
  stolen: Set<string>,
) {
  const special = assetRule(data, held.asset).special;
  if (special?.kind !== 'steal' || (special.oncePerTurn && stolen.has(held.uid))) return;
  stolen.add(held.uid);
  const v = w.factions[victim] as FactionState;
  const want = typeof special.amount === 'number' ? special.amount : damage(w, special.amount);
  const taken = Math.min(v.treasure, want);
  v.treasure -= taken;
  (w.factions[thief] as FactionState).treasure += taken;
}

export interface StrikeResult {
  hit: boolean;
  /** Hit points the defender lost. */
  dealt: number;
  /** Whether the defending base fell. */
  razed: boolean;
}

/**
 * One asset attacks a rival where it stands; the caller makes sure the asset has a damaging
 * attack and the rival has something there to defend with.
 */
export function strike(
  w: World,
  data: GameData,
  attacker: string,
  held: HeldAsset,
  victim: string,
  stolen: Set<string>,
): StrikeResult {
  const v = w.factions[victim] as FactionState;
  const a = w.factions[attacker] as FactionState;
  const attack = srdAsset(data, held.asset).attack as {
    attacker: FactionAttribute;
    defender: FactionAttribute;
    damage: Dice;
  };
  const defender = defenderAt(v, held.at) as HeldAsset | 'base';
  const hit = attackerWins(
    w.rng,
    { rating: a[attack.attacker], dice: dice(data, attacker, attack.attacker) },
    { rating: v[attack.defender], dice: dice(data, victim, attack.defender) },
  );
  if (!hit) {
    if (defender !== 'base') {
      const counter = srdAsset(data, defender.asset).counter;
      if (counter) hurtAsset(w, data, attacker, held, damage(w, counter));
      selfHarm(w, data, victim, defender);
    }
    return { hit, dealt: 0, razed: false };
  }
  const amount = damage(w, attack.damage);
  let dealt: number;
  let razed = false;
  if (defender === 'base') {
    dealt = hurtBase(w, data, victim, held.at, amount);
    razed = !v.bases.some((b) => b.at === held.at);
  } else {
    dealt = hurtAsset(w, data, victim, defender, amount);
    selfHarm(w, data, victim, defender);
  }
  steal(w, data, attacker, victim, held, stolen);
  selfHarm(w, data, attacker, held);
  return { hit, dealt, razed };
}
