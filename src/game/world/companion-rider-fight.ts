// A ridden companion coming out of a fight (docs/rules-adaptation.md, Mounts: Sam's call; vendor/
// wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.4 The Beastmaster.md): its hit points come
// back as an NPC's do; a fallen Chosen Friend fades until dawn, and any other dies.
import type { Battle } from '../combat/types.ts';
import type { GameData } from '../character/context.ts';
import { unseat } from './companion-mounts.ts';
import { syncToughness } from './companion-sync.ts';
import type { WorldBattle } from './fight.ts';
import { note } from './members.ts';
import type { Member, Npc, World } from './types.ts';

export function riddenBack(w: World, data: GameData, fight: WorldBattle): void {
  const first = fight.memberIds.length + fight.npcIds.length;
  fight.riddenIds.forEach((id, i) => {
    const c = fight.battle.combatants[first + i] as Battle['combatants'][number];
    const m = w.members.find((x) => x.id === id) as Member;
    const n = m.companion as Npc;
    if (c.status !== 'dead') {
      // A companion Shared Vitality stabilized comes round with 1 hit point (1.5.4).
      n.hp = c.status === 'stable' ? Math.max(1, c.hp) : c.hp;
      return;
    }
    if (n.chosen) {
      n.hp = 0;
      unseat(n);
      note(w, `${n.name} fades away; it will be back with the dawn.`);
      return;
    }
    m.companion = null;
    note(w, `${n.name} dies.`);
    syncToughness(w, data, m);
  });
}
