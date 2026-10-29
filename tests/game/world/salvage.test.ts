import { describe, expect, it } from 'vitest';
import type { InventoryEntry } from '../../../src/game/character/items.ts';
import { pickComponents } from '../../../src/game/world/components.ts';
import { componentPrice, visitCraftsman } from '../../../src/game/world/craftsmen.ts';
import { hasTools } from '../../../src/game/world/crafting.ts';
import { salvageGear, salvager, salvageYield } from '../../../src/game/world/salvage.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { inventoryView } from '../../../src/render/inventory-view.ts';
import { stashView } from '../../../src/render/stash-view.ts';
import { data, encounter, member, world } from './helpers.ts';

const line = (id: string, quantity = 1, more: Partial<InventoryEntry> = {}): InventoryEntry => ({
  id,
  quantity,
  location: 'stowed',
  ...more,
});
/** Gives a member these lines in place of their own gear; returns the member. */
function holding(w: World, name: string, ...lines: InventoryEntry[]): Member {
  const m = member(w, name);
  m.character = { ...m.character, inventory: lines };
  return m;
}
const tools = () => line(data.content.craftingRules.tools.id);
const OUTSIDE = { col: 0, row: 0 };
const VILLAGE = { col: 17, row: 4 };

describe("what gear salvages into (docs/rules-adaptation.md, Salvage; Sam's calls)", () => {
  it('yields quarters of a component by item, and nothing from the unlisted, magic, or modded', () => {
    expect(salvageYield(data, line('dagger'))).toEqual({ type: 'metal', amount: 0.25 });
    expect(salvageYield(data, line('plate-armor'))).toEqual({ type: 'metal', amount: 2 });
    expect(salvageYield(data, line('bow-small'))).toEqual({ type: 'wood', amount: 0.5 });
    expect(salvageYield(data, line('buff-coat'))).toEqual({ type: 'hide', amount: 0.5 });
    expect(salvageYield(data, line('torch'))).toBeNull();
    expect(salvageYield(data, line('dagger', 1, { bonus: 1 }))).toBeNull();
    expect(salvageYield(data, line('dagger', 1, { ability: 'keen' }))).toBeNull();
    expect(
      salvageYield(data, line('dagger', 1, { mods: [{ id: 'customized', components: [] }] })),
    ).toBeNull();
    expect(salvageYield(data, line('dagger', 1, { mods: [] }))).toEqual({
      type: 'metal',
      amount: 0.25,
    });
  });
});

describe('salvaging', () => {
  it("piles fractions up by type in a town's workshop, and makes whole scrap parts", () => {
    const w = world();
    const fizzwick = holding(w, 'Fizzwick');
    const snag = holding(w, 'Snag', line('dagger', 3), line('mail-shirt'), line('staff'));
    expect(salvageGear(w, data, snag.id, 0, 2)).toEqual({ ok: true });
    expect(snag.character.inventory[0]).toEqual(line('dagger'));
    expect(w.scrap).toEqual({ metal: 0.5 });
    expect(w.components['scrap-iron']).toBeUndefined();
    expect(w.log.at(-1)).toMatch(/Fizzwick salvages Dagger × 2 for 0.5 metal\.$/);
    expect(salvageGear(w, data, snag.id, 1, 1)).toEqual({ ok: true });
    expect(w.components['scrap-iron']).toBe(1);
    expect(w.scrap).toEqual({ metal: 0.5 });
    expect(w.log.at(-1)).toMatch(/for 1 metal; that makes 1 scrap iron\.$/);
    expect(salvageGear(w, data, snag.id, 1, 1)).toEqual({ ok: true });
    expect(w.scrap).toEqual({ metal: 0.5, wood: 0.5 });
    expect(salvageGear(w, data, snag.id, 0, 1)).toEqual({ ok: true });
    expect(w.scrap).toEqual({ metal: 0.75, wood: 0.5 });
    expect(snag.character.inventory).toEqual([]);
    expect(hasTools(data, fizzwick)).toBe(false);
  });

  it('clears a type whose fractions come out whole', () => {
    const w = world();
    const snag = holding(w, 'Snag', line('dagger', 4));
    expect(salvageGear(w, data, snag.id, 0, 4)).toEqual({ ok: true });
    expect(w.scrap).toEqual({});
    expect(w.components['scrap-iron']).toBe(1);
  });

  it('takes crafting tools out of town and in a village, which has no workshop', () => {
    for (const where of [OUTSIDE, VILLAGE]) {
      const w = world();
      w.position = where;
      const snag = holding(w, 'Snag', line('dagger'));
      holding(w, 'Fizzwick');
      expect(salvageGear(w, data, snag.id, 0, 1)).toEqual({
        ok: false,
        reason: "Salvage needs crafting tools or a town's workshop.",
      });
      holding(w, 'Fizzwick', tools());
      expect(salvageGear(w, data, snag.id, 0, 1)).toEqual({ ok: true });
    }
  });

  it('needs a living crafter in the party', () => {
    const w = world();
    const snag = holding(w, 'Snag', line('dagger'));
    for (const m of w.members)
      m.character = {
        ...m.character,
        skills: Object.fromEntries(
          Object.entries(m.character.skills).filter(([id]) => id !== 'craft'),
        ),
        foci: m.character.foci.filter((f) => f.id !== 'artisan'),
      };
    expect(salvageGear(w, data, snag.id, 0, 1)).toEqual({
      ok: false,
      reason: 'Salvage needs someone with Craft or the Artisan focus.',
    });
  });

  it('works underground only with tools, as a turn', () => {
    const w = world();
    w.dungeon = {} as World['dungeon'];
    holding(w, 'Fizzwick');
    expect(salvager(w, data)).toBe("Salvage needs crafting tools or a town's workshop.");
    holding(w, 'Fizzwick', tools());
    expect(salvager(w, data)).toMatchObject({ id: 'm-3' });
  });

  it("refuses what can't be salvaged, what is being worked on, and mid-encounter", () => {
    const w = world();
    const snag = holding(
      w,
      'Snag',
      line('torch'),
      line('dagger', 1, { serial: 's1' }),
      line('dagger', 1, { bonus: 1 }),
      line('moon-lance'),
    );
    expect(salvageGear(w, data, snag.id, 3, 1)).toEqual({
      ok: false,
      reason: "moon-lance can't be salvaged.",
    });
    expect(salvageGear(w, data, snag.id, 0, 1)).toEqual({
      ok: false,
      reason: "Torch can't be salvaged.",
    });
    expect(salvageGear(w, data, snag.id, 2, 1)).toEqual({
      ok: false,
      reason: "Dagger can't be salvaged.",
    });
    w.projects.push({
      crafter: 'm-3',
      kind: 'strip',
      item: 'dagger',
      target: 's1',
      daysLeft: 1,
    } as World['projects'][number]);
    expect(salvageGear(w, data, snag.id, 1, 1)).toEqual({
      ok: false,
      reason: 'Dagger is being worked on.',
    });
    w.projects = [];
    expect(salvageGear(w, data, snag.id, 1, 1)).toEqual({ ok: true });
    w.encounter = encounter([['thug-or-militia']]);
    expect(salvageGear(w, data, snag.id, 0, 1)).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
  });
});

describe('scrap parts', () => {
  it('are spent before the named parts of their type', () => {
    const w = world();
    w.components = { 'cold-iron': 1, 'scrap-iron': 1 };
    expect(pickComponents(w, data, [{ type: 'metal', count: 1 }])).toEqual(['scrap-iron']);
    expect(pickComponents(w, data, [{ type: 'metal', count: 2 }])).toEqual([
      'scrap-iron',
      'cold-iron',
    ]);
  });

  it('sell for next to nothing, and no craftsman stocks them', () => {
    expect(componentPrice(data, 'scrap-iron')).toBe(1);
    for (let seed = 0; seed < 20; seed++) {
      const w = world();
      w.rng = createRng(`scrap-${seed}`);
      expect(visitCraftsman(w, data)).toEqual({ ok: true });
      const parts = Object.keys(Object.values(w.craftsmen)[0]?.parts ?? {});
      expect(parts.filter((id) => id.startsWith('scrap') || id.startsWith('salvaged'))).toEqual([]);
    }
  });
});

describe('the inventory and stash views', () => {
  it("show each line's yield, who would salvage, and the scrap piled up", () => {
    const w = world();
    const snag = holding(w, 'Snag', line('dagger'), line('torch'));
    const view = inventoryView(w, data, snag.id);
    expect(view?.lines.map((l) => l.salvage)).toEqual(['0.25 metal', null]);
    expect(view?.salvager).toEqual({ name: 'Fizzwick' });
    w.position = OUTSIDE;
    holding(w, 'Fizzwick');
    expect(inventoryView(w, data, snag.id)?.salvager).toEqual({
      why: "Salvage needs crafting tools or a town's workshop.",
    });
    expect(stashView(w, data).scrap).toBeNull();
    w.scrap = { wood: 0.5, metal: 0.75 };
    expect(stashView(w, data).scrap).toBe('0.75 metal, 0.5 wood');
  });
});
