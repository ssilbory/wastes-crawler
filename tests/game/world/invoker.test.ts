import { describe, expect, it } from 'vitest';
import { findProgression } from '../../../src/game/character/context.ts';
import { characterSheet } from '../../../src/game/character/derived.ts';
import { cannotCast } from '../../../src/game/world/casting.ts';
import { endOfDay } from '../../../src/game/world/day.ts';
import { applyBattle, encounterBattle } from '../../../src/game/world/fight.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { VANISH, vanish, VISCERA, infuse } from '../../../src/game/world/sorcery.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { data, encounter, member, world } from './helpers.ts';

/** Fizzwick (Int +1) in the given classes, with both spells prepared. */
function invoker(w: World, levels: Record<string, number>, current = 'full-invoker'): Member {
  const f = member(w, 'Fizzwick');
  f.character = {
    ...f.character,
    classes: { current, levels },
    spells: { known: [VANISH, VISCERA], prepared: [VANISH, VISCERA] },
  };
  return f;
}

const slots = (m: Member) => characterSheet(m.character, data).magic?.slots;

describe('the Invoker’s spell points (1.5.11)', () => {
  it('adds the Int modifier to spell points and spells prepared, and casts no slots', () => {
    const w = world();
    // Full Invoker 5: 6 + 1 points, 5 + 1 prepared, up to level 3.
    const f = invoker(w, { 'full-invoker': 5 });
    expect(characterSheet(f.character, data).magic).toMatchObject({
      points: true,
      slots: { maxSpellLevel: 3, spellsCast: 0, spellPoints: 7, spellsPrepared: 6 },
    });
    // Partial Invoker 1 on the Warlock's table: 1 + 1 points, 1 + 1 prepared.
    invoker(w, { 'invoker-partial-warrior': 1 }, 'invoker-partial-warrior');
    expect(slots(f)).toMatchObject({ spellsCast: 0, spellPoints: 2, spellsPrepared: 2 });
    // The Int modifier counts once, however many Invoker classes are held.
    invoker(w, { 'invoker-partial-warrior': 4, 'full-invoker': 1 });
    expect(slots(f)).toMatchObject({ spellPoints: 2 + 1 + 1, spellsPrepared: 4 + 2 + 1 });
  });

  it('spends a spell’s level in points, so the same spell can repeat while they last', () => {
    const w = world();
    // Full Invoker 5: 6 + 1 points.
    const f = invoker(w, { 'full-invoker': 5 });
    w.encounter = encounter([['thug-or-militia']], { spotted: false });
    // Vanish is level 1.
    expect(vanish(w, data, f.id)).toEqual({ ok: true });
    expect([f.spellsCast, f.pointsSpent]).toEqual([0, 1]);
    // Conjunct the Vital Viscera is level 3: twice more spends the other 6.
    const snag = member(w, 'Snag');
    for (const spent of [4, 7]) {
      snag.character = { ...snag.character, hp: { ...snag.character.hp, current: 1 } };
      expect(infuse(w, data, f.id, snag.id)).toEqual({ ok: true });
      expect(f.pointsSpent).toBe(spent);
    }
    expect(cannotCast(data, f, VANISH)).toBe('Fizzwick has no spells left today.');
  });

  it('spends a slot first when the caster also has a slot class, then points', () => {
    const w = world();
    const f = invoker(w, { 'full-high-mage': 4, 'full-invoker': 1 });
    // High Mage 4 casts 2; Invoker 1 has 1 + 1 points.
    expect(slots(f)).toMatchObject({ spellsCast: 2, spellPoints: 2 });
    for (let i = 0; i < 4; i++) {
      w.encounter = encounter([['thug-or-militia']], { spotted: false });
      expect(vanish(w, data, f.id)).toEqual({ ok: true });
    }
    expect([f.spellsCast, f.pointsSpent]).toEqual([2, 2]);
    expect(cannotCast(data, f, VANISH)).toBe('Fizzwick has no spells left today.');
  });

  it('gets its points back with the night’s rest', () => {
    const w = world();
    const f = invoker(w, { 'full-invoker': 1 });
    f.pointsSpent = 2;
    f.slept = true;
    w.camp = 'made';
    endOfDay(w, data);
    expect(f.pointsSpent).toBe(0);
  });

  it('carries points spent into a fight and back out', () => {
    const w = world();
    const f = invoker(w, { 'full-invoker': 3 });
    f.pointsSpent = 1;
    w.encounter = encounter([['thug-or-militia']]);
    const fight = encounterBattle(w, data);
    const c = fight.battle.combatants.find((x) => x.name === 'Fizzwick');
    expect(c?.caster).toMatchObject({ spellsLeft: 0, pointsLeft: 4 });
    (c?.caster as { pointsLeft: number }).pointsLeft = 1;
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'party', rounds: 1, deaths: 0, battle: fight.battle },
      null,
    );
    expect(f.pointsSpent).toBe(4);
  });

  it('loads a version 28 save with no points spent', () => {
    const w = world();
    w.benched = [w.members.pop() as Member];
    const save = JSON.parse(serializeWorld(w));
    const unspent = (list: Record<string, unknown>[]) =>
      list.map((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'pointsSpent')));
    const v28 = {
      ...save,
      schemaVersion: 28,
      members: unspent(save.members),
      benched: unspent(save.benched),
    };
    const loaded = parseWorld(JSON.stringify(v28), data);
    if (!loaded.ok) throw new Error(loaded.errors.join('; '));
    expect(
      [...loaded.world.members, ...loaded.world.benched].every((m) => m.pointsSpent === 0),
    ).toBe(true);
  });
});

describe('the partial Invokers’ level tables (1.5.11)', () => {
  it('borrow the High Mage partial-class tables', () => {
    expect(findProgression(data, 'invoker-partial-warrior')?.id).toBe('high-mage-partial-warrior');
    expect(findProgression(data, 'invoker-partial-expert')?.id).toBe('high-mage-partial-expert');
    expect(findProgression(data, 'full-invoker')?.id).toBe('full-invoker');
    expect(findProgression(data, 'nope')).toBeUndefined();
  });
});
