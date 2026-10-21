import { describe, expect, it } from 'vitest';
import { dropPotion, potionChance } from '../../../src/game/world/potion-drops.ts';
import { scribable } from '../../../src/game/world/scribing.ts';
import type { Member } from '../../../src/game/world/types.ts';
import { data, member, world } from './helpers.ts';

const WIN = { xp: 1, boss: false };
const BOSS = { xp: 1, boss: true };
const count = (m: Member, id: string) =>
  m.character.inventory.filter((e) => e.id === id).reduce((n, e) => n + e.quantity, 0);

describe('potion drops (docs/rules-adaptation.md, Potions: Drops)', () => {
  it('are 30% from a boss fight, 1% from other fights with humanoids, else none', () => {
    expect(potionChance(data, ['small-pack-predator'], BOSS)).toBe(30);
    expect(potionChance(data, ['thug-or-militia'], WIN)).toBe(1);
    expect(potionChance(data, ['small-pack-predator'], WIN)).toBe(0);
    expect(potionChance(data, ['unknown-monster'], WIN)).toBe(0);
    expect(potionChance(data, ['thug-or-militia'], { xp: 0, boss: true })).toBe(0);
  });

  it('give a potion by recipe weight to the PC with the most room', () => {
    // 30 rolls under the boss chance, 31 is no scroll, and 7 of 18 is past the healing draught's
    // 6: greater healing.
    const w = world([30, 31, 7]);
    dropPotion(w, data, ['small-pack-predator'], BOSS);
    const holder = w.members.find((m) => count(m, 'greater-healing') === 1);
    expect(holder).toBeDefined();
    expect(w.log.at(-1)).toContain('finds a Greater Healing among the fallen');
  });

  it('roll nothing when there is no chance, and give nothing on a miss', () => {
    const none = world([]);
    dropPotion(none, data, ['small-pack-predator'], WIN);
    const miss = world([2]);
    dropPotion(miss, data, ['thug-or-militia'], WIN);
    expect(miss.members.every((m) => count(m, 'healing-draught') === 0)).toBe(true);
  });

  it('are left behind by a party too laden, or with no one awake', () => {
    const w = world([1, 31, 1]);
    for (const m of w.members)
      m.character = {
        ...m.character,
        inventory: [
          ...m.character.inventory,
          { id: 'healing-draught', quantity: 3 * 40, location: 'stowed' },
        ],
      };
    dropPotion(w, data, ['small-pack-predator'], BOSS);
    expect(w.log.at(-1)).toContain(
      'Too laden to carry it, the party leaves behind a Healing Draught',
    );
    const out = world([1, 31, 1]);
    for (const m of out.members)
      m.character = { ...m.character, hp: { ...m.character.hp, current: 0 } };
    dropPotion(out, data, ['small-pack-predator'], BOSS);
    expect(member(out, 'Snag').character.inventory.some((e) => e.id === 'healing-draught')).toBe(
      false,
    );
  });

  it('roll nothing when no recipe can drop', () => {
    const recipes = data.content.alchemy.recipes.map((r) => ({ ...r, weight: 0 }));
    const d = {
      ...data,
      content: { ...data.content, alchemy: { ...data.content.alchemy, recipes } },
    };
    const w = world([1, 31]);
    dropPotion(w, d, ['small-pack-predator'], BOSS);
    expect(w.members.every((m) => count(m, 'healing-draught') === 0)).toBe(true);
  });

  it('are scrolls 30% of the time: a spell the party’s level could cast, at its level', () => {
    // At level 1 only first-level spells; the first of them.
    const w = world([1, 30, 0]);
    dropPotion(w, data, ['small-pack-predator'], BOSS);
    const found = w.members.flatMap((m) => m.character.inventory).filter((e) => e.id === 'scroll');
    expect(found).toHaveLength(1);
    expect(found[0]?.casterLevel).toBe(1);
    const spell = scribable(data).find((s) => s.id === found[0]?.spell);
    expect(spell?.level).toBe(1);
    expect(w.log.at(-1)).toContain(`finds a Scroll of ${spell?.name} (caster level 1)`);
  });
});
