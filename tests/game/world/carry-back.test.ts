import { describe, expect, it } from 'vitest';
import type { Combatant } from '../../../src/game/combat/types.ts';
import { npcsBack } from '../../../src/game/world/carry-back.ts';
import type { WorldBattle } from '../../../src/game/world/fight.ts';
import type { Npc } from '../../../src/game/world/types.ts';
import { data, world } from './helpers.ts';

const npc = (id: string, kind: Npc['kind'], master?: string): Npc => ({
  id,
  kind,
  type: 'herd-beast',
  name: id === 'npc-0' ? 'Bramble' : 'Thorn',
  hp: 9,
  maxHp: 9,
  row: 0,
  column: 1,
  quitting: false,
  inventory: [],
  owed: 0,
  refund: 0,
  ...(master ? { master } : {}),
});

/** A won fight with only NPCs in it, each ending as given. */
const fight = (ends: Pick<Combatant, 'status' | 'hp'>[], npcIds: string[]) =>
  ({ memberIds: [], npcIds, battle: { combatants: ends } }) as unknown as WorldBattle;

describe('NPCs back from a fight', () => {
  it('brings a companion Shared Vitality stabilized round with 1 hit point (1.5.4)', () => {
    const w = world();
    w.npcs = [npc('npc-0', 'companion', 'm-0')];
    expect(npcsBack(w, data, fight([{ status: 'stable', hp: 0 }], ['npc-0']))).toBe(false);
    expect(w.npcs[0]?.hp).toBe(1);
  });

  it('loses a fallen companion whose master is gone, with no master to weaken', () => {
    const w = world();
    w.npcs = [npc('npc-1', 'companion', 'm-9')];
    expect(npcsBack(w, data, fight([{ status: 'dead', hp: 0 }], ['npc-1']))).toBe(true);
    expect(w.npcs).toEqual([]);
    expect(w.log.at(-1)).toContain('Thorn dies.');
  });
});
