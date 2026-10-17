import { describe, expect, it } from 'vitest';
import { springHere } from '../../../src/game/dungeon/traps.ts';
import { tendingBattle, trapFallen } from '../../../src/game/dungeon/trap-falls.ts';
import { setHp } from '../../../src/game/world/members.ts';
import { addNpc } from '../../../src/game/world/npcs.ts';
import type { Npc } from '../../../src/game/world/types.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, member } from '../world/helpers.ts';
import { below, place } from './helpers.ts';

/** The barrow's dart trap with no save, so it always hits. */
const sure = {
  ...data,
  content: {
    ...data.content,
    dungeons: data.content.dungeons.map((d) => ({
      ...d,
      levels: d.levels.map((l) => ({ ...l, traps: l.traps.map((t) => ({ ...t, save: null })) })),
    })),
  },
};

describe('tending a trap’s fallen (docs/rules-adaptation.md, Falling to a trap)', () => {
  it('brings the living NPCs along, leaves the dead out, and starts with a clean log', () => {
    const w = place(below(), 'barrow-upper', 4, 6, 'n');
    for (const m of w.members) if (m.character.name !== 'Grukk') m.dead = true;
    setHp(member(w, 'Grukk'), 1);
    const guard = addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'Aldo', true) as Npc;
    const lost = addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'Bram', true) as Npc;
    lost.hp = 0;
    w.rng = scriptedRng([6, 6]);
    springHere(w, sure);
    expect(trapFallen(w).map((m) => m.character.name)).toEqual(['Grukk']);
    w.rng = createRng('tend');
    const fight = tendingBattle(w, data);
    expect(fight.npcIds).toEqual([guard.id]);
    expect(fight.memberIds).toEqual([member(w, 'Grukk').id]);
    expect(fight.battle.outcome).toBe('party');
    expect(fight.battle.log).toEqual(['Round 1: Grukk falls, mortally wounded.']);
  });
});
