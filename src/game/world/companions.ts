// A Beastmaster's animal companion (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.4
// The Beastmaster.md; docs/rules-adaptation.md, The Beastmaster). Sam's calls: one companion, which
// takes an NPC slot while it travels with the party; it can be sent away and called back for free
// outside a fight. Bind Companion takes a quarter's work in the wilds, from the animals of the
// hex's encounter table; Release lets it go for good, which a Chosen Friend never is.
import { maxCompanionHitDice, swiftHealingDice } from '../../rules/beastmaster.ts';
import { roll } from '../../rules/dice.ts';
import { characterLevel } from '../../rules/progression.ts';
import type { GameData } from '../character/context.ts';
import {
  BIND,
  companionHere,
  companionOf,
  syncCompanion,
  syncToughness,
} from './companion-sync.ts';

export { BIND, companionOf };
import { artUsable, awake, note } from './members.ts';
import { mindOf } from './minds.ts';
import { addNpc, monsterOf, placeNpc, removeNpc } from './npcs.ts';
import { passQuarter } from './quarter.ts';
import { regionMap } from './region.ts';
import type { TownResult } from './services.ts';
import type { Member, World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** Members who hold Bind Companion. */
export const beastmasters = (w: World): Member[] =>
  w.members.filter((m) => !m.dead && m.character.arts.includes(BIND));

const member = (w: World, id: string): Member => {
  const m = w.members.find((x) => x.id === id);
  if (!m) throw new Error(`no member ${id}`);
  return m;
};

/** Why the party can't spend a quarter in the wilds here, or null. */
function wildsProblem(w: World, data: GameData): string | null {
  if (w.encounter) return 'Deal with the encounter first.';
  if (w.dungeon || w.coach) return 'Companions are found in the open wilds.';
  if (regionMap(data, w.region).siteAt(w.position)) return 'There are no wild beasts in town.';
  return null;
}

/** Animals of this hex's encounter table that the member could bind: level plus one hit dice. */
export function bindable(w: World, data: GameData, m: Member): string[] {
  if (wildsProblem(w, data)) return [];
  const table = data.content.encounterTables.find(
    (t) => t.id === regionMap(data, w.region).tableAt(w.position),
  );
  const most = maxCompanionHitDice(characterLevel(m.character.classes));
  const ids = (table?.entries ?? []).flatMap((e) => e.groups.map((g) => g.monster));
  return [...new Set(ids)].filter(
    (id) => mindOf(data, id) === 'animal' && monsterOf(data, id).hitDice <= most,
  );
}

/** Why the member can't bind a companion now, whatever the beast, or null. */
export function bindProblem(w: World, data: GameData, m: Member): string | null {
  const name = m.character.name;
  if (!m.character.arts.includes(BIND)) return `${name} can't bind a companion.`;
  if (!awake(m)) return `${name} is in no state to bind a companion.`;
  if (companionOf(w, m)) return `${name} already has a companion; release it first.`;
  return wildsProblem(w, data);
}

/** A companion needs a name to focus the Beastmaster's arts (1.5.4). */
const nameProblem = (name: string): string | null =>
  name.trim().length < 1 || name.trim().length > 40 ? 'Give the companion a name.' : null;

/**
 * Bind Companion: a quarter's work in the wilds binds one of the hex's animals, named by the
 * Beastmaster, while the rest of the party rests. A Chosen Friend is the only companion the
 * Beastmaster will ever bind.
 */
export function bindCompanion(
  w: World,
  data: GameData,
  memberId: string,
  monsterId: string,
  name: string,
  chosen = false,
): TownResult {
  const m = member(w, memberId);
  const problem = bindProblem(w, data, m) ?? nameProblem(name);
  if (problem) return no(problem);
  if (!bindable(w, data, m).includes(monsterId))
    return no(`${m.character.name} can't find a ${monsterOf(data, monsterId).name} to bind here.`);
  const npc = addNpc(w, data, 'companion', monsterId, monsterId, name.trim(), true);
  if (!npc) return no('There is no room in the party.');
  npc.master = m.id;
  if (chosen) npc.chosen = true;
  const kind = monsterOf(data, monsterId).name;
  note(
    w,
    `${m.character.name} spends the quarter in the wilds and binds a ${kind}, ${npc.name}` +
      (chosen ? ', a chosen friend for life.' : '.'),
  );
  syncCompanion(w, data, m);
  syncToughness(w, data, m);
  const rest = Object.fromEntries(w.members.map((x) => [x.id, 'rest' as const]));
  passQuarter(w, data, { kind: 'camp', activities: rest });
  return { ok: true };
}

/** Sends the companion away from the party, freeing its slot; it can be called back. */
export function sendAway(w: World, memberId: string): TownResult {
  const m = member(w, memberId);
  const n = companionHere(w, m.id) ?? (m.companion?.ridden ? m.companion : undefined);
  if (!n) return no(`${m.character.name}'s companion isn't with the party.`);
  if (w.encounter) return no('Deal with the encounter first.');
  if (m.companion !== n) removeNpc(w, n.id);
  delete n.ridden;
  delete n.remount;
  m.companion = n;
  note(w, `${n.name} slips away, to wait until ${m.character.name} calls.`);
  return { ok: true };
}

/** Calls the companion back into a free NPC slot, outside a fight. */
export function callCompanion(w: World, data: GameData, memberId: string): TownResult {
  const m = member(w, memberId);
  const n = m.companion;
  if (!n || n.ridden) return no(`${m.character.name} has no companion waiting.`);
  if (n.hp <= 0) return no(`${n.name} will return at dawn.`);
  if (!awake(m)) return no(`${m.character.name} is in no state to call.`);
  if (w.encounter) return no('Deal with the encounter first.');
  if (!placeNpc(w, n, true)) return no('There is no room in the party.');
  m.companion = null;
  note(w, `${m.character.name} calls, and ${n.name} comes.`);
  syncCompanion(w, data, m);
  return { ok: true };
}

/** Release: lets the companion go for good, so another can be bound. */
export function releaseCompanion(w: World, data: GameData, memberId: string): TownResult {
  const m = member(w, memberId);
  const n = companionOf(w, m);
  if (!n) return no(`${m.character.name} has no companion.`);
  if (n.chosen) return no(`${n.name} is ${m.character.name}'s chosen friend for life.`);
  if (w.encounter) return no('Deal with the encounter first.');
  if (m.companion === n) m.companion = null;
  else removeNpc(w, n.id);
  note(w, `${m.character.name} releases ${n.name}, who goes back to the wild.`);
  syncToughness(w, data, m);
  return { ok: true };
}

/** Swift Healing outside a fight: Effort for the day heals the companion 1d6 per level. */
export function swiftHealing(w: World, data: GameData, memberId: string): TownResult {
  const m = member(w, memberId);
  const n = companionHere(w, m.id) ?? (m.companion?.ridden ? m.companion : undefined);
  if (!n) return no(`${m.character.name}'s companion isn't with the party.`);
  if (!artUsable(data, m, 'swift-healing'))
    return no(`${m.character.name} can't use Swift Healing now.`);
  if (n.hp >= n.maxHp) return no(`${n.name} isn't hurt.`);
  m.effortDay += 1;
  const healed = roll(w.rng, swiftHealingDice(characterLevel(m.character.classes))).total;
  n.hp = Math.min(n.maxHp, n.hp + healed);
  note(w, `${m.character.name} tends ${n.name}: ${healed} hit points.`);
  return { ok: true };
}

/** Names the companion anew; a beast bound mid-fight comes with its kind's name (1.5.4). */
export function renameCompanion(w: World, memberId: string, name: string): TownResult {
  const m = member(w, memberId);
  const n = companionOf(w, m);
  if (!n) return no(`${m.character.name} has no companion.`);
  const problem = nameProblem(name);
  if (problem) return no(problem);
  const old = n.name;
  n.name = name.trim();
  note(w, `${m.character.name} names ${old} ${n.name}.`);
  return { ok: true };
}
