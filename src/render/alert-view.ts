// The pop-up notices beside the screen: strain taken while time passes, quests changing, how a show
// at the inn went, and an ally's siege begun (Phase 23a). Pure
// reads of game state: the UI takes a snapshot before each change and compares after it.
import type { GameData } from '../game/character/context.ts';
import { itemsTaken, payerName, questOf } from '../game/world/quests.ts';
import { memberSheet } from '../game/world/members.ts';
import type { World } from '../game/world/types.ts';
import { questStatus } from './quest-view.ts';
import { allied } from '../game/factions/siege.ts';
import { allyTowns, holderOf } from '../game/world/siege-state.ts';
import { factionOf, locationName } from '../game/factions/state.ts';

export type AlertSnapshot = {
  /** The day, quarter, and dungeon turn: strain only warns when time has moved on. */
  time: string;
  members: Record<string, { strain: number; broken: boolean; dead: boolean }>;
  quests: Record<string, { status: string; step: number }>;
  performedDay: number | null;
  /** How long the journal was, so a show's lines can be found among the new ones. */
  logLength: number;
  /** The sieges under way, as town:attacker (Phase 23a). */
  sieges: string[];
  /** The ally's settlements held against it, as town:holder (Phase 23b). */
  held: string[];
};

export type Alert = { kind: 'strain' | 'quest' | 'inn' | 'siege'; title: string; text: string };

/** One line in the strain window. */
export type Entry = { title: string; text: string };

/** A notice on screen; the strain window holds every strain notice as an entry, newest first. */
export type Shown = Alert & { id: number; entries?: Entry[] };

/** The strain window's heading. */
export const STRAIN_WINDOW = 'Strain';

/**
 * Puts newly found notices on screen beside those already there (Sam's ask): every strain notice
 * goes into the one strain window, added to it if it is open, else opening it, so the player
 * dismisses strain once. Other notices stand on their own. At most `most` show, the oldest of the
 * others giving way first; the strain window stays until dismissed. Ids count on from `nextId`.
 */
export function addAlerts(
  shown: readonly Shown[],
  found: readonly Alert[],
  nextId: number,
  most: number,
): { shown: Shown[]; nextId: number } {
  let id = nextId;
  const strain = found
    .filter((a) => a.kind === 'strain')
    .map(({ title, text }) => ({ title, text }));
  const others = found.filter((a) => a.kind !== 'strain').map((a) => ({ ...a, id: id++ }));
  const open = shown.find((a) => a.kind === 'strain');
  let out: Shown[] = [...shown];
  if (strain.length > 0 && open)
    // Kept under the same id, so the window stays put and only grows; it opened with entries.
    out = out.map((a) =>
      a === open ? { ...a, entries: [...strain.reverse(), ...(a.entries as Entry[])] } : a,
    );
  else if (strain.length > 0)
    out.push({
      kind: 'strain',
      title: STRAIN_WINDOW,
      text: '',
      entries: strain.reverse(),
      id: id++,
    });
  out.push(...others);
  while (out.length > most) {
    const oldest = out.findIndex((a) => a.kind !== 'strain');
    out.splice(oldest, 1);
  }
  return { shown: out, nextId: id };
}

const timeOf = (w: World) => `${w.day}:${w.quarter}:${w.dungeon?.turn ?? ''}`;

export function alertSnapshot(w: World, data: GameData): AlertSnapshot {
  return {
    time: timeOf(w),
    members: Object.fromEntries(
      w.members.map((m) => [
        m.id,
        { strain: m.character.strain.value, broken: m.character.strain.broken, dead: m.dead },
      ]),
    ),
    quests: Object.fromEntries(
      Object.entries(w.quests).map(([id, st]) => [id, { status: st.status, step: st.step }]),
    ),
    performedDay: w.performedDay,
    logLength: w.log.length,
    sieges: w.sieges.map(siegeKey),
    held: heldKeys(w, data),
  };
}

/** What changed since `before` that the player should hear about at once. */
export function alertsSince(before: AlertSnapshot, w: World, data: GameData): Alert[] {
  return [
    ...strainAlerts(before, w, data),
    ...questAlerts(before, w, data),
    ...innAlerts(before, w),
    ...siegeAlerts(before, w, data),
    ...heldAlerts(before, w, data),
  ];
}

/** Strain gained, Broken, or death while the party travels, camps, or explores. */
function strainAlerts(before: AlertSnapshot, w: World, data: GameData): Alert[] {
  if (before.time === timeOf(w)) return [];
  return w.members.flatMap((m): Alert[] => {
    const was = before.members[m.id];
    if (!was || was.dead) return [];
    const name = m.character.name;
    if (m.dead) return [{ kind: 'strain', title: `${name} has died`, text: lastNote(w, name) }];
    const gained = m.character.strain.value - was.strain;
    if (gained <= 0) return [];
    const max = memberSheet(data, m).strainMax;
    const broken = m.character.strain.broken && !was.broken ? ` ${name} is Broken.` : '';
    return [
      {
        kind: 'strain',
        title: `${name}: +${gained} strain`,
        text: `Strain ${m.character.strain.value}/${max}.${broken}`,
      },
    ];
  });
}

/** Quests taken, moved on a step, finished, or failed (abandoning one fails it). */
function questAlerts(before: AlertSnapshot, w: World, data: GameData): Alert[] {
  const steps = Object.fromEntries(Object.entries(before.quests).map(([id, q]) => [id, q.step]));
  const found = new Map(itemsTaken(w, data, steps).map((f) => [f.quest, f.item]));
  return Object.entries(w.quests).flatMap(([id, st]): Alert[] => {
    const was = before.quests[id];
    const q = questOf(data, id);
    const quest = (title: string, text: string): Alert[] => [{ kind: 'quest', title, text }];
    if (!was) return quest(`Quest taken: ${q.name}`, questStatus(w, data, id));
    if (was.status === st.status && was.step === st.step) return [];
    const ready = st.status === 'ready' ? ` Return to ${payerName(data, q)} for the reward.` : '';
    const item = found.get(q.name);
    if (item) return quest('Quest item found', `${q.name}: the party takes ${item}.${ready}`);
    if (st.status === 'failed') return quest(`Quest failed: ${q.name}`, lastNote(w, q.name));
    if (st.status === 'done') return quest(`Quest complete: ${q.name}`, 'The reward is paid.');
    if (st.status === 'ready') return quest(`Quest done: ${q.name}`, ready.trim());
    return quest(`Quest updated: ${q.name}`, questStatus(w, data, id));
  });
}

/** A member just played the inn's common room (perform.ts): did it pay for the beds? */
function innAlerts(before: AlertSnapshot, w: World): Alert[] {
  if (w.performedDay === null || w.performedDay === before.performedDay) return [];
  const lines = w.log.slice(before.logLength).map(undated);
  const show = lines.find((l) => / plays (to a cold room|the common room)/.test(l));
  if (!show) return [];
  const tips = lines.find((l) => l.startsWith('The crowd throws'));
  const cold = show.includes('cold room');
  return [
    {
      kind: 'inn',
      title: cold ? 'A cold room' : 'A good night at the inn',
      text: tips ? `${show} ${tips}` : show,
    },
  ];
}

const undated = (line: string) => line.replace(/^Day \d+, [^:]+: /, '');

/** The newest journal line about `subject`, without its date. */
function lastNote(w: World, subject: string): string {
  return undated([...w.log].reverse().find((l) => l.includes(subject)) ?? '');
}

const siegeKey = (s: World['sieges'][number]) => `${s.town}:${s.attacker}`;

/**
 * A siege begun with the party's ally as attacker or defender, heard of at once wherever the party
 * is (docs/rules-adaptation.md, Sieges: Alerts).
 */
function siegeAlerts(before: AlertSnapshot, w: World, data: GameData): Alert[] {
  const was = new Set(before.sieges);
  return w.sieges
    .filter((s) => !was.has(siegeKey(s)) && allied(data, s))
    .map((s) => ({
      kind: 'siege',
      title: `Siege: ${locationName(data, s.town)}`,
      text: `${factionOf(data, s.attacker).name} besieges ${locationName(data, s.town)}, held by ${factionOf(data, s.defender).name}. The first assault comes at the end of day ${s.next + 1}.`,
    }));
}

/** The ally's settlements held against it, as town:holder. */
const heldKeys = (w: World, data: GameData) =>
  allyTowns(data).flatMap((town) => {
    const holder = holderOf(w, data, town);
    return holder ? [`${town}:${holder}`] : [];
  });

/** An ally's settlement taken, taken back, or taken by one holder from another (Phase 23b, 23d). */
function heldAlerts(before: AlertSnapshot, w: World, data: GameData): Alert[] {
  const now = heldKeys(w, data);
  const town = (key: string) => key.slice(0, key.indexOf(':'));
  const holder = (key: string) => factionOf(data, key.slice(key.indexOf(':') + 1)).name;
  const name = (key: string) => locationName(data, town(key));
  const was = (key: string) => before.held.find((k) => town(k) === town(key));
  const taken = now
    .filter((k) => !before.held.includes(k))
    .map((k): Alert => {
      const from = was(k);
      return from
        ? {
            kind: 'siege',
            title: `Changed hands: ${name(k)}`,
            text: `${holder(k)} takes ${name(k)} from ${holder(from)}. Only its shop and inn still serve the party.`,
          }
        : {
            kind: 'siege',
            title: `Captured: ${name(k)}`,
            text: `${holder(k)} now holds ${name(k)}. Only its shop and inn still serve the party.`,
          };
    });
  const freed = before.held
    .filter((k) => !now.some((n) => town(n) === town(k)))
    .map((k): Alert => ({
      kind: 'siege',
      title: `Freed: ${name(k)}`,
      text: `${name(k)} is free again.`,
    }));
  return [...taken, ...freed];
}
