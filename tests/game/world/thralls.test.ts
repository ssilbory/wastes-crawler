import { describe, expect, it } from 'vitest';
import { dismiss } from '../../../src/game/world/hire.ts';
import { isServant } from '../../../src/game/world/npcs.ts';
import { recruitSurrendered } from '../../../src/game/world/surrender.ts';
import {
  cannotEnthrall,
  ENTHRALL,
  enthrall,
  enthrallable,
} from '../../../src/game/world/thralls.ts';
import { placeKey } from '../../../src/game/world/necromancy.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { below, place, state } from '../dungeon/helpers.ts';
import { data, member, world } from './helpers.ts';

// docs/rules-adaptation.md, Obnubilation of the Will in Phase 21.
const fail = (reason: string) => ({ ok: false, reason });
const notes = (w: World) => w.log.map((l) => l.replace(/^Day \d+, \w+: /, ''));

/** Fizzwick as a level-7 High Mage with Obnubilation of the Will prepared. */
function mage(w: World): Member {
  const m = member(w, 'Fizzwick');
  m.character = {
    ...m.character,
    classes: { current: 'full-high-mage', levels: { 'full-high-mage': 7 } },
    spells: { known: [ENTHRALL], prepared: [ENTHRALL] },
  };
  return m;
}

/** The surrendered waiting where the party stands. */
function prisoners(w: World, monsters: string[]): void {
  w.surrendered = { at: placeKey(w), monsters: [...monsters], questioned: false, recruited: false };
}

describe('Obnubilation of the Will', () => {
  it('takes only thinking, living foes among the surrendered', () => {
    expect(enthrallable(data, 'thug-or-militia')).toBe(true);
    expect(enthrallable(data, 'small-pack-predator')).toBe(false);
    expect(enthrallable(data, 'zombie')).toBe(false);
    expect(enthrallable(data, 'vampire')).toBe(false);
    const w = world();
    const m = mage(w);
    expect(cannotEnthrall(w, data, m.id, 0)).toBe('No such prisoner.');
    prisoners(w, ['small-pack-predator', 'thug-or-militia']);
    expect(cannotEnthrall(w, data, m.id, 0)).toBe('Only a thinking, living foe can be enthralled.');
    expect(cannotEnthrall(w, data, m.id, 1)).toBeNull();
    expect(cannotEnthrall(w, data, member(w, 'Snag').id, 1)).toMatch(/hasn't prepared/);
    expect(enthrall(w, data, member(w, 'Snag').id, 1).ok).toBe(false);
  });

  it('leaves a prisoner who saves immune from then on', () => {
    const w = world();
    const m = mage(w);
    prisoners(w, ['thug-or-militia', 'veteran-soldier']);
    w.rng = scriptedRng([20]);
    expect(enthrall(w, data, m.id, 0)).toEqual({ ok: true });
    expect(notes(w).at(-1)).toContain('throws off');
    expect(w.surrendered?.immune).toEqual([true, false]);
    expect(cannotEnthrall(w, data, m.id, 0)).toBe('That one has already thrown off the spell.');
    expect(w.npcs).toEqual([]);
    // The immunity follows the prisoner when another is taken on.
    w.rng = scriptedRng([4]);
    recruitSurrendered(w, data, 1, null);
    expect(w.surrendered).toMatchObject({ monsters: ['thug-or-militia'], immune: [true] });
  });

  it('makes a thrall that tells of the land, then follows the caster as a servant', () => {
    const w = world();
    const m = mage(w);
    prisoners(w, ['thug-or-militia', 'veteran-soldier']);
    w.rng = scriptedRng([1, 4, 4, 4]);
    expect(enthrall(w, data, m.id, 1)).toEqual({ ok: true });
    expect(notes(w)).toContain('They describe the land about.');
    expect(w.npcs).toHaveLength(1);
    const thrall = w.npcs[0];
    expect(thrall).toMatchObject({ kind: 'thrall', type: 'veteran-soldier', master: m.id });
    expect(isServant(thrall as NonNullable<typeof thrall>)).toBe(true);
    expect(w.surrendered).toMatchObject({
      monsters: ['thug-or-militia'],
      questioned: true,
      immune: [false],
    });
    expect(notes(w).at(-1)).toContain('follows Fizzwick now');
    expect(dismiss(w, data, (thrall as NonNullable<typeof thrall>).id)).toEqual({ ok: true });
    expect(notes(w).at(-1)).toContain('released from the spell');
  });

  it('tells all of a level below ground, and stays a prisoner with no room', () => {
    const w = below();
    Object.assign(state(w), { dungeon: 'buried-waterworks' });
    place(w, 'buried-waterworks-1', 4, 2, 'n');
    const m = mage(w);
    prisoners(w, ['thug-or-militia']);
    w.npcs = [];
    while (w.npcs.length < 2)
      w.npcs.push({ ...(w.npcs[0] ?? fakeNpc()), id: `npc-${w.npcs.length}` });
    w.rng = scriptedRng([1]);
    expect(enthrall(w, data, m.id, 0)).toEqual({ ok: true });
    const said = notes(w);
    expect(said).toContain('They recall every passage of this level.');
    expect(said).toContain('They name every snare on this level.');
    expect(said.at(-1)).toBe('There is no room for it in the party.');
    expect(w.surrendered).toMatchObject({ monsters: ['thug-or-militia'], immune: [true] });
  });

  it('the last prisoner enthralled closes the surrender', () => {
    const w = world();
    const m = mage(w);
    prisoners(w, ['thug-or-militia']);
    w.rng = scriptedRng([1, 4, 4, 4]);
    enthrall(w, data, m.id, 0);
    expect(w.surrendered).toBeNull();
    expect(enthrall(w, data, m.id, 0)).toEqual(fail('No such prisoner.'));
  });
});

function fakeNpc() {
  return {
    id: 'npc-0',
    kind: 'hireling' as const,
    type: 'guard',
    name: 'Brag',
    hp: 5,
    maxHp: 5,
    row: 1,
    column: 3,
    quitting: false,
    inventory: [],
    owed: 0,
    refund: 0,
  };
}
