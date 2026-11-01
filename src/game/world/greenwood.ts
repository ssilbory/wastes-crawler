// The Elementalist's tree spells (Sam's calls; docs/rules-adaptation.md, Elementalist tree
// spells), modeled on the Necromancer's raisings (4.6.0): Rouse the Sapling wakes a walking sapling
// to serve, no more of them than the caster's character level, and Call the Elder Tree wakes a
// walking tree, one at a time. Either works anywhere, from the land or a carried seed; cast on the
// caster's own hurt tree of its kind, it makes it whole. The trees serve in the NPC slots, and each
// casting spends one of the day's spells.
import type { GameData } from '../character/context.ts';
import { cannotCast, castLevel, spendCast } from './casting.ts';
import { alive, note } from './members.ts';
import { addNpc, freshName, monsterOf, npcRoom, removeNpc } from './npcs.ts';
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
  return spell === 'rouse-the-sapling' ? castLevel(m, spell) : 1;
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
  spendCast(data, caster, spell);
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
  spendCast(data, m as Member, spell);
  n.hp = n.maxHp;
  note(w, `${(m as Member).character.name} mends ${n.name}.`);
  return { ok: true };
}

/** At nightfall, trees whose caster is dead or gone from the party root where they stand. */
export function nightForTrees(w: World): void {
  for (const n of w.npcs.filter((x) => x.kind === 'tree')) {
    if (alive(w).some((m) => m.id === n.master)) continue;
    removeNpc(w, n.id);
    note(w, `With no one to follow, ${n.name} roots where it stands.`);
  }
}
