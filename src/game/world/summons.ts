// Summoned servants (Phase 18a; Calculation of the Phantasmal Eidolon in vendor/wwn-srd/4.0 Magic
// and Spellcasting/4.4.0 High Magic Spells by Level.md): one still standing after its fight follows
// the party in an NPC slot until dawn, when it fades.
import type { GameData } from '../character/context.ts';
import type { WorldBattle } from './fight.ts';
import { note } from './members.ts';
import { addNpc, removeNpc } from './npcs.ts';
import type { World } from './types.ts';

export function keepSummons(w: World, data: GameData, fight: WorldBattle): void {
  for (const c of fight.battle.combatants) {
    if (!c.summoned || c.status === 'dead' || c.side !== 'party') continue;
    const by = c.summoned.by;
    const master = fight.memberIds[fight.battle.combatants.findIndex((x) => x.id === by)];
    const { monster } = c.summoned;
    // One to a caster at a time: the new servant takes the old one's place (the Guardian, 4.5.0).
    const one = data.content.combatMagic.some(
      (m) => m.effect.kind === 'summon' && m.effect.monster === monster && m.effect.one,
    );
    const older = w.npcs.filter(
      (n) => one && n.kind === 'summon' && n.type === monster && n.master === master,
    );
    for (const old of older) {
      removeNpc(w, old.id);
      note(w, `${old.name} fades as another takes its place.`);
    }
    const npc = addNpc(w, data, 'summon', monster, monster, c.name, true);
    if (!npc) {
      note(w, `${c.name} fades, with no room to follow the party.`);
      continue;
    }
    Object.assign(npc, { hp: Math.max(1, c.hp), maxHp: c.maxHp, master });
    note(w, `${c.name} follows the party until dawn.`);
  }
}

/** At dawn every summoned servant fades. */
export function dawnTakesSummons(w: World): void {
  for (const n of w.npcs.filter((x) => x.kind === 'summon')) {
    removeNpc(w, n.id);
    note(w, `${n.name} fades with the dawn.`);
  }
}
