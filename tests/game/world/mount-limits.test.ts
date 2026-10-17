import { describe, expect, it } from 'vitest';
import type { GameData } from '../../../src/game/character/context.ts';
import {
  buyMount,
  keepAsMount,
  releaseMount,
  sellMount,
  setRider,
} from '../../../src/game/world/mounts.ts';
import { addNpc } from '../../../src/game/world/npcs.ts';
import type { Mount, World } from '../../../src/game/world/types.ts';
import { data, encounter, member, world } from './helpers.ts';

/** The starters in Rubblegate with a riding elk bought on 4s. */
function withElk(): { w: World; elk: Mount } {
  const w = world([4, 4]);
  w.purse = 5000;
  expect(buyMount(w, data, 'riding-elk')).toEqual({ ok: true });
  return { w, elk: w.mounts[0] as Mount };
}

/** Content where a herd beast can be tamed into a pack bison. */
const packTaming: GameData = {
  ...data,
  content: {
    ...data.content,
    mountRules: {
      ...data.content.mountRules,
      mounts: data.content.mountRules.mounts.map((t) =>
        t.id === 'pack-bison' ? { ...t, tameFrom: ['herd-beast'] } : { ...t, tameFrom: [] },
      ),
    },
  },
};

/** Snag with Animal Ken, a herd beast on offer, and rations to spare. */
function offered(): World {
  const w = world();
  const snag = member(w, 'Snag');
  snag.character = { ...snag.character, skills: { ...snag.character.skills, 'animal-ken': 0 } };
  w.encounter = encounter([['herd-beast']], { beast: 'herd-beast' });
  w.rations = 12;
  return w;
}

describe('mount limits (docs/rules-adaptation.md, Mounts)', () => {
  it('seats only a living member', () => {
    const { w, elk } = withElk();
    const snag = member(w, 'Snag');
    snag.dead = true;
    expect(() => setRider(w, data, elk.id, snag.id)).toThrow(`no living member ${snag.id}`);
  });

  it('sells nothing during an encounter', () => {
    const { w, elk } = withElk();
    w.encounter = encounter([['thug-or-militia']]);
    expect(sellMount(w, data, elk.id)).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
    expect(w.mounts).toEqual([elk]);
  });

  it('sets nothing loose with a load still on it', () => {
    const { w, elk } = withElk();
    elk.inventory = [{ id: 'waterskin-one-gallon', quantity: 1, location: 'stowed' }];
    expect(releaseMount(w, data, elk.id)).toEqual({
      ok: false,
      reason: "Take Riding Elk's load first.",
    });
    expect(w.mounts).toEqual([elk]);
  });
});

describe('taming a pack beast (docs/rules-adaptation.md, Mounts: Taming)', () => {
  it('keeps it in an NPC slot, unridden', () => {
    const w = offered();
    expect(keepAsMount(w, packTaming, member(w, 'Snag').id)).toEqual({ ok: true });
    expect(w.npcs).toMatchObject([{ kind: 'pack', type: 'pack-bison' }]);
    expect(w.mounts).toEqual([]);
    expect(w.rations).toBe(8);
  });

  it('needs room in the party, and spends no rations without it', () => {
    const w = offered();
    addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'A', true);
    addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'B', true);
    expect(keepAsMount(w, packTaming, member(w, 'Snag').id)).toEqual({
      ok: false,
      reason: 'There is no room in the party.',
    });
    expect(w.rations).toBe(12);
    expect(w.encounter?.beast).toBe('herd-beast');
  });
});
