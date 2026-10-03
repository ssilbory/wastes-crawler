// Mission givers in town (docs/rules-adaptation.md, Quests in Phase 6): quests on offer once their
// prerequisites are met, accepted any number at a time, each run once, and turned in to the giver
// for crowns, XP (SRD 2.7.0: three for an average mission), and loot.
import type { MissionGiver, Quest } from '../../data/schemas/index.ts';
import { toTenths } from '../../rules/economy.ts';
import type { GameData } from '../character/context.ts';
import { partyLevel } from './difficulty.ts';
import { note } from './members.ts';
import { addNpc } from './npcs.ts';
import { failQuest, giverName, questOf } from './quests.ts';
import type { TownResult } from './services.ts';
import { addLoot } from './shop.ts';
import { townHere } from './town.ts';
import type { World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** The mission givers in the party's town. */
export function giversHere(w: World, data: GameData): MissionGiver[] {
  const town = townHere(w, data);
  return data.content.missionGivers.filter((g) => g.town === town.id);
}

/** Why a quest can't be taken now, or null if it can. */
export function cannotAccept(w: World, data: GameData, q: Quest): string | null {
  if (w.quests[q.id]) return 'Already taken.';
  const needed = q.prerequisites.quests.filter((id) => w.quests[id]?.status !== 'done');
  if (needed.length > 0) return `First: ${needed.map((id) => questOf(data, id).name).join(', ')}.`;
  if (partyLevel(w, data) < q.prerequisites.minLevel)
    return `Needs a party of level ${q.prerequisites.minLevel}.`;
  return null;
}

/** A giver's quests that are on offer or already taken. */
export function questsFrom(data: GameData, giverId: string): Quest[] {
  return data.content.quests.filter((q) => q.giver === giverId);
}

function giverHere(w: World, data: GameData, q: Quest): boolean {
  return giversHere(w, data).some((g) => g.id === q.giver);
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
  const items = q.objectives.flatMap((o) => (o.kind === 'deliver' ? [o.item] : []));
  note(
    w,
    `The party takes on ${q.name}.${items.length > 0 ? ` They carry ${items.join(' and ')}.` : ''}`,
  );
  return { ok: true };
}

/** Collects the reward from the giver once every step is done. */
export function turnInQuest(w: World, data: GameData, id: string): TownResult {
  const q = questOf(data, id);
  if (w.quests[id]?.status !== 'ready') return no(`${q.name} isn't finished.`);
  if (!giverHere(w, data, q)) return no(`${giverName(data, q)} isn't here.`);
  (w.quests[id] as { status: string }).status = 'done';
  w.purse = toTenths(w.purse + q.reward.crowns);
  for (const m of w.members) {
    if (m.dead) m.pendingXp += q.reward.xp;
    else m.character = { ...m.character, xp: m.character.xp + q.reward.xp };
  }
  addLoot(w, q.reward.loot);
  note(
    w,
    `${giverName(data, q)} pays for ${q.name}: ${q.reward.crowns} crowns and ${q.reward.xp} XP each.`,
  );
  return { ok: true };
}

/** Gives up a quest anywhere; it can't be taken again. */
export function abandonQuest(w: World, data: GameData, id: string): TownResult {
  const st = w.quests[id];
  if (st?.status !== 'active' && st?.status !== 'ready') return no('That quest is not under way.');
  failQuest(w, data, id, 'abandoned.');
  return { ok: true };
}
