import { describe, expect, it } from 'vitest';
import { act } from '../../../src/game/combat/actions.ts';
import type { Battle, Combatant } from '../../../src/game/combat/types.ts';
import { companionHere, companionOf } from '../../../src/game/world/companions.ts';
import { applyBattle, encounterBattle, type WorldBattle } from '../../../src/game/world/fight.ts';
import { addNpc, MAX_NPCS } from '../../../src/game/world/npcs.ts';
import type { Member, Npc, World } from '../../../src/game/world/types.ts';
import { beastmaster } from '../beastmaster.ts';
import { data, encounter, member, world } from './helpers.ts';

/** Snag as a Ranger with the given arts, in the party. */
function ranger(w: World, arts: string[] = []): Member {
  const m = member(w, 'Snag');
  m.character = { ...beastmaster(arts, 3), id: m.character.id, hp: { max: 20, current: 20 } };
  return m;
}

/** Bramble, a herd beast companion of `m`, in the party. */
function bramble(w: World, m: Member, over: Partial<Npc> = {}): Npc {
  const n = addNpc(w, data, 'companion', 'herd-beast', 'herd-beast', 'Bramble', true) as Npc;
  Object.assign(n, { master: m.id, hp: 9, maxHp: 9, ...over });
  return n;
}

const won = (fight: WorldBattle) => ({
  outcome: 'party' as const,
  rounds: 2,
  deaths: 0,
  battle: fight.battle,
});

const party = (b: Battle) => b.combatants.filter((c) => c.side === 'party');
const snagIn = (b: Battle) => party(b)[0] as Combatant;

describe('a companion going into a fight (1.5.4)', () => {
  it('fights beside its master, who can’t bind another', () => {
    const w = world();
    const m = ranger(w, ['shared-vitality']);
    bramble(w, m, { hitDice: 3 });
    w.encounter = encounter([['human-raider']]);
    const { battle } = encounterBattle(w, data);
    const pet = battle.combatants.find((c) => c.name === 'Bramble');
    expect(pet?.companion).toEqual({ master: snagIn(battle).id, chosen: false, shared: true });
    expect(pet?.hitDice).toBe(3);
    expect(snagIn(battle).canBind).toBe(false);
  });

  it('waits outside, for a howl, when sent away', () => {
    const w = world();
    const m = ranger(w, ['howl-of-distant-summons']);
    m.companion = { ...bramble(w, m), id: 'away' };
    w.npcs = [];
    w.encounter = encounter([['human-raider']]);
    const { battle } = encounterBattle(w, data);
    expect(snagIn(battle).waiting).toMatchObject({ name: 'Bramble', hp: 9 });
  });
});

describe('a companion coming out of a fight (1.5.4)', () => {
  it('keeps a beast bound mid-fight as the master’s companion, and it is no loot', () => {
    const w = world();
    const m = ranger(w);
    w.encounter = encounter([['herd-beast', 'human-raider']]);
    const fight = encounterBattle(w, data);
    const b = fight.battle;
    const beast = b.combatants.find((c) => c.monster === 'herd-beast') as Combatant;
    beast.saves.mental = 99;
    act(b, snagIn(b), { kind: 'bind', target: beast.id });
    for (const c of b.combatants.filter((x) => x.side === 'enemy')) c.status = 'dead';
    b.outcome = 'party';
    applyBattle(w, data, fight, won(fight), null);
    expect(companionHere(w, m.id)).toMatchObject({ type: 'herd-beast', name: 'Herd Beast' });
    // Only the raider is left lying there.
    expect(w.corpses?.hitDice).toHaveLength(1);
  });

  it('keeps it waiting when the NPC slots are full', () => {
    const w = world();
    const m = ranger(w);
    w.encounter = encounter([['herd-beast']]);
    const fight = encounterBattle(w, data);
    const b = fight.battle;
    const beast = b.combatants.find((c) => c.monster === 'herd-beast') as Combatant;
    beast.saves.mental = 99;
    act(b, snagIn(b), { kind: 'bind', target: beast.id });
    b.outcome = 'party';
    for (let i = 0; i < MAX_NPCS; i++)
      addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', null, true);
    applyBattle(w, data, fight, won(fight), null);
    expect(m.companion).toMatchObject({ type: 'herd-beast', kind: 'companion' });
  });

  it('sends a fallen Chosen Friend away until dawn, and buries any other', () => {
    for (const chosen of [true, false]) {
      const w = world();
      const m = ranger(w);
      bramble(w, m, chosen ? { chosen: true } : {});
      w.encounter = encounter([['human-raider']]);
      const fight = encounterBattle(w, data);
      const pet = fight.battle.combatants.find((c) => c.name === 'Bramble') as Combatant;
      pet.status = 'dead';
      fight.battle.outcome = 'party';
      applyBattle(w, data, fight, won(fight), null);
      expect(w.npcs.some((n) => n.kind === 'companion')).toBe(false);
      expect(companionOf(w, m)?.hp).toBe(chosen ? 0 : undefined);
    }
  });

  it('brings a howled companion back into the party, or back to waiting', () => {
    const w = world();
    const m = ranger(w, ['howl-of-distant-summons']);
    m.companion = { ...bramble(w, m), id: 'away' };
    w.npcs = [];
    w.encounter = encounter([['human-raider']]);
    const fight = encounterBattle(w, data);
    const b = fight.battle;
    act(b, snagIn(b), { kind: 'howl' });
    const pet = b.combatants.find((c) => c.name === 'Bramble') as Combatant;
    Object.assign(pet, { status: 'active', hp: 4 });
    b.outcome = 'party';
    applyBattle(w, data, fight, won(fight), null);
    expect(companionHere(w, m.id)?.hp).toBe(4);
    expect(m.companion).toBeNull();
  });
});
