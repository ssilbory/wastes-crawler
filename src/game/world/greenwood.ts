// The Elementalist's tree spells (Sam's calls; docs/rules-adaptation.md, Elementalist tree
// spells), modeled on the Necromancer's raisings (4.6.0): Rouse the Sapling wakes a walking sapling
// to serve, no more of them than the caster's character level, and Call the Elder Tree wakes a
// walking tree, one at a time. Either works anywhere, from the land or a carried seed; cast on the
// caster's own hurt tree of its kind, it makes it whole. The trees serve in the NPC slots, and each
// casting spends one of the day's spells.
import { characterLevel } from '../../rules/progression.ts';
import type { GameData } from '../character/context.ts';
import { cannotCast } from './casting.ts';
import { note } from './members.ts';
import { addNpc, freshName, monsterOf, npcRoom } from './npcs.ts';
import type { TownResult } from './services.ts';
import type { Member, Npc, World } from './types.ts';

/** Each tree spell and the walking tree it wakes. */
export const TREES = {
  'rouse-the-sapling': 'walking-sapling',
  'call-the-elder-tree': 'walking-tree',
} as const;
export type TreeSpell = keyof typeof TREES;

const no = (reason: string): TownResult => ({ ok: false, reason });

/** How many of a tree the caster may keep: saplings to their level, elder trees one. */
function limit(m: Member, spell: TreeSpell): number {
  return spell === 'rouse-the-sapling' ? characterLevel(m.character.classes) : 1;
}

export const treesOf = (w: World, m: Member, spell: TreeSpell): Npc[] =>
  w.npcs.filter((n) => n.kind === 'tree' && n.master === m.id && n.type === TREES[spell]);

/** Wakes a tree to serve the caster. */
export function wakeTree(w: World, data: GameData, memberId: string, spell: TreeSpell): TownResult {
  const m = w.members.find((x) => x.id === memberId);
  const why = cannotCast(data, m, spell);
  if (why) return no(why);
  const caster = m as Member;
  const tree = monsterOf(data, TREES[spell]);
  if (treesOf(w, caster, spell).length >= limit(caster, spell))
    return no(`${caster.character.name} can wake no more of them.`);
  if (!npcRoom(w, true)) return no('There is no room in the party.');
  caster.spellsCast += 1;
  const npc = addNpc(w, data, 'tree', tree.id, tree.id, freshName(w, tree.name), true) as Npc;
  npc.master = caster.id;
  note(w, `${caster.character.name} wakes a tree; ${npc.name} pulls its roots free.`);
  return { ok: true };
}

/** The spell cast on the caster's own hurt tree of its kind: it is whole again. */
export function mendTree(
  w: World,
  data: GameData,
  memberId: string,
  spell: TreeSpell,
  npcId: string,
): TownResult {
  const m = w.members.find((x) => x.id === memberId);
  const why = cannotCast(data, m, spell);
  if (why) return no(why);
  const n = treesOf(w, m as Member, spell).find((x) => x.id === npcId);
  if (!n) return no('That is not one of their trees.');
  if (n.hp >= n.maxHp) return no(`${n.name} is whole.`);
  (m as Member).spellsCast += 1;
  n.hp = n.maxHp;
  note(w, `${(m as Member).character.name} mends ${n.name}.`);
  return { ok: true };
}
