import { describe, expect, it } from 'vitest';
import { hike } from '../../../src/game/world/activities.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { enterRegion } from '../../../src/game/world/crossing.ts';
import { startEncounter } from '../../../src/game/world/encounters.ts';
import {
  adoptVisage,
  disguised,
  PALANQUIN,
  palanquinUp,
  passInDisguise,
  raisePalanquin,
  VISAGE,
} from '../../../src/game/world/guises.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { below } from '../dungeon/helpers.ts';
import { fail, highMage } from './helpers-mage.ts';
import { data, encounter, member, world } from './helpers.ts';

describe('Adopt the Simulacular Visage', () => {
  it('gives the whole party the seeming of the bound until dawn', () => {
    const w = world();
    const m = highMage(w, [VISAGE]);
    expect(adoptVisage(w, data, m.id)).toEqual({ ok: true });
    expect(m.spellsCast).toBe(1);
    expect(w.disguise).toEqual({ day: 0, ids: ['m-0', 'm-1', 'm-2', 'm-3'] });
    expect(disguised(w)).toBe(true);
    w.quarter = 3;
    expect(disguised(w)).toBe(true);
    w.day = 1;
    w.quarter = 0;
    expect(disguised(w)).toBe(false);
  });

  it('fails anyone who joins after the casting, but not the dead', () => {
    const w = world();
    const m = highMage(w, [VISAGE]);
    adoptVisage(w, data, m.id);
    member(w, 'Snag').dead = true;
    expect(disguised(w)).toBe(true);
    w.npcs.push({ id: 'npc-9' } as never);
    expect(disguised(w)).toBe(false);
  });

  it('needs a caster level for each member and NPC', () => {
    const w = world();
    const m = highMage(w, [VISAGE], 5);
    w.npcs.push({ id: 'npc-0' } as never, { id: 'npc-1' } as never);
    expect(adoptVisage(w, data, m.id)).toEqual(
      fail('Fizzwick can change no more than 5 of the party.'),
    );
    m.character.classes.levels['full-high-mage'] = 6;
    expect(adoptVisage(w, data, m.id)).toEqual({ ok: true });
  });

  it('is refused in an encounter or unprepared', () => {
    const w = world();
    const m = highMage(w, [VISAGE]);
    w.encounter = encounter([['thug-or-militia']]);
    expect(adoptVisage(w, data, m.id)).toEqual(fail('Settle the encounter first.'));
    w.encounter = null;
    m.character.spells.prepared = [];
    expect(adoptVisage(w, data, m.id)).toEqual(
      fail("Fizzwick hasn't prepared Adopt the Simulacular Visage."),
    );
  });

  it('lets the party past a bound garrison without ending its order', () => {
    const w = world();
    const m = highMage(w, [VISAGE]);
    adoptVisage(w, data, m.id);
    enterRegion(w, 'dark-lands', { col: 18, row: 12 });
    emit(w, data, { kind: 'hex-entered' });
    expect(w.encounter).toMatchObject({ order: 'ruinfield-gate', hostile: false, spotted: true });
    expect(w.ordersEnded).toEqual([]);
    expect(w.log.at(-1)).toContain('Taking the party for their own, the bound let it pass.');
  });

  it('lets the party past a bound patrol, but not other groups or ended orders', () => {
    const w = world();
    const m = highMage(w, [VISAGE]);
    adoptVisage(w, data, m.id);
    w.rng = createRng('patrol');
    const patrol = { rows: [['bound-goblin-sentry']], nature: 'hostile' as const, captive: null };
    startEncounter(w, data, { ...patrol, order: 'ash-road-patrol' }, undefined, null, '5,9');
    expect(w.encounter).toMatchObject({ hostile: false, spotted: true });
    const plain = encounter([['thug-or-militia']]);
    passInDisguise(w, plain);
    expect(plain).toMatchObject({ hostile: true, spotted: false });
    const ended = encounter([['bound-goblin-sentry']], { order: 'ash-road-patrol' });
    w.ordersEnded = ['ash-road-patrol'];
    passInDisguise(w, ended);
    expect(ended.hostile).toBe(true);
    w.ordersEnded = [];
    w.day = 1;
    passInDisguise(w, ended);
    expect(ended.hostile).toBe(true);
  });
});

describe('The Jade Palanquin of the Faceless God', () => {
  it('lasts until dusk, or until dawn when cast in the evening or night', () => {
    const w = world();
    const m = highMage(w, [PALANQUIN]);
    expect(palanquinUp(w)).toBe(false);
    expect(raisePalanquin(w, data, m.id)).toEqual({ ok: true });
    expect(w.palanquin).toBe(2);
    expect(raisePalanquin(w, data, m.id)).toEqual(
      fail('The palanquin already floats beside the party.'),
    );
    w.quarter = 1;
    expect(palanquinUp(w)).toBe(true);
    w.quarter = 2;
    expect(palanquinUp(w)).toBe(false);
    m.spellsCast = 0;
    expect(raisePalanquin(w, data, m.id)).toEqual({ ok: true });
    expect(w.palanquin).toBe(4);
    w.quarter = 3;
    expect(palanquinUp(w)).toBe(true);
    w.day = 1;
    w.quarter = 0;
    expect(palanquinUp(w)).toBe(false);
  });

  it('lifts stowed gear off an overloaded member on the march, but not readied gear', () => {
    /** Snag carrying `extra` and marching a hex with every die rolling its lowest. */
    const staggers = (
      extra: { id: string; quantity: number; location: 'stowed' | 'readied' },
      up: boolean,
    ) => {
      const w = world();
      const m = highMage(w, [PALANQUIN]);
      if (up) raisePalanquin(w, data, m.id);
      const snag = member(w, 'Snag');
      snag.character = { ...snag.character, inventory: [...snag.character.inventory, extra] };
      w.rng = { next: () => 0, int: (min: number) => min, state: () => [1, 1, 1, 1] } as never;
      w.destination = { col: 4, row: 8 };
      hike(w, data, null, false);
      return w.log.filter((l) => l.endsWith('Snag staggers under the load.')).length;
    };
    const stowed = { id: 'dungeoneering-kit', quantity: 4, location: 'stowed' as const };
    const readied = { id: 'spear-light', quantity: 8, location: 'readied' as const };
    expect(staggers(stowed, false)).toBe(1);
    expect(staggers(stowed, true)).toBe(0);
    expect(staggers(readied, true)).toBe(1);
  });

  it('is refused underground or in an encounter', () => {
    const d = below();
    const m = highMage(d, [PALANQUIN]);
    expect(raisePalanquin(d, data, m.id)).toEqual(fail('The palanquin is no help below ground.'));
    const w = world();
    const n = highMage(w, [PALANQUIN]);
    w.encounter = encounter([['thug-or-militia']]);
    expect(raisePalanquin(w, data, n.id)).toEqual(fail('Settle the encounter first.'));
    w.encounter = null;
    n.character.spells.prepared = [];
    expect(raisePalanquin(w, data, n.id)).toEqual(
      fail("Fizzwick hasn't prepared The Jade Palanquin of the Faceless God."),
    );
  });
});
