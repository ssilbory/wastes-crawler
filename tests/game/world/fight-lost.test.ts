import { describe, expect, it } from 'vitest';
import { applyBattle, partyBattle } from '../../../src/game/world/fight.ts';
import { addNpc } from '../../../src/game/world/npcs.ts';
import type { Member, Npc, World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { beastmaster } from '../beastmaster.ts';
import { data, member, world } from './helpers.ts';

/** Snag as a Beastmaster with Bramble the aurochs in the party at the given hit points. */
function withCompanion(hp: number, chosen: boolean): { w: World; snag: Member; n: Npc } {
  const w = world();
  const snag = member(w, 'Snag');
  snag.character = { ...beastmaster(), id: snag.character.id };
  const n = addNpc(w, data, 'companion', 'wild-aurochs', 'wild-aurochs', 'Bramble', true) as Npc;
  Object.assign(n, { master: snag.id, hp }, chosen ? { chosen: true } : {});
  return { w, snag, n };
}

/** Loses a fight the companion sat out. */
function lose(w: World): void {
  w.rng = createRng('lost');
  const fight = partyBattle(w, data, [['thug-or-militia']], false, null);
  applyBattle(
    w,
    data,
    fight,
    { outcome: 'enemy', rounds: 1, deaths: 0, battle: fight.battle },
    null,
  );
}

describe('a lost fight sends a companion into the wilds (1.5.4)', () => {
  it('with at least 1 hit point, to be called again', () => {
    const { w, snag } = withCompanion(0, false);
    lose(w);
    expect(w.npcs).toEqual([]);
    expect(snag.companion).toMatchObject({ name: 'Bramble', hp: 1 });
    expect(w.log.join('\n')).toContain('Bramble flees into the wilds.');
  });

  it('keeps a wounded Chosen Friend’s hit points as they were', () => {
    const { w, snag } = withCompanion(3, true);
    lose(w);
    expect(snag.companion).toMatchObject({ name: 'Bramble', hp: 3, chosen: true });
  });

  it('lets a fallen Chosen Friend stay down until the dawn', () => {
    const { w, snag } = withCompanion(0, true);
    lose(w);
    expect(snag.companion).toMatchObject({ name: 'Bramble', hp: 0 });
  });
});
