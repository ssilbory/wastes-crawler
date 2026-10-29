import { describe, expect, it } from 'vitest';
import type { InventoryEntry } from '../../../src/game/character/items.ts';
import { ammoFor, carriesAmmo } from '../../../src/game/character/ammo.ts';
import { resolveAttack } from '../../../src/game/combat/attack.ts';
import { pcCombatant } from '../../../src/game/combat/combatants.ts';
import type { Combatant } from '../../../src/game/combat/types.ts';
import { camp } from '../../../src/game/world/activities.ts';
import { ammoBack } from '../../../src/game/world/ammo.ts';
import { canFletch, fletchFor, fletchShift } from '../../../src/game/world/fletch.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { standardBattle } from '../combat/helpers.ts';
import { data, member, starter, world } from './helpers.ts';

const line = (id: string, quantity = 1, more: Partial<InventoryEntry> = {}): InventoryEntry => ({
  id,
  quantity,
  location: 'stowed',
  ...more,
});
function holding(w: World, name: string, ...lines: InventoryEntry[]): Member {
  const m = member(w, name);
  m.character = { ...m.character, inventory: lines };
  return m;
}
const shooter = (...shot: string[]) => ({ shot }) as unknown as Combatant;
const ARROWS = 'arrows-20';
const BOLTS = 'hurlant-bolts-20';
const WOOD = 'firewood-one-nights-fire';
const TOOLS = data.content.craftingRules.tools.id;
const OUTSIDE = { col: 0, row: 0 };
const VILLAGE = { col: 17, row: 4 };

describe("what shoots what (docs/rules-adaptation.md, Ammo; Sam's calls)", () => {
  it('has bows and the crossbow shoot arrows, hurlants bolts, and nothing else need ammo', () => {
    expect(ammoFor(data, 'bow-small')).toBe(ARROWS);
    expect(ammoFor(data, 'crossbow')).toBe(ARROWS);
    expect(ammoFor(data, 'hurlant-hand')).toBe(BOLTS);
    expect(ammoFor(data, 'spear-light')).toBeNull();
    expect(carriesAmmo(starter('lirael'), ARROWS)).toBe(true);
    expect(carriesAmmo(starter('snag'), ARROWS)).toBe(false);
  });

  it("drops a bow's shot from a fighter with no arrows, and marks the shot's ammo", () => {
    const lirael = starter('lirael');
    const armed = pcCombatant(data, lirael);
    const bow = armed.attacks.find((a) => a.id === 'bow-small');
    expect(bow?.ammo).toBe(ARROWS);
    expect(armed.attacks.find((a) => a.id === 'sword-short')?.ammo).toBeUndefined();
    const dry = pcCombatant(data, {
      ...lirael,
      inventory: lirael.inventory.filter((e) => e.id !== ARROWS),
    });
    expect(dry.attacks.some((a) => a.id === 'bow-small')).toBe(false);
    expect(dry.attacks.some((a) => a.id === 'sword-short')).toBe(true);
  });

  it('remembers each kind of ammo shot in a fight, once', () => {
    const b = standardBattle([['thug-or-militia']]);
    const lirael = b.combatants.find((c) => c.name === 'Lirael') as Combatant;
    const thug = b.combatants.find((c) => c.side === 'enemy') as Combatant;
    const bow = lirael.attacks.find((a) => a.id === 'bow-small');
    if (!bow) throw new Error('Lirael shoots a bow');
    resolveAttack(b, lirael, bow, thug);
    resolveAttack(b, lirael, bow, thug);
    expect(lirael.shot).toEqual([ARROWS]);
  });
});

describe('the ammo die after a fight', () => {
  it('holds on a 3 or more, and rolls nothing for one who never shot', () => {
    const w = world();
    const m = holding(w, 'Lirael', line(ARROWS, 2));
    w.rng = scriptedRng([3]);
    ammoBack(w, data, m, shooter());
    ammoBack(w, data, m, shooter(ARROWS));
    expect(m.character.inventory).toEqual([line(ARROWS, 2)]);
  });

  it('steps one quiver down on a 1 or 2, and rolls a used quiver first', () => {
    const w = world();
    const m = holding(w, 'Lirael', line(ARROWS, 2));
    w.rng = scriptedRng([2, 1]);
    ammoBack(w, data, m, shooter(ARROWS));
    expect(m.character.inventory).toEqual([line(ARROWS), line(ARROWS, 1, { die: 10 })]);
    expect(w.log.at(-1)).toMatch(/Lirael's arrows run low: d10 left\.$/);
    ammoBack(w, data, m, shooter(ARROWS));
    expect(m.character.inventory).toEqual([line(ARROWS), line(ARROWS, 1, { die: 8 })]);
  });

  it('uses a quiver up past d4, and passes over ammo no longer carried', () => {
    const w = world();
    const m = holding(w, 'Lirael', line(ARROWS, 1, { die: 4 }));
    w.rng = scriptedRng([1]);
    ammoBack(w, data, m, shooter(BOLTS, ARROWS));
    expect(m.character.inventory).toEqual([]);
    expect(w.log.at(-1)).toMatch(/Lirael's arrows run out\.$/);
  });
});

describe('fletching', () => {
  /** Lirael (Shoot, a bow) out in the wilds with tools, firewood, and a scrap iron. */
  function ready(): { w: World; m: Member } {
    const w = world();
    w.position = OUTSIDE;
    const m = holding(w, 'Lirael', line('bow-small', 1, { location: 'readied' }), line(TOOLS));
    holding(w, 'Snag', line(WOOD, 2));
    w.components = { 'scrap-iron': 1 };
    return { w, m };
  }

  it('is for Shoot, Craft, or the Artisan focus', () => {
    const w = world();
    expect(canFletch(member(w, 'Lirael'))).toBe(true);
    expect(canFletch(member(w, 'Fizzwick'))).toBe(true);
    expect(canFletch(member(w, 'Snag'))).toBe(false);
    fletchShift(w, data, member(w, 'Snag'));
    expect(w.log.at(-1)).toMatch(/Snag doesn't know how to fletch\.$/);
  });

  it("makes the fletcher's own ammo first, then the party's, or none", () => {
    const w = world();
    const fizz = holding(w, 'Fizzwick');
    holding(w, 'Grukk', line('hurlant-hand'));
    // Grukk comes before Lirael in the party.
    expect(fletchFor(w, data, fizz)).toBe(BOLTS);
    expect(fletchFor(w, data, member(w, 'Lirael'))).toBe(ARROWS);
    holding(w, 'Lirael');
    holding(w, 'Grukk');
    expect(fletchFor(w, data, fizz)).toBeNull();
    w.position = OUTSIDE;
    holding(w, 'Fizzwick', line(TOOLS));
    fletchShift(w, data, fizz);
    expect(w.log.at(-1)).toMatch(/No one in the party shoots anything Fizzwick could fletch\.$/);
  });

  it("burns a night's firewood and a quarter of a metal part for a quiver", () => {
    const { w, m } = ready();
    fletchShift(w, data, m);
    expect(m.character.inventory).toContainEqual(line(ARROWS));
    expect(member(w, 'Snag').character.inventory).toEqual([line(WOOD)]);
    expect(w.components).toEqual({});
    expect(w.scrap).toEqual({ metal: 0.75 });
    expect(w.log.at(-1)).toMatch(/Lirael fletches a quiver of arrows\.$/);
    fletchShift(w, data, m);
    expect(w.scrap).toEqual({ metal: 0.5 });
    expect(m.character.inventory).toContainEqual(line(ARROWS, 2));
  });

  it('needs tools outside a town with a workshop', () => {
    for (const where of [OUTSIDE, VILLAGE]) {
      const { w, m } = ready();
      w.position = where;
      m.character = { ...m.character, inventory: [line('bow-small')] };
      fletchShift(w, data, m);
      expect(w.log.at(-1)).toMatch(/Lirael has no crafting tools to fletch with\.$/);
    }
    const { w, m } = ready();
    w.position = world().position;
    m.character = { ...m.character, inventory: [line('bow-small')] };
    fletchShift(w, data, m);
    expect(m.character.inventory).toContainEqual(line(ARROWS));
  });

  it('says what is missing, spending nothing', () => {
    const { w, m } = ready();
    holding(w, 'Snag');
    fletchShift(w, data, m);
    expect(w.log.at(-1)).toMatch(
      /Lirael can't fletch arrows: it takes 1 night's firewood and 0\.25 metal\.$/,
    );
    expect(w.components).toEqual({ 'scrap-iron': 1 });
    holding(w, 'Grukk', line('hurlant-hand'));
    m.character = { ...m.character, inventory: [line(TOOLS)] };
    w.components = {};
    fletchShift(w, data, member(w, 'Lirael'));
    expect(w.log.at(-1)).toMatch(/Lirael can't fletch hurlant bolts: it takes 0\.5 metal\.$/);
  });

  it('makes nothing the fletcher has no room for', () => {
    const { w, m } = ready();
    m.character = {
      ...m.character,
      inventory: [...m.character.inventory, line('plate-armor', 6)],
    };
    fletchShift(w, data, m);
    expect(w.log.at(-1)).toMatch(/Lirael fletches nothing: Lirael can't carry that much\.$/);
    expect(member(w, 'Snag').character.inventory).toEqual([line(WOOD, 2)]);
  });

  it('is a camp quarter', () => {
    const { w, m } = ready();
    camp(w, data, { [m.id]: 'fletch' });
    expect(m.character.inventory).toContainEqual(line(ARROWS));
  });
});
