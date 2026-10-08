// A Beastmaster's companion going into a fight and coming out of it (vendor/wwn-srd/1.0 Character
// Creation/1.5.0 Class List/1.5.4 The Beastmaster.md; docs/rules-adaptation.md, The Beastmaster):
// what the engine needs to know of it, a beast bound mid-fight joining the party, and a companion
// that answered a Howl of Distant Summons going back to the party or to waiting.
import type { NpcSetup } from '../combat/battle.ts';
import type { Combatant, WaitingCompanion } from '../combat/types.ts';
import type { GameData } from '../character/context.ts';
import { naturalHitDice, sharesVitality, syncCompanion, syncToughness } from './companion-sync.ts';
import type { WorldBattle } from './fight.ts';
import { note } from './members.ts';
import { addNpc, monsterOf, placeNpc } from './npcs.ts';
import type { Member, Npc, World } from './types.ts';

/** A companion in the party's line-up, its master by party index. */
export function companionSetup(
  data: GameData,
  m: Member,
  n: Npc,
  master: number,
): NonNullable<NpcSetup['companion']> {
  return {
    master,
    chosen: n.chosen === true,
    shared: sharesVitality(m, n),
    hitDice: n.hitDice ?? naturalHitDice(data, n),
  };
}

/** A companion sent away and able to answer a howl: alive, not a Chosen Friend gone till dawn. */
export function waitingSetup(data: GameData, m: Member): WaitingCompanion | null {
  const n = m.companion;
  if (!n || n.hp <= 0) return null;
  return {
    monster: n.type,
    name: n.name,
    hp: n.hp,
    maxHp: n.maxHp,
    hitDice: n.hitDice ?? naturalHitDice(data, n),
    chosen: n.chosen === true,
    shared: sharesVitality(m, n),
  };
}

const boundIn = (fight: WorldBattle) => fight.battle.combatants.filter((c) => Boolean(c.bound));

/** The enemy rows without the beasts bound mid-fight: what was slain or driven off. */
export function unbound(fight: WorldBattle): string[][] {
  const rows = fight.enemies.map((r) => [...r]);
  for (const c of boundIn(fight)) {
    const row = rows.find((r) => r.includes(c.monster as string));
    row?.splice(row.indexOf(c.monster as string), 1);
  }
  return rows.filter((r) => r.length > 0);
}

/** The member a party combatant id (`pc-N`) stands for. */
const memberFor = (w: World, fight: WorldBattle, id: string): Member | undefined => {
  const at = fight.battle.combatants.findIndex((c) => c.id === id);
  return w.members.find((m) => m.id === fight.memberIds[at]);
};

/** Bound beasts join their masters, and howled companions go back where they belong. */
export function companionsBack(w: World, data: GameData, fight: WorldBattle): void {
  for (const c of boundIn(fight)) {
    const m = c.bound && memberFor(w, fight, c.bound.by);
    if (m && c.side === 'party' && c.status !== 'dead') keepBound(w, data, m, c);
  }
  for (const c of fight.battle.combatants.filter(
    (x) => x.companion && !x.bound && x.id.startsWith('howl-'),
  )) {
    const m = c.companion && memberFor(w, fight, c.companion.master);
    if (m?.companion) howledBack(w, data, m, c);
  }
}

/** A beast bound in the fight is the master's companion now: in a free slot, or waiting nearby. */
function keepBound(w: World, data: GameData, m: Member, c: Combatant): void {
  const monster = c.monster as string;
  const hp = Math.max(1, c.hp);
  const npc = addNpc(w, data, 'companion', monster, monster, c.name, true);
  if (npc) Object.assign(npc, { hp, maxHp: c.maxHp, master: m.id });
  else
    m.companion = {
      id: 'away',
      kind: 'companion',
      type: monster,
      name: c.name,
      hp,
      maxHp: c.maxHp,
      row: 0,
      column: 0,
      quitting: false,
      inventory: [],
      owed: 0,
      refund: 0,
      master: m.id,
    };
  const kind = monsterOf(data, monster).name;
  note(
    w,
    npc
      ? `The ${kind} follows ${m.character.name} now as a companion.`
      : `The ${kind} is ${m.character.name}'s companion now, waiting until there is room.`,
  );
  syncCompanion(w, data, m);
  syncToughness(w, data, m);
}

/** A howled companion: dead, back at its master's side if it fought, or still waiting. */
function howledBack(w: World, data: GameData, m: Member, c: Combatant): void {
  const n = m.companion as Npc;
  if (c.status === 'dead') {
    if (n.chosen) {
      n.hp = 0;
      note(w, `${n.name} fades away; it will be back with the dawn.`);
      return;
    }
    m.companion = null;
    note(w, `${n.name} dies.`);
    syncToughness(w, data, m);
    return;
  }
  n.hp = c.status === 'stable' ? Math.max(1, c.hp) : c.hp;
  // One that never got into the line goes back to waiting.
  if (c.status === 'out' || !placeNpc(w, n, true)) return;
  m.companion = null;
}
