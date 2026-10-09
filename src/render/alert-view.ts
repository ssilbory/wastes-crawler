// The pop-up notices beside the screen: strain taken while time passes, quests changing, and how a
// show at the inn went. Pure
// reads of game state: the UI takes a snapshot before each change and compares after it.
import type { GameData } from '../game/character/context.ts';
import { itemsTaken, payerName, questOf } from '../game/world/quests.ts';
import { memberSheet } from '../game/world/members.ts';
import type { World } from '../game/world/types.ts';
import { questStatus } from './quest-view.ts';

export type AlertSnapshot = {
  /** The day, quarter, and dungeon turn: strain only warns when time has moved on. */
  time: string;
  members: Record<string, { strain: number; broken: boolean; dead: boolean }>;
  quests: Record<string, { status: string; step: number }>;
  performedDay: number | null;
  /** How long the journal was, so a show's lines can be found among the new ones. */
  logLength: number;
};

export type Alert = { kind: 'strain' | 'quest' | 'inn'; title: string; text: string };

const timeOf = (w: World) => `${w.day}:${w.quarter}:${w.dungeon?.turn ?? ''}`;

export function alertSnapshot(w: World): AlertSnapshot {
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
  };
}

/** What changed since `before` that the player should hear about at once. */
export function alertsSince(before: AlertSnapshot, w: World, data: GameData): Alert[] {
  return [
    ...strainAlerts(before, w, data),
    ...questAlerts(before, w, data),
    ...innAlerts(before, w),
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
