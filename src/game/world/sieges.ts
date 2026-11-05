// Sieges as the party lives them (Phase 23a; docs/rules-adaptation.md, Sieges, Sam's calls). Each
// day's end brings any assault due (src/game/factions/assault.ts); a party in the town fights its
// share alone, against the sturdiest besieger's patrol group, while the rest is simulated. The
// party enters or leaves a besieged settlement, or attacks a camp, only by beating a camp's group,
// which destroys that asset; either joins the siege and brings the first assault at once. An
// assault lost with the party inside drives it to a hex beside the town, strained. In the ally's own
// siege of a town held against it (Phase 23b), or a rival's the party sided with (Phase 23d), the
// party inside fights the holder's sturdiest asset instead, and the lines don't bar its way.
import type { Siege, SiegeFight } from '../../data/schemas/index.ts';
import { hexKey, type Hex } from '../../rules/hex.ts';
import { assault, groupOf, halveRows, mergeGroups, walled } from '../factions/assault.ts';
import { hurtAsset, hurtBase } from '../factions/combat.ts';
import { reclaimAll } from '../factions/capture.ts';
import { besiegers, campHexes, pitchCamps, settle } from '../factions/siege.ts';
import { assetName, factionOf, locationName, type HeldAsset } from '../factions/state.ts';
import type { GameData } from '../character/context.ts';
import type { WorldEvent } from './bus.ts';
import { meetGroup } from './encounters.ts';
import { addMemberStrain, alive, note } from './members.ts';
import { partyIn, partySide, settlementOf } from './siege-state.ts';
import { holdTarget, stormWon } from './storm.ts';
import type { World } from './types.ts';

const rules = (data: GameData) => data.content.siegeRules;

/**
 * Whether the party stands against the siege's attacker, its lines barring the party's way: a
 * siege on the ally, or a rival's siege the party took the holder's side in (Phase 23d).
 */
const opposed = (data: GameData, s: Siege) => partySide(data, s) === 'defender';

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

/**
 * The sturdiest besiegers, as many as a share holds (Sam's call, Phase 23g: siegeRules.shareGroups),
 * whose groups the party fights together in an assault; a siege still on has one.
 */
const sturdiest = (data: GameData, assets: HeldAsset[]) =>
  [...assets].sort((a, b) => b.hp - a.hp).slice(0, rules(data).shareGroups);

/**
 * Tonight's assault, if due. A party inside on the holder's side fights the sturdiest besieger's
 * group; on the besiegers' side (Phase 23d), the holder's sturdiest asset or its base's guard.
 */
function assaultDue(w: World, data: GameData, s: Siege): void {
  if (s.gate && !w.encounter) s.gate = null;
  if (w.day < s.next) return;
  s.next = w.day + 1;
  const side = partySide(data, s);
  const inside = partyIn(w, data, s.town) && (side === 'defender' || side === 'attacker');
  const free = inside && !w.encounter;
  const share = free && side === 'defender' ? sturdiest(data, besiegers(w, data, s)) : [];
  const hold = free && side === 'attacker' ? holdTarget(w, data, s.town, s.defender) : null;
  const away = w.factions[s.defender]?.assets.find((a) => a.uid === hold?.uid) ?? null;
  const r = assault(w, data, s, share, away);
  if (inside) s.joined = true;
  if (r.turned) return;
  const ended = settle(w, data, s);
  // The party's side lost the night: the town overrun, or the assault thrown back.
  const lost = side === 'defender' ? !r.held : r.held;
  const [first, ...rest] = share;
  if (first && !ended) {
    // The groups the party fights, each halved behind walls, then lined up as one.
    const groups = share.map((a) => {
      const group = groupOf(data, s.attacker, a);
      return walled(w, data, s) ? halveRows(group) : group;
    });
    const size = (i: number) => (groups[i] as string[][]).flat().length;
    const also = rest.map((a, i) => ({ uid: a.uid, size: size(i + 1) }));
    s.gate = { uid: first.uid, size: size(0), lost, ...(also.length > 0 ? { also } : {}) };
    const who = share.map((a) => name(data, s, a)).join(' and ');
    const lead = `${who} ${share.length === 1 ? 'storms' : 'storm'} the gates!`;
    fight(w, data, s, first, 'assault', mergeGroups(groups), lead);
  } else if (hold && !ended) {
    // The holder's asset sat the night out, and its base can't fall while the siege goes on.
    s.gate = { uid: hold.uid, size: hold.rows.flat().length, lost };
    const e = meetGroup(
      w,
      data,
      hold.rows,
      'hostile',
      null,
      null,
      `The party falls on ${hold.name}!`,
    );
    e.siege = { town: s.town, attacker: s.attacker, uid: hold.uid, kind: 'breach' };
  } else if (inside && lost) driveOut(w, data, s, true);
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
  if (s && f.kind === 'breach') {
    breached(w, data, s, f.uid);
    return;
  }
  const held = assetOf(w, f);
  if (!s || !held) return;
  if (f.kind === 'assault') {
    // Each group in the share costs its own asset a hit point a fighter.
    hurtAsset(w, data, f.attacker, held, s.gate?.size ?? 0);
    for (const part of s.gate?.also ?? []) {
      const other = w.factions[f.attacker]?.assets.find((a) => a.uid === part.uid);
      if (other) hurtAsset(w, data, f.attacker, other, part.size);
    }
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

/** The party's share on the besiegers' side beaten: a hit point of the holder's a fighter. */
function breached(w: World, data: GameData, s: Siege, uid: string): void {
  // A share whose night has been cleared away costs nothing more.
  if (!s.gate) return;
  const size = s.gate.size;
  const held = w.factions[s.defender]?.assets.find((a) => a.uid === uid);
  if (held) hurtAsset(w, data, s.defender, held, size);
  if (uid === 'base') hurtBase(w, data, s.defender, s.town, size);
  settle(w, data, s);
}

/** A siege fight over, won or not: turned back from the gates, or caught in a lost assault. */
function over(w: World, data: GameData, f: SiegeFight, won: boolean): void {
  const s = find(w, f);
  if (!s) return;
  if (f.kind === 'enter' && !won) driveOut(w, data, s, false);
  if (f.kind !== 'assault' && f.kind !== 'breach') return;
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
