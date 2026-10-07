// Bringing the party back from a fight: what each member and NPC carries out of the battle.
import { pcCombatant } from '../combat/combatants.ts';
import type { Battle, CasterState } from '../combat/types.ts';
import type { GameData } from '../character/context.ts';
import { emit } from './bus.ts';
import type { WorldBattle } from './fight.ts';
import { note, setHp } from './members.ts';
import { removeNpc } from './npcs.ts';
import type { Member, Npc, World } from './types.ts';

export function carryBack(data: GameData, m: Member, c: Battle['combatants'][number]): void {
  // Gear readied or stowed mid-fight stays where it was put, even by the fallen.
  if (c.character) m.character = { ...m.character, inventory: c.character.inventory };
  if (c.status === 'dead') {
    m.dead = true;
    setHp(m, 0);
    return;
  }
  // SRD 2.5.1: the stabilized wake ten minutes later with 1 HP and Frail.
  if (c.status === 'stable') {
    setHp(m, 1);
    m.frail = true;
  } else {
    setHp(m, Math.max(1, c.hp));
    m.frail = c.frail;
  }
  if (c.strain) {
    m.character = { ...m.character, strain: { value: c.strain.strain, broken: c.strain.broken } };
  }
  if (c.caster) {
    // The same character fights as a caster outside the battle too.
    const fresh = pcCombatant(data, m.character).caster as CasterState;
    m.spellsCast = Math.max(0, fresh.spellsLeft - c.caster.spellsLeft);
    m.pointsSpent = Math.max(0, fresh.pointsLeft - c.caster.pointsLeft);
    m.effortDay = c.caster.effortDay;
    m.artUses = { ...c.caster.uses };
  }
}

/** NPC hit points come back from the fight; the dead are gone. True if anyone died. */
export function npcsBack(w: World, data: GameData, fight: WorldBattle): boolean {
  let lost = false;
  fight.npcIds.forEach((id, i) => {
    const c = fight.battle.combatants[fight.memberIds.length + i] as Battle['combatants'][number];
    const n = w.npcs.find((x) => x.id === id) as Npc;
    if (c.status !== 'dead') {
      n.hp = c.hp;
      return;
    }
    lost = true;
    removeNpc(w, id);
    note(w, n.kind === 'captive' ? `${n.name} is killed; the rescue is lost.` : `${n.name} dies.`);
    emit(w, data, { kind: 'npc-died', npc: n });
  });
  return lost;
}
