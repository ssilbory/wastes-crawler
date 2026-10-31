// Mission givers in town (docs/rules-adaptation.md, Quests in Phase 6): quests on offer once their
// prerequisites are met, accepted any number at a time, each run once, and turned in to the giver
// for crowns, XP (SRD 2.7.0: three for an average mission), and loot.
import type { MissionGiver, Quest, QuestState, RaiserKind } from '../../data/schemas/index.ts';
import { toTenths } from '../../rules/economy.ts';
import type { GameData } from '../character/context.ts';
import { emit } from './bus.ts';
import { partyLevel } from './difficulty.ts';
import { note } from './members.ts';
import { addNpc } from './npcs.ts';
import { fulfilOrders, gainAuthority, learnCountersign } from './orders.ts';
import { failQuest, giverName, payerName, payerOf, questOf } from './quests.ts';
import { anyDead, isRaising, raisingBlocked } from './raising.ts';
import type { TownResult } from './services.ts';
import { raiseMarked } from './raised.ts';
import { addLoot } from './shop.ts';
import { pickUp } from './party-load.ts';
import type { World } from './types.ts';
import { townHere } from './town-prices.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** The mission givers in the party's town. */
export function giversHere(w: World, data: GameData): MissionGiver[] {
  const town = townHere(w, data);
  return data.content.missionGivers.filter((g) => g.town === town.id);
}

/** A quest's standing state: a raising quest done or failed before can be taken again. */
export function standing(w: World, q: Quest): QuestState | undefined {
  const st = w.quests[q.id];
  return isRaising(q) && (st?.status === 'done' || st?.status === 'failed') ? undefined : st;
}

/** Why a quest can't be taken now, or null if it can. */
export function cannotAccept(w: World, data: GameData, q: Quest): string | null {
  if (standing(w, q)) return 'Already taken.';
  const raising = isRaising(q) ? raisingBlocked(w, q) : null;
  if (raising) return raising;
  const needed = q.prerequisites.quests.filter((id) => w.quests[id]?.status !== 'done');
  if (needed.length > 0) return `First: ${needed.map((id) => questOf(data, id).name).join(', ')}.`;
  if (partyLevel(w, data) < q.prerequisites.minLevel)
    return `Needs a party of level ${q.prerequisites.minLevel}.`;
  return null;
}

/** A giver's quests, raising quests among them. */
export function questsFrom(data: GameData, giverId: string): Quest[] {
  return data.content.quests.filter((q) => q.giver === giverId);
}

/**
 * A giver's quests as the board shows them: a raising quest only while offered or taken, and
 * another giver's quest this giver pays for once it is under way.
 */
export function questBoard(w: World, data: GameData, giverId: string): Quest[] {
  const underWay = (q: Quest) => ['active', 'ready'].includes(w.quests[q.id]?.status ?? '');
  return [
    ...questsFrom(data, giverId).filter(
      (q) => !isRaising(q) || standing(w, q) || (w.raising.offer === q.id && anyDead(w)),
    ),
    ...data.content.quests.filter((q) => q.payer === giverId && underWay(q)),
  ];
}

function giverHere(w: World, data: GameData, q: Quest, id = q.giver): boolean {
  return giversHere(w, data).some((g) => g.id === id);
}

export function acceptQuest(w: World, data: GameData, id: string): TownResult {
  const q = questOf(data, id);
  if (w.encounter) return no('Settle the encounter first.');
  if (!giverHere(w, data, q)) return no(`${giverName(data, q)} isn't here.`);
  const blocked = cannotAccept(w, data, q);
  if (blocked) return no(blocked);
  const [first] = q.objectives;
  if (first?.kind === 'escort') {
    if (!addNpc(w, data, 'escort', q.id, first.monster, first.name, false))
      return no(`Make room in the party for ${first.name}.`);
  }
  w.quests[q.id] = { status: 'active', step: 0, acceptedDay: w.day };
  if (isRaising(q)) w.raising = { offer: null, accepted: w.day };
  const items = q.objectives.flatMap((o) => (o.kind === 'deliver' ? [o.item] : []));
  note(
    w,
    `The party takes on ${q.name}.${items.length > 0 ? ` They carry ${items.join(' and ')}.` : ''}`,
  );
  return { ok: true };
}

/** Collects the reward from the giver once every step is done; a raising quest raises `raise`. */
export function turnInQuest(w: World, data: GameData, id: string, raise?: string): TownResult {
  const q = questOf(data, id);
  if (w.quests[id]?.status !== 'ready') return no(`${q.name} isn't finished.`);
  if (!giverHere(w, data, q, payerOf(q))) return no(`${payerName(data, q)} isn't here.`);
  if (isRaising(q)) {
    const m = w.members.find((x) => x.id === raise);
    if (!m?.dead) return no('Choose a dead PC to raise.');
    (w.quests[id] as { status: string }).status = 'done';
    note(w, `${giverName(data, q)} raises ${m.character.name} for ${q.name}.`);
    // The quest's raising leaves the mark its giver's place does (Phase 20).
    // Content checks give a raising quest's giver a place that raises the dead.
    const giver = data.content.missionGivers.find((g) => g.id === q.giver) as MissionGiver;
    note(w, raiseMarked(data, m, giver.raises as RaiserKind));
    return { ok: true };
  }
  (w.quests[id] as { status: string }).status = 'done';
  w.purse = toTenths(w.purse + q.reward.crowns);
  for (const m of w.members) {
    if (m.dead) m.pendingXp += q.reward.xp;
    else m.character = { ...m.character, xp: m.character.xp + q.reward.xp };
  }
  pickUp(w, data, () => addLoot(w, q.reward.loot));
  note(
    w,
    `${payerName(data, q)} pays for ${q.name}: ${q.reward.crowns} crowns and ${q.reward.xp} XP each.`,
  );
  for (const o of q.reward.countersigns ?? []) learnCountersign(w, data, o);
  if (q.reward.authority) gainAuthority(w, data, q.reward.authority);
  fulfilOrders(w, data, id);
  emit(w, data, { kind: 'quest-done', quest: id });
  return { ok: true };
}

/** Gives up a quest anywhere; it can't be taken again. */
export function abandonQuest(w: World, data: GameData, id: string): TownResult {
  const st = w.quests[id];
  if (st?.status !== 'active' && st?.status !== 'ready') return no('That quest is not under way.');
  failQuest(w, data, id, 'abandoned.');
  return { ok: true };
}
