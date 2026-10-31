// Beasts that follow a handler (docs/rules-adaptation.md, Skills: Animal Ken). After a helpful
// parley a group's strongest animal offers to follow someone with Animal Ken; winning it over costs
// the rations die one step per hit die. Out of town each beast rolls the rations die again every
// night and wanders off when there is nothing left, as it does when its handler is dead or gone.
// A handler keeps Animal Ken + 1 beasts, and beasts take no share of the loot.
import type { PendingEncounter } from '../../data/schemas/index.ts';
import { RESOURCE_DICE, stepDie, useResource } from '../../rules/resource-die.ts';
import type { GameData } from '../character/context.ts';
import { alive, awake, note } from './members.ts';
import { mindOf } from './minds.ts';
import { addNpc, freshName, monsterOf, npcRoom, removeNpc } from './npcs.ts';
import type { TownResult } from './services.ts';
import type { Member, Npc, World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** Offers the strongest animal in a helpful group, if it has any. */
export function offerBeast(w: World, data: GameData, e: PendingEncounter): void {
  const animals = e.enemies.flat().filter((id) => mindOf(data, id) === 'animal');
  const [first, ...rest] = animals;
  if (first === undefined) return;
  const hd = (id: string) => monsterOf(data, id).hitDice;
  const best = rest.reduce((a, b) => (hd(b) > hd(a) ? b : a), first);
  e.beast = best;
  note(w, `The ${monsterOf(data, best).name} looks ready to follow someone who knows beasts.`);
}

export const beastsOf = (w: World, handlerId: string): Npc[] =>
  w.npcs.filter((n) => n.kind === 'beast' && n.master === handlerId);

/** How many more beasts a member can keep: none without Animal Ken. */
export function handlerRoom(w: World, data: GameData, m: Member): number {
  const ken = data.content.skillRules.animalKen;
  const level = m.character.skills[ken.skill];
  if (level === undefined) return 0;
  return level + ken.beastsPerHandler - beastsOf(w, m.id).length;
}

/** Awake members with Animal Ken and room for another beast. */
export const handlers = (w: World, data: GameData): Member[] =>
  w.members.filter((m) => awake(m) && handlerRoom(w, data, m) > 0);

/** Why no one can take the offered beast, or null when someone can. */
export function beastRefusal(w: World, data: GameData): string | null {
  if (handlers(w, data).length === 0)
    return 'No one awake with Animal Ken has room for another beast.';
  return npcRoom(w, true) ? null : 'There is no room in the party.';
}

export function acceptBeast(w: World, data: GameData, handlerId: string): TownResult {
  const e = w.encounter;
  if (!e?.beast) return no('No beast has offered to follow.');
  const won = winBeast(w, data, handlerId, e.beast);
  if (won.ok) delete e.beast;
  return won;
}

/**
 * A beast follows a handler with room, won over with a step of the rations die per hit die: one
 * offered after a parley, or one that surrendered (Phase 19).
 */
export function winBeast(w: World, data: GameData, handlerId: string, beast: string): TownResult {
  const m = handlers(w, data).find((x) => x.id === handlerId);
  if (!m) return no('Choose someone with Animal Ken and room for another beast.');
  const monster = monsterOf(data, beast);
  const steps = monster.hitDice;
  if (RESOURCE_DICE.indexOf(w.rations) < steps)
    return no(`Winning the ${monster.name} over takes ${steps} steps of the rations die.`);
  const npc = addNpc(w, data, 'beast', beast, beast, freshName(w, monster.name), true);
  if (!npc) return no('There is no room in the party.');
  npc.master = m.id;
  w.rations = stepDie(w.rations, -steps);
  note(
    w,
    `The ${monster.name} follows ${m.character.name} now, won over with ${steps} steps of rations.`,
  );
  return { ok: true };
}

/**
 * Each night beasts whose handler is dead or gone wander off; the rest eat from the rations die
 * unless `fedFree` (a town or sacred blood feeds them), and wander off if there is nothing left.
 */
export function nightForBeasts(w: World, data: GameData, fedFree: boolean): void {
  for (const n of w.npcs.filter((x) => x.kind === 'beast')) {
    if (!alive(w).some((m) => m.id === n.master)) {
      removeNpc(w, n.id);
      note(w, `With its handler gone, ${n.name} wanders off.`);
      continue;
    }
    if (fedFree) continue;
    const use = useResource(w.rng, w.rations);
    w.rations = use.die;
    if (use.available) continue;
    removeNpc(w, n.id);
    note(w, `With nothing to eat, ${n.name} goes off to hunt and doesn't come back.`);
  }
}
