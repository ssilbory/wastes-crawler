// A siege's assault (Phase 23a; docs/rules-adaptation.md, Sieges: The battle, Walls, Losses). Each
// side fields one fighter per hit point of its assets there: the attackers as their assets'
// patrol monsters, the defenders as militia with the holder's Force assets as veterans, besides
// the militia the settlement raises. Behind walls only half of each attacking group comes on,
// unless Siege Experts lead it. The auto-combat simulator fights it out. Every attacker or holder's
// fighter who falls, runs, or surrenders costs its side 1 hit point; the militia cost nothing, but
// an assault lost costs the holder 2 more (Sam's calls on siege balance).
import type { Siege } from '../../data/schemas/index.ts';
import { runBattle } from '../combat/aftermath.ts';
import { createBattle } from '../combat/battle.ts';
import type { Battle } from '../combat/types.ts';
import type { GameData } from '../character/context.ts';
import { wallsHold } from '../world/project-effects.ts';
import { settlementOf } from '../world/siege-state.ts';
import type { World } from '../world/types.ts';
import { hurtAsset, hurtBase } from './combat.ts';
import { patrolOf } from './patrols.ts';
import { besiegers, holders } from './siege.ts';
import { factionOf, locationName, news, srdAsset, type HeldAsset } from './state.ts';
import { strikesFor } from './strikes.ts';

/** A battle's rows: at most three of eight, front first. */
const ROW = 8;
const MOST = 3 * ROW;

const rules = (data: GameData) => data.content.siegeRules;

/** Fighters into rows, front first; past three full rows no more fit on the field. */
export function toRows(fighters: string[]): string[][] {
  const rows: string[][] = [];
  for (let i = 0; i < Math.min(fighters.length, MOST); i += ROW)
    rows.push(fighters.slice(i, Math.min(i + ROW, MOST)));
  return rows;
}

/** Half a group, rounded up, taken from the front rows. */
export function halveRows(rows: string[][]): string[][] {
  let left = Math.ceil(rows.flat().length / 2);
  const out: string[][] = [];
  for (const row of rows) {
    if (left === 0) break;
    out.push(row.slice(0, left));
    left -= Math.min(left, row.length);
  }
  return out;
}

/** Whether the settlement's walls slow this siege: walls stand, and no Siege Experts are there. */
export function walled(w: World, data: GameData, s: Siege): boolean {
  const experts = besiegers(w, data, s).some((a) => rules(data).ignoreWalls.includes(a.asset));
  return wallsHold(w, data, s.town) > 0 && !experts;
}

/** An asset's group: its patrol, or its hit points in militia for a faction that sends none. */
export function groupOf(data: GameData, attacker: string, held: HeldAsset): string[][] {
  const patrol = patrolOf(data, attacker, held.asset);
  return patrol
    ? patrol.enemies
    : toRows(Array.from({ length: Math.min(held.hp, ROW) }, () => rules(data).militiaMonster));
}

/** One fighter per hit point, cycling through the asset's group. */
function fightersOf(data: GameData, attacker: string, held: HeldAsset, halve: boolean): string[] {
  const group = groupOf(data, attacker, held).flat();
  const all = Array.from({ length: held.hp }, (_, i) => group[i % group.length] as string);
  return halve ? all.slice(0, Math.ceil(all.length / 2)) : all;
}

/** The militia the settlement raises, by its size; a place on no map raises a village's. */
const militiaOf = (data: GameData, s: Siege) =>
  rules(data).militia[settlementOf(data, s.town)?.site.size ?? 'village'];

/**
 * The defenders: the settlement's militia, then a fighter per hit point of the holder's assets,
 * but `away`, the one the party fights alone from the besiegers' side.
 */
export function defenders(
  w: World,
  data: GameData,
  s: Siege,
  away: HeldAsset | null = null,
): string[] {
  const r = rules(data);
  const militia = Array.from({ length: militiaOf(data, s) }, () => r.militiaMonster);
  const held = holders(w, s)
    .filter((a) => a !== away)
    .flatMap((a) =>
      Array.from({ length: a.hp }, () =>
        srdAsset(data, a.asset).attribute === 'force' ? r.forceMonster : r.militiaMonster,
      ),
    );
  return [...militia, ...held];
}

/** Fighters no longer standing: fallen, fled, or surrendered. */
const down = (c: Battle['combatants'][number]) => c.status !== 'active' && c.status !== 'asleep';

/** The attackers lost, and the holder's own fighters lost; the militia, first in line, cost none. */
function losses(b: Battle, militia: number): { attackers: number; holder: number } {
  const side = (id: 'party' | 'enemy') => b.combatants.filter((c) => c.side === id);
  return {
    attackers: side('enemy').filter(down).length,
    holder: side('party').slice(militia).filter(down).length,
  };
}

/** Spreads `n` hit points of losses over assets, the sturdiest first, then the base at `at`. */
function spread(
  w: World,
  data: GameData,
  owner: string,
  assets: HeldAsset[],
  n: number,
  base: string | null,
): { dealt: number; razed: boolean } {
  let dealt = 0;
  let left = n;
  while (left > 0) {
    const standing = assets.filter((a) => a.hp > 0);
    if (standing.length === 0) break;
    const sturdiest = standing.reduce((a, b) => (b.hp > a.hp ? b : a));
    dealt += hurtAsset(w, data, owner, sturdiest, 1);
    left -= 1;
  }
  const had = base !== null && w.factions[owner]?.bases.some((b) => b.at === base);
  if (left > 0 && base && had) dealt += hurtBase(w, data, owner, base, left);
  const razed = had === true && !w.factions[owner]?.bases.some((b) => b.at === base);
  return { dealt, razed };
}

export interface AssaultResult {
  /** The defenders held: every attacker ran, or the fight broke off. */
  held: boolean;
  /** The walls turned the assault back before it was fought. */
  turned: boolean;
}

/**
 * One assault, every besieger in it but `share`, the asset the party fights alone, and every
 * holder's asset but `away`, the one it fights from the besiegers' side (Phase 23d). The walls may
 * turn it back first, as they did a raid (Major projects: Project kinds; Working effects).
 */
export function assault(
  w: World,
  data: GameData,
  s: Siege,
  share: HeldAsset | null,
  away: HeldAsset | null = null,
): AssaultResult {
  const town = locationName(data, s.town);
  const attacker = factionOf(data, s.attacker).name;
  const walls = wallsHold(w, data, s.town);
  if (walls > 0 && w.rng.int(1, 100) <= walls) {
    news(w, `the walls of ${town} turned ${attacker}'s assault back.`);
    return { held: true, turned: true };
  }
  const halve = walled(w, data, s);
  const sim = besiegers(w, data, s).filter((a) => a !== share);
  const attackers = sim.flatMap((a) => fightersOf(data, s.attacker, a, halve));
  const defending = defenders(w, data, s, away);
  if (attackers.length === 0) return { held: true, turned: false };
  const strike = strikesFor(w, data, s.attacker);
  if (defending.length === 0) {
    // No one left to defend it: each attacker costs the base a hit point (Sam's call).
    const hurt = spread(w, data, s.defender, [], attackers.length, s.town);
    strike(s.defender, s.town, { hit: hurt.razed, dealt: hurt.dealt, razed: hurt.razed });
    news(w, `${attacker} storms ${town}, and no one stands to defend it.`);
    return { held: false, turned: false };
  }
  const b = createBattle({
    data,
    rng: w.rng,
    party: [],
    allies: toRows(defending),
    enemies: toRows(attackers),
    sideNames: { party: 'the defenders', enemy: 'the attackers' },
  });
  const held = runBattle(b).outcome !== 'enemy';
  const lost = losses(b, militiaOf(data, s));
  spread(w, data, s.attacker, sim, lost.attackers, null);
  // An assault lost costs the holder its overrun loss besides its own fighters (Sam's call).
  const toll = lost.holder + (held ? 0 : rules(data).overrun);
  const kept = holders(w, s).filter((a) => a !== away);
  const hurt = spread(w, data, s.defender, kept, toll, s.town);
  strike(s.defender, s.town, { hit: hurt.razed, dealt: hurt.dealt, razed: hurt.razed });
  news(w, `${attacker} storms ${town}; the defenders ${held ? 'hold' : 'are overrun'}.`);
  return { held, turned: false };
}
