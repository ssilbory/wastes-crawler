// Quest progress (docs/rules-adaptation.md, Quests in Phase 6): each quest runs its steps in order,
// moved on by world events from the bus. Slay steps wait at a hex as a fixed encounter; scout steps
// are reached; deliver and escort steps end in a town. A deadline or an escort's death fails it.
import type { Objective, Quest, QuestState } from '../../data/schemas/index.ts';
import { hexKey } from '../../rules/hex.ts';
import type { Cell } from '../../rules/grid.ts';
import { levelOf } from '../dungeon/explore.ts';
import type { GameData } from '../character/context.ts';
import type { WorldEvent } from './bus.ts';
import { meetGroup } from './encounters.ts';
import { note } from './members.ts';
import { removeNpc } from './npcs.ts';
import type { World } from './types.ts';

export function questOf(data: GameData, id: string): Quest {
  const q = data.content.quests.find((x) => x.id === id);
  if (!q) throw new Error(`unknown quest ${id}`);
  return q;
}

/** The step a quest is on, or undefined once all are done. */
export function currentStep(w: World, data: GameData, id: string): Objective | undefined {
  const st = w.quests[id];
  return st ? questOf(data, id).objectives[st.step] : undefined;
}

const here = (w: World, o: Objective) =>
  (o.kind === 'slay' || o.kind === 'scout') &&
  !w.dungeon &&
  o.region === w.region &&
  hexKey(o.hex) === hexKey(w.position);

type Delve = Extract<Objective, { dungeon: string }>;

/** The party is on a delve step's level, and on its cell if it has one. */
const below = (w: World, o: Delve) => {
  const s = w.dungeon;
  if (`${s?.dungeon}/${s?.level}` !== `${o.dungeon}/${o.level}`) return false;
  const at = (s as NonNullable<typeof s>).at;
  return o.kind === 'reach' || (o.at.x === at.x && o.at.y === at.y);
};

const where = (data: GameData, o: { dungeon: string; level: string; at: Cell }) =>
  `${levelOf(data, o.dungeon, o.level).level.name} ${o.at.x},${o.at.y}`;

/** A slay step at the party's hex, or a guardian on its cell, springs its fixed encounter. */
function springSlay(w: World, data: GameData, id: string): void {
  const o = currentStep(w, data, id);
  if (w.encounter || !o) return;
  if (o.kind === 'slay' && here(w, o))
    meetGroup(w, data, o.enemies, 'hostile', null, id, `${o.text} The enemy is here.`);
  else if (o.kind === 'guardian' && below(w, o))
    meetGroup(
      w,
      data,
      o.enemies,
      'hostile',
      null,
      id,
      `${o.text} The guardian is here.`,
      where(data, o),
    );
}

function advance(w: World, data: GameData, id: string): void {
  const st = w.quests[id] as QuestState;
  const q = questOf(data, id);
  st.step += 1;
  if (st.step >= q.objectives.length) {
    st.status = 'ready';
    note(w, `${q.name}: done. Return to ${giverName(data, q)} for the reward.`);
    return;
  }
  note(w, `${q.name}: ${(q.objectives[st.step] as Objective).text}`);
  springSlay(w, data, id);
}

export function giverName(data: GameData, q: Quest): string {
  // Content checks guarantee every quest's giver exists.
  return (data.content.missionGivers.find((g) => g.id === q.giver) as { name: string }).name;
}

/** Ends a quest as failed, sending any escort away. */
export function failQuest(w: World, data: GameData, id: string, why: string): void {
  const st = w.quests[id] as QuestState;
  st.status = 'failed';
  for (const n of w.npcs.filter((x) => x.kind === 'escort' && x.type === id)) removeNpc(w, n.id);
  note(w, `${questOf(data, id).name} has failed: ${why}`);
}

function onStep(w: World, data: GameData, id: string, e: WorldEvent): void {
  const q = questOf(data, id);
  const st = w.quests[id] as QuestState;
  const o = q.objectives[st.step] as Objective;
  switch (e.kind) {
    case 'hex-entered':
      if (o.kind === 'scout' && here(w, o)) advance(w, data, id);
      else springSlay(w, data, id);
      return;
    case 'town-entered':
      if ((o.kind === 'deliver' || o.kind === 'escort') && o.to === e.town) {
        if (o.kind === 'escort')
          for (const n of w.npcs.filter((x) => x.kind === 'escort' && x.type === id))
            removeNpc(w, n.id);
        advance(w, data, id);
      }
      return;
    case 'fight-won':
      if (e.quest === id && (o.kind === 'slay' || o.kind === 'guardian')) advance(w, data, id);
      return;
    case 'level-entered':
      if (o.kind === 'reach' && below(w, o)) advance(w, data, id);
      return;
    case 'cell-entered':
      if (o.kind === 'retrieve' && below(w, o)) {
        note(w, `The party takes ${o.item}.`);
        advance(w, data, id);
      } else springSlay(w, data, id);
      return;
    case 'npc-died':
      if (e.npc.kind === 'escort' && e.npc.type === id)
        failQuest(w, data, id, `${e.npc.name} is lost.`);
      return;
    case 'day-passed':
      if (q.deadlineDays !== undefined && w.day - st.acceptedDay >= q.deadlineDays)
        failQuest(w, data, id, 'time ran out.');
  }
}

/** The quests' bus listener: every active quest hears every event; deadlines stop once all steps are done. */
export function questListener(w: World, data: GameData, e: WorldEvent): void {
  for (const [id, st] of Object.entries(w.quests))
    if (st.status === 'active') onStep(w, data, id, e);
}
