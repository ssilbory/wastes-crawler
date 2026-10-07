import { describe, expect, it } from 'vitest';
import { emit } from '../../../src/game/world/bus.ts';
import { enterRegion } from '../../../src/game/world/crossing.ts';
import { cannotTopple, topple, TREMORS } from '../../../src/game/world/tremors.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { below } from '../dungeon/helpers.ts';
import { fail } from './helpers-mage.ts';
import { data, encounter, member, world } from './helpers.ts';

/** Fizzwick as a level-`level` Elementalist with Tremors of the Depths prepared. */
function elementalist(w: World, level = 9): Member {
  const m = member(w, 'Fizzwick');
  m.character = {
    ...m.character,
    classes: { current: 'full-elementalist', levels: { 'full-elementalist': level } },
    spells: { known: [TREMORS], prepared: [TREMORS] },
  };
  return m;
}

/** The party before the Ruinfield Gate, its garrison seen from afar. */
function atGate(): World {
  const w = world();
  enterRegion(w, 'dark-lands', { col: 18, row: 12 });
  emit(w, data, { kind: 'hex-entered' });
  return w;
}

describe('Tremors of the Depths', () => {
  it('brings a garrison post down, beaten for good, with no loot or XP', () => {
    const w = atGate();
    const m = elementalist(w);
    const xp = w.members.map((x) => x.character.xp);
    expect(cannotTopple(w)).toBeNull();
    expect(topple(w, data, m.id)).toEqual({ ok: true });
    expect(w.beaten).toEqual(['dark-lands/18,12']);
    expect(w.encounter).toBeNull();
    expect(w.ordersEnded).toEqual([]);
    expect(w.loot).toEqual([]);
    expect(w.members.map((x) => x.character.xp)).toEqual(xp);
    expect(m.spellsCast).toBe(1);
    expect(w.log.at(-1)).toContain('the post comes down on its garrison.');
    // The post no longer springs.
    emit(w, data, { kind: 'hex-entered' });
    expect(w.encounter).toBeNull();
  });

  it('needs a garrison still seen from afar, above ground', () => {
    const w = world();
    const m = elementalist(w);
    expect(topple(w, data, m.id)).toEqual(fail('There is nothing here to bring down.'));
    w.encounter = encounter([['thug-or-militia']]);
    expect(topple(w, data, m.id)).toEqual(fail("Only a garrison's post can be brought down."));
    w.encounter = encounter([['walking-tree']], { garrison: 'borderlands/1,1' });
    expect(topple(w, data, m.id)).toEqual(fail("Only a garrison's post can be brought down."));
    const g = atGate();
    const n = elementalist(g);
    (g.encounter as NonNullable<World['encounter']>).spotted = false;
    expect(topple(g, data, n.id)).toEqual(fail('It is too late: the garrison is upon the party.'));
    const d = below();
    const o = elementalist(d);
    d.encounter = encounter([['bound-orc-guard']], { order: 'ruinfield-gate', garrison: 'x' });
    expect(topple(d, data, o.id)).toEqual(
      fail('Below ground, the tremors would bury the party too.'),
    );
  });

  it('needs a caster able to cast level-5 spells', () => {
    const w = atGate();
    const m = elementalist(w, 8);
    expect(topple(w, data, m.id)).toEqual(fail("Fizzwick can't cast level-5 spells yet."));
    expect(w.encounter).not.toBeNull();
  });
});
