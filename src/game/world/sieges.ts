// Sieges as the party lives them (Phase 23a; docs/rules-adaptation.md, Sieges, Sam's calls). Each
// day's end brings any assault due (src/game/factions/assault.ts); a party in the town fights its
// share alone, against the sturdiest besieger's patrol group, while the rest is simulated. The
// party enters or leaves a besieged settlement, or attacks a camp, only by beating a camp's group,
// which destroys that asset; either joins the siege and brings the first assault at once. An
// assault lost with the party inside drives it to a hex beside the town, strained. The ally's own
// sieges of a town held against it (Phase 23b) the party joins from inside, storming the town.
import type { Siege, SiegeFight } from '../../data/schemas/index.ts';
import { hexKey, type Hex } from '../../rules/hex.ts';
import { assault, groupOf, halveRows, walled } from '../factions/assault.ts';
import { hurtAsset } from '../factions/combat.ts';
import { reclaimAll } from '../factions/capture.ts';
import { besiegers, campHexes, pitchCamps, settle } from '../factions/siege.ts';
import { assetName, factionOf, locationName, type HeldAsset } from '../factions/state.ts';
import type { GameData } from '../character/context.ts';
import type { WorldEvent } from './bus.ts';
import { meetGroup } from './encounters.ts';
import { addMemberStrain, alive, note } from './members.ts';
import { partyIn, settlementOf } from './siege-state.ts';
import { stormWon } from './storm.ts';
import type { World } from './types.ts';

const rules = (data: GameData) => data.content.siegeRules;

/**
 * Whether the party stands against the siege's attacker: every siege but the ally's own, whose
 * lines let the party through and whose assaults it joins by storming the town (storm.ts).
 */
const opposed = (data: GameData, s: Siege) => s.attacker !== rules(data).ally;

const find = (w: World, f: SiegeFight) =>
  w.sieges.find((s) => s.town === f.town && s.attacker === f.attacker);

const assetOf = (w: World, f: SiegeFight) =>
  w.factions[f.attacker]?.assets.find((a) => a.uid === f.uid);

/** The party joins: it has fought in the siege, and the first assault comes tonight. */
function join(w: World, s: Siege): void {
  s.joined = true;
  s.next = Math.min(s.next, w.day);
}

/** A fight with a besieging asset's group, tagged so the win can find the siege. */
function fight(
  w: World,
  data: GameData,
  s: Siege,
  held: HeldAsset,
  kind: SiegeFight['kind'],
  rows: string[][],
  lead: string,
): void {
  const e = meetGroup(w, data, rows, 'hostile', null, null, lead);
  e.siege = { town: s.town, attacker: s.attacker, uid: held.uid, kind };
}

const name = (data: GameData, s: Siege, held: HeldAsset) =>
  `${factionOf(data, s.attacker).name}'s ${assetName(data, s.attacker, held.asset)}`;

/** A hex beside the town the party can stand on, away from the camps if it can be. */
export function nearbyHex(w: World, data: GameData, s: Siege): Hex {
  const camps = new Set(s.camps.map(hexKey));
  const hexes = campHexes(data, s.town);
  // With nowhere beside it to stand, the party stays where it is.
  return hexes.find((h) => !camps.has(hexKey(h))) ?? hexes[0] ?? { ...w.position };
}

/** Out of the town to the hex beside it, each PC strained if the assault was lost. */
function driveOut(w: World, data: GameData, s: Siege, strained: boolean): void {
  const h = nearbyHex(w, data, s);
  w.position = { col: h.col, row: h.row };
  w.destination = null;
  if (!strained) {
    note(w, `The party falls back from the gates of ${locationName(data, s.town)}.`);
    return;
  }
  note(w, `${locationName(data, s.town)}'s defenders are overrun, and the party is driven out.`);
  for (const m of alive(w)) addMemberStrain(w, data, m, rules(data).strain, 'condition');
}

/** The sturdiest besieger, whose group the party fights in an assault; a siege still on has one. */
const sturdiest = (assets: HeldAsset[]) => assets.reduce((a, b) => (b.hp > a.hp ? b : a));

/** Tonight's assault, if due. */
function assaultDue(w: World, data: GameData, s: Siege): void {
  if (s.gate && !w.encounter) s.gate = null;
  if (w.day < s.next) return;
  s.next = w.day + 1;
  const inside = partyIn(w, data, s.town) && opposed(data, s);
  const share = inside && !w.encounter ? sturdiest(besiegers(w, data, s)) : null;
  const r = assault(w, data, s, share);
  if (inside) s.joined = true;
  if (r.turned) return;
  const ended = settle(w, data, s);
  if (share && !ended && share.hp > 0) {
    const group = groupOf(data, s.attacker, share);
    const rows = walled(w, data, s) ? halveRows(group) : group;
    s.gate = { uid: share.uid, size: rows.flat().length, lost: !r.held };
    fight(w, data, s, share, 'assault', rows, `${name(data, s, share)} storms the gates!`);
  } else if (inside && !r.held) driveOut(w, data, s, true);
}

/** Arriving at a besieged town: through the lines with a pass, else a camp's group bars the way. */
function arrive(w: World, data: GameData, town: string): void {
  const s = w.sieges.find((x) => x.town === town && opposed(data, x));
  if (!s || w.encounter) return;
  join(w, s);
  if (s.pass) {
    s.pass = false;
    note(w, `The party slips through the siege lines into ${locationName(data, town)}.`);
    return;
  }
  const held = besiegers(w, data, s)[0];
  if (!held) {
    settle(w, data, s);
    return;
  }
  const lead = `${name(data, s, held)} bars the way into ${locationName(data, town)}!`;
  fight(w, data, s, held, 'enter', groupOf(data, s.attacker, held), lead);
}

/** Stepping onto a camp's hex attacks it. */
function attackCamp(w: World, data: GameData): void {
  if (w.encounter || w.dungeon) return;
  for (const s of w.sieges) {
    const at = settlementOf(data, s.town);
    if (at?.region !== w.region || !opposed(data, s)) continue;
    const camp = s.camps.find((c) => c.col === w.position.col && c.row === w.position.row);
    const held = camp && w.factions[s.attacker]?.assets.find((a) => a.uid === camp.uid);
    if (!held) continue;
    join(w, s);
    const lead = `The party falls on the camp of ${name(data, s, held)}!`;
    fight(w, data, s, held, 'camp', groupOf(data, s.attacker, held), lead);
    return;
  }
}

/**
 * Leaving a besieged town: through the lines with a pass, else a fight with a camp's group first.
 * Returns whether the march must wait for it.
 */
export function breakOut(w: World, data: GameData): boolean {
  const s = w.sieges.find((x) => partyIn(w, data, x.town) && opposed(data, x));
  if (!s || w.encounter) return false;
  if (s.pass) {
    s.pass = false;
    note(w, `The party slips out through the siege lines.`);
    return false;
  }
  const held = besiegers(w, data, s)[0];
  if (!held) {
    settle(w, data, s);
    return false;
  }
  const lead = `${name(data, s, held)} bars the way out of ${locationName(data, s.town)}!`;
  fight(w, data, s, held, 'exit', groupOf(data, s.attacker, held), lead);
  return true;
}

/** A won siege fight: a camp's group beaten destroys its asset; the party's share costs its own. */
function won(w: World, data: GameData, f: SiegeFight): void {
  const s = find(w, f);
  const held = assetOf(w, f);
  if (!s || !held) return;
  if (f.kind === 'assault') {
    hurtAsset(w, data, f.attacker, held, s.gate?.size ?? 0);
  } else {
    note(w, `${name(data, s, held)} is broken.`);
    hurtAsset(w, data, f.attacker, held, held.hp);
    if (f.kind === 'camp') s.pass = true;
    if (f.kind === 'exit') {
      const h = nearbyHex(w, data, s);
      w.position = { col: h.col, row: h.row };
      note(w, `The party breaks out of ${locationName(data, s.town)}.`);
    }
  }
  pitchCamps(w, data, s);
  settle(w, data, s);
}

/** A siege fight over, won or not: turned back from the gates, or caught in a lost assault. */
function over(w: World, data: GameData, f: SiegeFight, won: boolean): void {
  const s = find(w, f);
  if (!s) return;
  if (f.kind === 'enter' && !won) driveOut(w, data, s, false);
  if (f.kind !== 'assault') return;
  const lost = s.gate?.lost === true;
  s.gate = null;
  if (lost && partyIn(w, data, s.town)) driveOut(w, data, s, true);
}

/** The sieges' bus listener. */
export function siegesListener(w: World, data: GameData, e: WorldEvent): void {
  if (e.kind === 'day-passed') {
    // A settlement of the ally's no one holds any more is taken back (capture.ts).
    reclaimAll(w, data);
    for (const s of [...w.sieges]) {
      pitchCamps(w, data, s);
      if (settle(w, data, s)) continue;
      assaultDue(w, data, s);
    }
  } else if (e.kind === 'town-entered') arrive(w, data, e.town);
  else if (e.kind === 'hex-entered') attackCamp(w, data);
  else if (e.kind === 'fight-won' && e.siege)
    (e.siege.kind === 'storm' ? stormWon : won)(w, data, e.siege);
  else if (e.kind === 'fight-over' && e.siege) over(w, data, e.siege, e.won);
}
