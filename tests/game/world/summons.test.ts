import { describe, expect, it } from 'vitest';
import { castMagic } from '../../../src/game/combat/spells.ts';
import type { CasterState, Combatant } from '../../../src/game/combat/types.ts';
import { endOfDay } from '../../../src/game/world/day.ts';
import { applyBattle, encounterBattle } from '../../../src/game/world/fight.ts';
import { dismiss } from '../../../src/game/world/hire.ts';
import { firstAid, healers, HEALERS_KIT } from '../../../src/game/world/first-aid.ts';
import { addNpc, fights, npcMonster } from '../../../src/game/world/npcs.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, encounter, member, world } from './helpers.ts';

/** A won fight in which Fizzwick called up a Phantasmal Eidolon. */
function summoned(npcs = 0) {
  const w = world();
  w.position = { col: 5, row: 9 };
  for (let i = 0; i < npcs; i++)
    addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', null, true);
  w.encounter = encounter([['thug-or-militia']]);
  const fight = encounterBattle(w, data);
  const b = fight.battle;
  const f = b.combatants.find((c) => c.name === 'Fizzwick') as Combatant;
  Object.assign(f.caster as CasterState, {
    level: 7,
    arts: [],
    prepared: ['calculation-of-the-phantasmal-eidolon'],
    spellsLeft: 1,
  });
  castMagic(b, f, 'calculation-of-the-phantasmal-eidolon', undefined, undefined);
  const eidolon = b.combatants.at(-1) as Combatant;
  eidolon.hp = 12;
  for (const c of b.combatants) if (c.side === 'enemy') c.status = 'dead';
  b.outcome = 'party';
  const result = { outcome: 'party' as const, rounds: 1, deaths: 0, battle: b };
  return { w, fight, result, eidolon };
}

describe('summoned servants after the fight (Phase 18a)', () => {
  it('follow the party until dawn in an NPC slot, then fade', () => {
    const { w, fight, result } = summoned();
    applyBattle(w, data, fight, result, null);
    const npc = w.npcs[0];
    expect(npc).toMatchObject({
      kind: 'summon',
      type: 'phantasmal-eidolon',
      name: 'Phantasmal Eidolon',
      hp: 12,
      maxHp: 20,
      master: member(w, 'Fizzwick').id,
    });
    expect(w.log.join('\n')).toContain('Phantasmal Eidolon follows the party until dawn.');
    expect(npcMonster(data, npc as never).id).toBe('phantasmal-eidolon');
    expect(fights(data, npc as never)).toBe(true);
    const lirael = member(w, 'Lirael');
    lirael.character = {
      ...lirael.character,
      inventory: [
        ...lirael.character.inventory,
        { id: HEALERS_KIT, quantity: 1, location: 'stowed' },
      ],
    };
    const medic = healers(w, data)[0]?.id ?? '';
    expect(firstAid(w, data, medic, npc?.id ?? '')).toEqual({
      ok: false,
      reason: 'Bandages do nothing for Phantasmal Eidolon.',
    });
    w.rng = createRng('dawn');
    endOfDay(w, data);
    expect(w.npcs).toEqual([]);
    expect(w.log.join('\n')).toContain('Phantasmal Eidolon fades with the dawn.');
  });

  it('fade at once with no slot free, and stay gone if slain', () => {
    const full = summoned(2);
    applyBattle(full.w, data, full.fight, full.result, null);
    expect(full.w.npcs.some((n) => n.kind === 'summon')).toBe(false);
    expect(full.w.log.join('\n')).toContain('Phantasmal Eidolon fades, with no room');
    // A servant called up on the enemy's side never joins the party.
    const theirs = summoned();
    theirs.eidolon.side = 'enemy';
    applyBattle(theirs.w, data, theirs.fight, theirs.result, null);
    expect(theirs.w.npcs).toEqual([]);
    const slain = summoned();
    slain.eidolon.status = 'dead';
    applyBattle(slain.w, data, slain.fight, slain.result, null);
    expect(slain.w.npcs).toEqual([]);
  });

  it('can be dismissed', () => {
    const { w, fight, result } = summoned();
    applyBattle(w, data, fight, result, null);
    expect(dismiss(w, data, w.npcs[0]?.id ?? '')).toEqual({ ok: true });
    expect(w.log.at(-1)).toContain('Phantasmal Eidolon is dismissed and fades.');
  });
});

describe('one guardian to a caster', () => {
  it('lets a new Elemental Guardian take the old one’s place', () => {
    const w = world();
    w.position = { col: 5, row: 9 };
    const fizz = member(w, 'Fizzwick');
    const old = addNpc(w, data, 'summon', 'elemental-guardian', 'elemental-guardian', 'Old', true);
    Object.assign(old ?? {}, { master: fizz.id });
    w.encounter = encounter([['thug-or-militia']]);
    const fight = encounterBattle(w, data);
    const b = fight.battle;
    const f = b.combatants.find((c) => c.name === 'Fizzwick') as Combatant;
    Object.assign(f.caster as CasterState, {
      level: 7,
      arts: [],
      prepared: ['elemental-guardian'],
      spellsLeft: 1,
    });
    castMagic(b, f, 'elemental-guardian', undefined, undefined);
    for (const c of b.combatants) if (c.side === 'enemy') c.status = 'dead';
    b.outcome = 'party';
    applyBattle(w, data, fight, { outcome: 'party', rounds: 1, deaths: 0, battle: b }, null);
    expect(w.npcs.map((n) => n.name)).toEqual(['Elemental Guardian']);
    expect(w.log.join('\n')).toContain('Old fades as another takes its place.');
  });
});
