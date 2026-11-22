import { describe, expect, it } from 'vitest';
import type { Alchemist } from '../../../src/data/schemas/index.ts';
import { brewsToOrder, visitAlchemist, waresHere } from '../../../src/game/world/alchemists.ts';
import { institutionId } from '../../../src/game/world/institution-projects.ts';
import { progressOf } from '../../../src/game/world/major-projects.ts';
import { cannotRaise, leaveCorpses, raiseCorpse } from '../../../src/game/world/necromancy.ts';
import { addNpc } from '../../../src/game/world/npcs.ts';
import { cannotDrink, drink, potionOf, pourDraught } from '../../../src/game/world/potions.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { potionView } from '../../../src/render/potion-view.ts';
import { data, encounter, member, world } from './helpers.ts';

// docs/rules-adaptation.md, Potions: Grave Draught (Sam's calls).
const DRAUGHT = 'grave-draught';
const fail = (reason: string) => ({ ok: false, reason });

function give(m: Member, quantity = 1): void {
  const line = { id: DRAUGHT, quantity, location: 'stowed' as const };
  m.character = { ...m.character, inventory: [...m.character.inventory, line] };
}

/** The starters with two corpses here, Snag carrying a Grave Draught. */
function setup(): { w: World; snag: Member } {
  const w = world();
  leaveCorpses(w, data, [['thug-or-militia', 'thug-or-militia']]);
  const snag = member(w, 'Snag');
  give(snag, 2);
  return { w, snag };
}

const doses = (m: Member) =>
  m.character.inventory.filter((e) => e.id === DRAUGHT).reduce((n, e) => n + e.quantity, 0);

describe('the Grave Draught', () => {
  it('raises a corpse here as a zombie or a skeleton, to serve whoever poured it', () => {
    const { w, snag } = setup();
    expect(pourDraught(w, data, snag.id, DRAUGHT, 'zombie')).toEqual({ ok: true });
    expect(pourDraught(w, data, snag.id, DRAUGHT, 'skeleton')).toEqual({ ok: true });
    expect(w.npcs.map((n) => [n.kind, n.type, n.master])).toEqual([
      ['undead', 'raised-zombie', snag.id],
      ['undead', 'raised-skeleton', snag.id],
    ]);
    expect(doses(snag)).toBe(0);
    expect(w.corpses?.hitDice).toEqual([]);
    expect(w.log.at(-1)).toMatch(
      /Snag pours a Grave Draught on a corpse; Raised Skeleton stands\./,
    );
  });

  it('needs no spell or caster level, only a corpse and room', () => {
    const { w, snag } = setup();
    // Snag casts no Raise Corpse, yet the draught works for them.
    expect(cannotRaise(w, data, snag)).not.toBeNull();
    const p = potionOf(data, DRAUGHT);
    if (!p) throw new Error('no draught');
    expect(cannotDrink(w, data, p, snag)).toBeNull();
    w.corpses = null;
    expect(pourDraught(w, data, snag.id, DRAUGHT, 'zombie')).toEqual(
      fail('There are no corpses here.'),
    );
    leaveCorpses(w, data, [['thug-or-militia']]);
    addNpc(w, data, 'hireling', 'thug-or-militia', 'thug-or-militia', 'Hob', true);
    addNpc(w, data, 'hireling', 'thug-or-militia', 'thug-or-militia', 'Nob', true);
    expect(pourDraught(w, data, snag.id, DRAUGHT, 'zombie')).toEqual(
      fail('There is no room in the party.'),
    );
    expect(doses(snag)).toBe(2);
  });

  it('is poured outside encounters, by a conscious holder who has one', () => {
    const { w, snag } = setup();
    w.encounter = encounter([['thug-or-militia']]);
    expect(pourDraught(w, data, snag.id, DRAUGHT, 'zombie')).toEqual(
      fail('Settle the encounter first.'),
    );
    w.encounter = null;
    const grukk = member(w, 'Grukk');
    expect(pourDraught(w, data, grukk.id, DRAUGHT, 'zombie')).toEqual(
      fail('Grukk carries no Grave Draught.'),
    );
    grukk.reviving = true;
    give(grukk);
    expect(pourDraught(w, data, grukk.id, DRAUGHT, 'zombie')).toEqual(
      fail('Only a conscious member can pour a draught.'),
    );
    expect(() => pourDraught(w, data, snag.id, 'healing-draught', 'zombie')).toThrow();
    // It isn't drunk.
    expect(drink(w, data, snag.id, DRAUGHT, snag.id)).toEqual(
      fail('Choose whether the corpse rises as a zombie or a skeleton.'),
    );
  });

  it('shows in the Potions window for its holder alone', () => {
    const { w, snag } = setup();
    const line = potionView(w, data).find((l) => l.potion.id === DRAUGHT);
    expect(line?.potion.raises).toBe(true);
    expect(line?.targets).toEqual([{ id: snag.id, name: 'Snag' }]);
    w.corpses = null;
    expect(potionView(w, data).find((l) => l.potion.id === DRAUGHT)?.targets).toEqual([]);
  });

  it('still lets a Necromancer raise with the spell as before', () => {
    const { w } = setup();
    const fizz = member(w, 'Fizzwick');
    fizz.character = {
      ...fizz.character,
      classes: { current: 'full-necromancer', levels: { 'full-necromancer': 3 } },
      spells: { known: ['raise-corpse'], prepared: ['raise-corpse'] },
    };
    expect(raiseCorpse(w, data, fizz.id, 'zombie')).toEqual({ ok: true });
    expect(w.npcs[0]).toMatchObject({ type: 'raised-zombie', master: fizz.id });
  });
});

describe('alchemists and the Lady’s mortuary', () => {
  const vell = data.content.alchemy.alchemists[0] as Alchemist;
  const ashby = data.content.alchemy.alchemists.find((a) => a.town === 'eastmarch') as Alchemist;

  it('sell and brew the Grave Draught, but not where her mortuary stands', () => {
    const w = world();
    expect(waresHere(w, data, vell)).toContain(DRAUGHT);
    expect(brewsToOrder(w, data, vell)).toContain(DRAUGHT);
    expect(ashby.wares).toContain(DRAUGHT);
    expect(waresHere(w, data, ashby)).not.toContain(DRAUGHT);
    expect(brewsToOrder(w, data, ashby)).not.toContain(DRAUGHT);
    expect(brewsToOrder(w, data, ashby)).toContain('healing-draught');
  });

  it('count the party’s own mortuary too', () => {
    const w = world();
    const id = institutionId('mortuary', vell.town);
    w.majorProjects[id] = { ...progressOf(w, id), done: 0, specialist: 'Aldo' };
    expect(waresHere(w, data, vell)).not.toContain(DRAUGHT);
    // Stock is drawn only from what may be sold: every draw here is something else.
    w.purse = 500;
    expect(visitAlchemist(w, data)).toEqual({ ok: true });
    expect(Object.keys(w.alchemists[vell.id]?.stock ?? {})).not.toContain(DRAUGHT);
  });
});
