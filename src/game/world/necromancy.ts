// The Necromancer's dead (Phase 14b; vendor/wwn-srd/4.0 Magic and Spellcasting/4.6.0 Necromancer
// Spells.md). Raise Corpse turns a corpse where the party last won a fight into a zombie or,
// stripped to the bone, a skeleton (Sam's call: two kinds); a necromancer can keep no more of them
// than their character level, and casting it on a hurt one makes it whole. Raise Grave Knight needs
// the corpse of a creature of 4 hit dice or more, one knight at a time. Command the Dead binds the
// undead of an encounter, within twice the caster's level in hit dice, each resisting with a Mental
// save at a penalty of the caster's Magic skill; one that fails but is only partly within the hit
// dice left stands dazed, losing its first turn in the fight. The bound and raised serve in the
// NPC slots; each casting spends one of the day's spells.
import type { Monster, MonsterCombat } from '../../data/schemas/index.ts';
import { hexKey } from '../../rules/hex.ts';
import { rollSave } from '../../rules/saves.ts';
import type { Battle } from '../combat/types.ts';
import { findMonster, type GameData } from '../character/context.ts';
import { classOption } from '../character/class-step.ts';
import { cannotCast, castLevel, spendCast } from './casting.ts';
import { note } from './members.ts';
import { addNpc, freshName, GRAVE_KNIGHT, npcMonster, npcRoom } from './npcs.ts';
import type { TownResult } from './services.ts';
import type { Member, Npc, World } from './types.ts';

export const RAISED = { zombie: 'raised-zombie', skeleton: 'raised-skeleton' } as const;
export type RaisedForm = keyof typeof RAISED;

const OK: TownResult = { ok: true };
const no = (reason: string): TownResult => ({ ok: false, reason });

/** Where the party stands: a dungeon cell below ground, a hex above. */
export function placeKey(w: World): string {
  const d = w.dungeon;
  return d ? `${d.dungeon}/${d.level}/${d.at.x},${d.at.y}` : `${w.region}/${hexKey(w.position)}`;
}

const monster = (data: GameData, id: string) => findMonster(data, id) as Monster;
// Content checks give every monster a combat entry.
const tagged = (data: GameData, id: string, tag: 'unliving' | 'undead') =>
  (data.content.monsterCombat.find((c) => c.id === id) as MonsterCombat).tags.includes(tag);

/**
 * After a won fight, the slain that were ever alive lie where it was fought, dated to today; fresh
 * corpses can be questioned even where older ones already were.
 */
export function leaveCorpses(w: World, data: GameData, enemies: string[][]): void {
  const fallen = enemies
    .flat()
    .filter((id) => !tagged(data, id, 'unliving'))
    .map((id) => monster(data, id).hitDice);
  if (fallen.length === 0) return;
  const at = placeKey(w);
  const already = w.corpses?.at === at ? w.corpses.hitDice : [];
  w.corpses = { at, hitDice: [...already, ...fallen], day: w.day, queried: false };
}

/** The hit dice of the corpses lying where the party stands. */
export const corpsesHere = (w: World): number[] =>
  w.corpses?.at === placeKey(w) ? w.corpses.hitDice : [];

const servants = (w: World, m: Member) =>
  w.npcs.filter((n) => n.kind === 'undead' && n.master === m.id);
const isRaised = (n: Npc) => Object.values<string>(RAISED).includes(n.type);

function serve(w: World, data: GameData, m: Member, type: string): Npc {
  const npc = addNpc(w, data, 'undead', type, type, freshName(w, monster(data, type).name), true);
  // Callers check for room first.
  (npc as Npc).master = m.id;
  return npc as Npc;
}

const find = (w: World, id: string) => w.members.find((x) => x.id === id);

/** A Priest of the Lady sends the undead to their rest rather than binding them (Phase 16). */
const laysToRest = (data: GameData, m: Member) =>
  Object.entries(m.character.classes.levels).some(
    ([id, l]) => l >= 1 && classOption(data, id)?.mage?.laysToRest,
  );

/**
 * Why the member can't raise a corpse here now, or null if they can: the spell, a corpse, the
 * raised dead they may keep, and room in the party.
 */
export function cannotRaise(w: World, data: GameData, m: Member | undefined): string | null {
  const why = cannotCast(data, m, 'raise-corpse');
  if (why) return why;
  const caster = m as Member;
  if (corpsesHere(w).length === 0) return 'There are no corpses here.';
  if (servants(w, caster).filter(isRaised).length >= castLevel(caster, 'raise-corpse'))
    return `${caster.character.name} can keep no more raised dead.`;
  if (!npcRoom(w, true)) return 'There is no room in the party.';
  return null;
}

/** Raise Corpse: a corpse here rises as a zombie, or a skeleton. */
export function raiseCorpse(
  w: World,
  data: GameData,
  memberId: string,
  form: RaisedForm,
): TownResult {
  const m = find(w, memberId);
  const why = cannotRaise(w, data, m);
  if (why) return no(why);
  const caster = m as Member;
  spendCast(data, caster, 'raise-corpse');
  (w.corpses as NonNullable<World['corpses']>).hitDice.shift();
  const npc = serve(w, data, caster, RAISED[form]);
  note(w, `${caster.character.name} raises a corpse; ${npc.name} stands.`);
  return OK;
}

/** Raise Corpse cast again on one of the caster's own: it is whole again. */
export function mendCorpse(w: World, data: GameData, memberId: string, npcId: string): TownResult {
  const m = find(w, memberId);
  const why = cannotCast(data, m, 'raise-corpse');
  if (why) return no(why);
  const n = w.npcs.find((x) => x.id === npcId);
  if (!n || n.master !== memberId || !isRaised(n))
    return no('That is not one of their raised dead.');
  if (n.hp >= n.maxHp) return no(`${n.name} is whole.`);
  spendCast(data, m as Member, 'raise-corpse');
  n.hp = n.maxHp;
  note(w, `${(m as Member).character.name} mends ${n.name}.`);
  return OK;
}

/**
 * Why the member can't raise a Grave Knight here now, or null if they can: the spell, a corpse of
 * 4 hit dice or more, having none already, and room in the party.
 */
export function cannotRaiseKnight(w: World, data: GameData, m: Member | undefined): string | null {
  const why = cannotCast(data, m, 'raise-grave-knight');
  if (why) return why;
  const caster = m as Member;
  if (!corpsesHere(w).some((hd) => hd >= 4))
    return 'There is no corpse of 4 hit dice or more here.';
  if (servants(w, caster).some((n) => n.type === GRAVE_KNIGHT))
    return `${caster.character.name} already has a Grave Knight.`;
  if (!npcRoom(w, true)) return 'There is no room in the party.';
  return null;
}

/** Raise Grave Knight: a corpse of 4 hit dice or more rises as the caster's one Grave Knight. */
export function raiseGraveKnight(w: World, data: GameData, memberId: string): TownResult {
  const m = find(w, memberId);
  const why = cannotRaiseKnight(w, data, m);
  if (why) return no(why);
  const caster = m as Member;
  const corpse = corpsesHere(w).findIndex((hd) => hd >= 4);
  spendCast(data, caster, 'raise-grave-knight');
  (w.corpses as NonNullable<World['corpses']>).hitDice.splice(corpse, 1);
  serve(w, data, caster, GRAVE_KNIGHT);
  note(w, `${caster.character.name} raises a Grave Knight.`);
  return OK;
}

/**
 * Command the Dead on the encounter's undead: those within the hit dice the caster has left that
 * fail their saves are bound, joining the party while there is room and released where there is
 * none. One that fails but has more hit dice than are left is only partly bewitched: it takes the
 * rest of them and stands dazed, losing its first turn when the fight starts (SRD 4.6.0). A Priest
 * of the Lady lays the mastered to rest instead, within twice their level in hit dice (Sam's call,
 * Phase 16). Without foes left, the encounter ends.
 */
export function commandTheDead(w: World, data: GameData, memberId: string): TownResult {
  const m = find(w, memberId);
  const why = cannotCast(data, m, 'command-the-dead');
  if (why) return no(why);
  const caster = m as Member;
  const e = w.encounter;
  if (!e || !e.enemies.flat().some((id) => tagged(data, id, 'undead')))
    return no('There are no undead here to command.');
  // A scroll's level counts, read before the scroll is spent (Phase 21).
  const level = castLevel(caster, 'command-the-dead');
  spendCast(data, caster, 'command-the-dead');
  const rest = laysToRest(data, caster);
  const bound = servants(w, caster).filter((n) => !isRaised(n) && n.type !== GRAVE_KNIGHT);
  let room =
    2 * level - (rest ? 0 : bound.reduce((sum, n) => sum + npcMonster(data, n).hitDice, 0));
  const penalty = caster.character.skills.magic ?? 0;
  const dazed: Record<string, number> = { ...e.dazed };
  const rows = e.enemies.map((row) =>
    row.filter((id) => {
      const foe = monster(data, id);
      if (!tagged(data, id, 'undead') || room <= 0) return true;
      if (rollSave(w.rng, foe.save, { modifier: -penalty }).success) return true;
      if (foe.hitDice > room) {
        room = 0;
        dazed[id] = (dazed[id] ?? 0) + 1;
        note(w, `The ${foe.name} stands dazed under ${caster.character.name}'s will.`);
        return true;
      }
      room -= foe.hitDice;
      if (rest) note(w, `${foe.name} is laid to rest in the Lady's embrace.`);
      else if (npcRoom(w, true))
        note(w, `${serve(w, data, caster, id).name} bows to ${caster.character.name}.`);
      else note(w, `A bound ${foe.name} is released for want of room, and wanders off.`);
      return false;
    }),
  );
  e.enemies = rows.filter((r) => r.length > 0);
  // No more dazed of a kind than stand there, cast as often as it may be.
  const left = (id: string) => e.enemies.flat().filter((x) => x === id).length;
  const counts = Object.entries(dazed).map(([id, n]) => [id, Math.min(n, left(id))] as const);
  const kept = counts.filter(([, n]) => n > 0);
  if (kept.length > 0) e.dazed = Object.fromEntries(kept);
  if (e.enemies.length === 0) {
    w.encounter = null;
    note(w, 'No foe is left standing against the party.');
  }
  return OK;
}

/** The undead Command the Dead left dazed lose their first turn: they start the fight stunned. */
export function dazeCommanded(b: Battle, dazed: Readonly<Record<string, number>> = {}): void {
  const left = { ...dazed };
  for (const c of b.combatants) {
    const n = c.side === 'enemy' && c.monster ? (left[c.monster] ?? 0) : 0;
    if (n === 0) continue;
    left[c.monster as string] = n - 1;
    c.stunned = true;
  }
}
