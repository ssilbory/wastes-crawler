// A Beastmaster's companion through the night (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class
// List/1.5.4 The Beastmaster.md; docs/rules-adaptation.md, The Beastmaster). A companion whose
// master is dead or out of the party goes off to wait for them; a companion sent away rests and
// heals its hit dice; a Chosen Friend that fell comes back at dawn, whole, at its master's side.
import type { GameData } from '../character/context.ts';
import { naturalHitDice } from './companion-sync.ts';
import { note } from './members.ts';
import { placeNpc, removeNpc } from './npcs.ts';
import type { World } from './types.ts';

export function nightForCompanions(w: World, data: GameData, rested: boolean): void {
  const everyone = [...w.members, ...w.benched];
  const left = new Set<string>();
  for (const n of w.npcs.filter((x) => x.kind === 'companion')) {
    const master = everyone.find((m) => m.id === n.master);
    if (master && !master.dead && w.members.includes(master)) continue;
    removeNpc(w, n.id);
    if (!master) continue;
    master.companion = n;
    left.add(n.id);
    note(w, `${n.name} slips away to wait for ${master.character.name}.`);
  }
  for (const m of everyone) {
    const n = m.companion;
    if (!n || left.has(n.id)) continue;
    if (n.ridden && n.hp > 0 && !m.dead && w.members.includes(m)) {
      // Ridden, it heals as NPCs with the party do: on a fed, sheltered night (Mounts).
      if (rested) n.hp = Math.min(n.maxHp, n.hp + (n.hitDice ?? naturalHitDice(data, n)));
      continue;
    }
    // Its rider gone, a ridden companion goes off to wait (only the living are ever ridden).
    if (n.ridden) {
      delete n.ridden;
      note(w, `${n.name} slips away to wait for ${m.character.name}.`);
    }
    if (n.hp > 0) {
      n.hp = Math.min(n.maxHp, n.hp + (n.hitDice ?? naturalHitDice(data, n)));
      continue;
    }
    // Only a Chosen Friend is ever kept at 0 hit points (carry-back.ts).
    n.hp = n.maxHp;
    const here = !m.dead && w.members.includes(m) && placeNpc(w, n, true);
    if (here) m.companion = null;
    note(
      w,
      here
        ? `With the dawn ${n.name} is at ${m.character.name}'s side again.`
        : `With the dawn ${n.name} is whole again, waiting for ${m.character.name}.`,
    );
  }
}
