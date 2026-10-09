// PCs a trap brings to zero (docs/rules-adaptation.md, Falling to a trap): they lie Mortally
// Wounded, and the party tends them as after a won fight, with Heal checks, aid, and healing magic
// (vendor/wwn-srd/2.0 The Rules of the Game/2.5.0 Injury, Healing, And System Strain.md, 2.5.1).
// A member at 0 HP who is neither dead nor being revived is one of these.
import type { BattleResult } from '../combat/battle.ts';
import { concludeBattle, firstRescue, type RescueDecider } from '../combat/aftermath.ts';
import { fall } from '../combat/damage.ts';
import type { Combatant } from '../combat/types.ts';
import type { GameData } from '../character/context.ts';
import { carryBack, npcsBack } from '../world/carry-back.ts';
import { battleFrom, partySetup, type WorldBattle } from '../world/fight.ts';
import { recordFallen } from '../world/healer.ts';
import { alive, note } from '../world/members.ts';
import { wipe } from '../world/town.ts';
import type { Member, World } from '../world/types.ts';

/** Members a trap left at zero, waiting for the others' care. */
export const trapFallen = (w: World): Member[] =>
  alive(w).filter((m) => !m.reviving && m.character.hp.current <= 0);

/**
 * The party, fallen and all, with its NPCs, in a fight already won and without foes: the fallen go
 * down as in a fight, so the Frail die and those who stabilize on their own do.
 */
export function tendingBattle(w: World, data: GameData): WorldBattle {
  const party = alive(w).filter((m) => !m.reviving);
  const npcs = w.npcs.filter((n) => n.hp > 0);
  const setup = partySetup(w, data, [], true, [], party);
  const battle = battleFrom(data, w.rng, setup, true);
  battle.outcome = 'party';
  // No one rolls initiative over the fallen.
  if (battle.log) battle.log.length = 0;
  party.forEach((m, i) => {
    if (m.character.hp.current > 0) return;
    const c = battle.combatants[i] as Combatant;
    Object.assign(c, { hp: 0, status: 'active' });
    fall(battle, c);
  });
  return {
    battle,
    setup,
    memberIds: party.map((m) => m.id),
    npcIds: npcs.map((n) => n.id),
    mountIds: [],
    enemies: [],
    captive: null,
    quest: null,
    garrison: null,
    patrol: null,
  };
}

/** Writes the tending back: the saved wake Frail at 1 HP, and if no one is left, the party falls. */
export function applyTending(w: World, data: GameData, fight: WorldBattle): void {
  fight.memberIds.forEach((id, i) => {
    const m = w.members.find((x) => x.id === id) as Member;
    carryBack(data, m, fight.battle.combatants[i] as Combatant);
  });
  recordFallen(w, fight.memberIds, fight.battle);
  npcsBack(w, data, fight);
  for (const m of w.members.filter((x) => fight.memberIds.includes(x.id)))
    if (m.dead) note(w, `${m.character.name} dies.`);
  if (alive(w).length === 0) wipe(w, data);
}

/** Tends the trap's fallen with no one to ask: the first healing on offer, then Heal checks. */
export function tendTrapFallen(
  w: World,
  data: GameData,
  decide: RescueDecider = firstRescue,
): BattleResult | null {
  if (trapFallen(w).length === 0) return null;
  const fight = tendingBattle(w, data);
  const result = concludeBattle(fight.battle, decide);
  applyTending(w, data, fight);
  return result;
}
