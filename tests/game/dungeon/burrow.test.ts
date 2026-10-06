import { describe, expect, it } from 'vitest';
import { burrow, burrowers, BURROWER } from '../../../src/game/dungeon/burrow.ts';
import { step, turnParty } from '../../../src/game/dungeon/explore.ts';
import { knownEdges } from '../../../src/game/dungeon/secrets.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, encounter, member, world } from '../world/helpers.ts';
import { below, place, state } from './helpers.ts';

/** Fizzwick as a third-level Elementalist with The Burrower Below prepared. */
function burrower(w: World): Member {
  const f = member(w, 'Fizzwick');
  f.character = {
    ...f.character,
    classes: { current: 'full-elementalist', levels: { 'full-elementalist': 3 } },
    spells: { known: [BURROWER], prepared: [BURROWER] },
  };
  return f;
}

describe('The Burrower Below in a dungeon (Sam’s call)', () => {
  it('digs through the wall ahead for a turn and a spell, and the party walks and sees through', () => {
    const w = place(below(), 'barrow-upper', 5, 1, 'e');
    w.rng = createRng('burrow');
    const f = burrower(w);
    expect(burrowers(w)).toEqual([f]);
    expect(step(w, data, 'forward')).toEqual({ ok: false, reason: 'A wall blocks the way.' });
    expect(burrow(w, data, f.id)).toEqual({ ok: true });
    expect([f.spellsCast, state(w).turn]).toEqual([1, 1]);
    expect(state(w).dug['barrow-upper']).toEqual(['6,1,w']);
    expect(w.log).toContainEqual(expect.stringContaining('Fizzwick parts the stone'));
    // The passage is open from either side.
    expect(knownEdges(w, data)({ x: 6, y: 1 }, 'w')).toBe('open');
    turnParty(w, data, 'around');
    turnParty(w, data, 'around');
    expect(state(w).seen['barrow-upper']).toContain('6,1');
    w.encounter = null;
    expect(step(w, data, 'forward')).toEqual({ ok: true });
    expect(state(w).at).toEqual({ x: 6, y: 1 });
  });

  it('digs past an unfound secret door, but not through an opening or the outer wall', () => {
    const w = place(below(), 'barrow-upper', 3, 1, 'e');
    w.rng = createRng('secret');
    const f = burrower(w);
    expect(burrow(w, data, f.id)).toEqual({ ok: true });
    expect(knownEdges(w, data)({ x: 3, y: 1 }, 'e')).toBe('open');
    w.encounter = null;
    place(w, 'barrow-upper', 1, 1, 'e');
    expect(burrow(w, data, f.id)).toEqual({
      ok: false,
      reason: 'There is no wall ahead to dig through.',
    });
    place(w, 'barrow-upper', 0, 1, 'w');
    expect(burrow(w, data, f.id)).toEqual({ ok: false, reason: 'Only solid rock lies beyond.' });
    expect(f.spellsCast).toBe(1);
  });

  it('needs the spell prepared, a spell left, and no encounter', () => {
    const w = place(below(), 'barrow-upper', 5, 1, 'e');
    const snag = member(w, 'Snag');
    expect(burrowers(w)).toEqual([]);
    expect(burrow(w, data, snag.id)).toEqual({
      ok: false,
      reason: "Snag hasn't prepared The Burrower Below.",
    });
    const f = burrower(w);
    f.spellsCast = 99;
    expect(burrow(w, data, f.id)).toEqual({
      ok: false,
      reason: 'Fizzwick has no spells left today.',
    });
    w.encounter = encounter([['thug-or-militia']]);
    expect(burrow(w, data, f.id)).toEqual({ ok: false, reason: 'Settle the encounter first.' });
    expect(() => burrow(world(), data, f.id)).toThrow('the party is not in a dungeon');
  });

  it('loads a version 25 save with no walls dug', () => {
    const w = below();
    const save = JSON.parse(serializeWorld(w));
    const { dug, ...dungeon } = save.dungeon;
    expect(dug).toEqual({});
    for (const d of [dungeon, null]) {
      const loaded = parseWorld(JSON.stringify({ ...save, schemaVersion: 25, dungeon: d }), data);
      if (!loaded.ok) throw new Error(loaded.errors.join('; '));
      expect(loaded.world.dungeon?.dug ?? null).toEqual(d && {});
    }
  });
});
