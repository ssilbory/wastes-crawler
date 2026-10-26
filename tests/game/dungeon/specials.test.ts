import { describe, expect, it } from 'vitest';
import { step } from '../../../src/game/dungeon/explore.ts';
import { inDark } from '../../../src/game/dungeon/light.ts';
import { arriveOn, onSpecial, specialsHere } from '../../../src/game/dungeon/specials.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, world } from '../world/helpers.ts';
import { below, place, state } from './helpers.ts';
import { battleFrom, partySetup } from '../../../src/game/world/battle-setup.ts';

const lower = (x: number, y: number, facing: 'n' | 'e' | 's' | 'w') =>
  place(below(), 'barrow-lower', x, y, facing);

describe('special squares (docs/rules-adaptation.md, Dungeon exploration)', () => {
  it('shows a message the first time only', () => {
    const w = lower(1, 1, 'e');
    step(w, data, 'forward');
    expect(w.log.at(-1)).toContain('Old bones are heaped against the wall, picked clean.');
    const lines = w.log.length;
    step(w, data, 'back');
    step(w, data, 'forward');
    expect(w.log).toHaveLength(lines);
  });

  it('spins the party to a random facing without a word', () => {
    const w = lower(5, 1, 'e');
    w.rng = scriptedRng([2]);
    const lines = w.log.length;
    step(w, data, 'forward');
    expect(state(w)).toMatchObject({ at: { x: 6, y: 1 }, facing: 's' });
    expect(w.log).toHaveLength(lines);
  });

  it('is dark on a darkness square, whatever the light', () => {
    const w = lower(6, 3, 's');
    step(w, data, 'forward');
    expect(inDark(w, data)).toBe(true);
    expect(state(w).seen['barrow-lower']).toBeUndefined();
  });

  it('maps nothing on an anti-map square', () => {
    const w = lower(6, 6, 'n');
    step(w, data, 'forward');
    expect(onSpecial(w, data, 'anti-map')).toBe(true);
    expect(state(w).seen['barrow-lower']).toBeUndefined();
  });

  it('stops all casting in a fight on an anti-magic square', () => {
    const w = lower(5, 7, 'e');
    const setup = partySetup(w, data, [['petty-mage']], true);
    expect(setup.antiMagic).toBe(true);
    const battle = battleFrom(data, createRng('anti'), setup, false);
    const casters = battle.combatants.filter((c) => c.caster);
    expect(casters.length).toBeGreaterThan(0);
    expect(casters.every((c) => c.caster?.canCast === false)).toBe(true);
  });

  it('moves the party through a teleporter, and its far end does nothing', () => {
    const w = lower(6, 7, 'e');
    step(w, data, 'forward');
    expect(state(w)).toMatchObject({ level: 'barrow-lower', at: { x: 1, y: 1 }, facing: 's' });
    expect(w.log.at(-1)).toContain('The air twists, and the party stands somewhere else.');
  });

  it('has nothing to show on the surface', () => {
    expect(specialsHere(world(), data)).toEqual([]);
  });
});

describe('a message for one people (docs/rules-adaptation.md, Dungeon exploration)', () => {
  // The elf-or-gnome message at ember-shrine, shrine-ossuary (1, 3).
  const gatedSquare = () => {
    const w = place(below(), 'shrine-ossuary', 1, 3, 'n');
    state(w).dungeon = 'ember-shrine';
    return w;
  };

  it('stays unread while no elf or gnome is in the party', () => {
    const w = gatedSquare();
    for (const m of w.members) m.character = { ...m.character, people: 'orc' };
    arriveOn(w, data);
    expect(w.log.some((l) => l.includes('name-plates'))).toBe(false);
    expect(state(w).read['shrine-ossuary'] ?? []).toEqual([]);
  });

  it('shows once a reader of that people is in the party, then not again', () => {
    const w = gatedSquare();
    for (const m of w.members) m.character = { ...m.character, people: 'orc' };
    const reader = w.members[0];
    if (!reader) throw new Error('party expected');
    reader.character = { ...reader.character, people: 'gnome' };
    arriveOn(w, data);
    expect(w.log.at(-1)).toContain('name-plates');
    expect(w.log.at(-1)).toContain(reader.character.name);
    const lines = w.log.length;
    arriveOn(w, data);
    expect(w.log).toHaveLength(lines);
  });
});

describe('two plain messages on one square', () => {
  const twice = {
    ...data,
    content: {
      ...data.content,
      dungeons: data.content.dungeons.map((d) => ({
        ...d,
        levels: d.levels.map((l) =>
          l.id !== 'barrow-lower'
            ? l
            : {
                ...l,
                specials: [
                  ...l.specials,
                  { kind: 'message' as const, at: { x: 2, y: 1 }, text: 'A rat watches.' },
                ],
              },
        ),
      })),
    },
  };

  it('shows both together and marks the square read once', () => {
    const w = lower(2, 1, 'e');
    arriveOn(w, twice);
    expect(w.log.slice(-2).map((l) => l.replace(/^Day \d+, \w+: /, ''))).toEqual([
      'Old bones are heaped against the wall, picked clean.',
      'A rat watches.',
    ]);
    expect(state(w).read['barrow-lower']).toEqual(['2,1']);
  });
});
