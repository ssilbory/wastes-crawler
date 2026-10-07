// The Necromancer's dead (Phase 14b; vendor/wwn-srd/4.0 Magic and Spellcasting/4.6.0 Necromancer
// Spells.md). Raise Corpse turns a corpse where the party last won a fight into a zombie or,
// stripped to the bone, a skeleton (Sam's call: two kinds); a necromancer can keep no more of them
// than their character level, and casting it on a hurt one makes it whole. Raise Grave Knight needs
// the corpse of a creature of 4 hit dice or more, one knight at a time. Command the Dead binds the
// undead of an encounter, within twice the caster's level in hit dice, each resisting with a Mental
// save at a penalty of the caster's Magic skill. The bound and raised serve in the NPC slots; each
// casting spends one of the day's spells.
import type { Monster, MonsterCombat } from '../../data/schemas/index.ts';
import { hexKey } from '../../rules/hex.ts';
import { characterLevel } from '../../rules/progression.ts';
import { rollSave } from '../../rules/saves.ts';
import { findMonster, type GameData } from '../character/context.ts';
import { classOption } from '../character/class-step.ts';
import { cannotCast, spendCast } from './casting.ts';
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

const level = (m: Member) => characterLevel(m.character.classes);
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

/** Raise Corpse: a corpse here rises as a zombie, or a skeleton. */
export function raiseCorpse(
  w: World,
  data: GameData,
  memberId: string,
  form: RaisedForm,
): TownResult {
  const m = find(w, memberId);
  const why = cannotCast(data, m, 'raise-corpse');
  if (why) return no(why);
  const caster = m as Member;
  if (corpsesHere(w).length === 0) return no('There are no corpses here.');
  if (servants(w, caster).filter(isRaised).length >= level(caster))
    return no(`${caster.character.name} can keep no more raised dead.`);
  if (!npcRoom(w, true)) return no('There is no room in the party.');
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

/** Raise Grave Knight: a corpse of 4 hit dice or more rises as the caster's one Grave Knight. */
export function raiseGraveKnight(w: World, data: GameData, memberId: string): TownResult {
  const m = find(w, memberId);
  const why = cannotCast(data, m, 'raise-grave-knight');
  if (why) return no(why);
  const caster = m as Member;
  const corpse = corpsesHere(w).findIndex((hd) => hd >= 4);
  if (corpse < 0) return no('There is no corpse of 4 hit dice or more here.');
  if (servants(w, caster).some((n) => n.type === GRAVE_KNIGHT))
    return no(`${caster.character.name} already has a Grave Knight.`);
  if (!npcRoom(w, true)) return no('There is no room in the party.');
  spendCast(data, caster, 'raise-grave-knight');
  (w.corpses as NonNullable<World['corpses']>).hitDice.splice(corpse, 1);
  serve(w, data, caster, GRAVE_KNIGHT);
  note(w, `${caster.character.name} raises a Grave Knight.`);
  return OK;
}

/**
 * Command the Dead on the encounter's undead: those within the hit dice the caster has left that
 * fail their saves are bound, joining the party while there is room and released where there is
 * none; those too strong only stand dazed. A Priest of the Lady lays the mastered to rest instead,
 * within twice their level in hit dice (Sam's call, Phase 16). Without foes left, the encounter
 * ends.
 */
export function commandTheDead(w: World, data: GameData, memberId: string): TownResult {
  const m = find(w, memberId);
  const why = cannotCast(data, m, 'command-the-dead');
  if (why) return no(why);
  const caster = m as Member;
  const e = w.encounter;
  if (!e || !e.enemies.flat().some((id) => tagged(data, id, 'undead')))
    return no('There are no undead here to command.');
  spendCast(data, caster, 'command-the-dead');
  const rest = laysToRest(data, caster);
  const bound = servants(w, caster).filter((n) => !isRaised(n) && n.type !== GRAVE_KNIGHT);
  let room =
    2 * level(caster) - (rest ? 0 : bound.reduce((sum, n) => sum + npcMonster(data, n).hitDice, 0));
  const penalty = caster.character.skills.magic ?? 0;
  const rows = e.enemies.map((row) =>
    row.filter((id) => {
      const foe = monster(data, id);
      if (!tagged(data, id, 'undead') || foe.hitDice > room) return true;
      if (rollSave(w.rng, foe.save, { modifier: -penalty }).success) return true;
      room -= foe.hitDice;
      if (rest) note(w, `${foe.name} is laid to rest in the Lady's embrace.`);
      else if (npcRoom(w, true))
        note(w, `${serve(w, data, caster, id).name} bows to ${caster.character.name}.`);
      else note(w, `A bound ${foe.name} is released for want of room, and wanders off.`);
      return false;
    }),
  );
  e.enemies = rows.filter((r) => r.length > 0);
  if (e.enemies.length === 0) {
    w.encounter = null;
    note(w, 'No foe is left standing against the party.');
  }
  return OK;
}
