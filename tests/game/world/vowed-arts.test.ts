import { describe, expect, it } from 'vitest';
import { passTurn } from '../../../src/game/dungeon/time.ts';
import { endOfDay } from '../../../src/game/world/day.ts';
import { setHp } from '../../../src/game/world/members.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { mastersVigor, purifiedNeeds, purifyBodies } from '../../../src/game/world/vowed-arts.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { below } from '../dungeon/helpers.ts';
import { data, member, world } from './helpers.ts';
import { endQuarter } from '../../../src/game/world/end-quarter.ts';

/** Snag as a level 3 Monk out of armor, with these arts. */
function monk(w: World, arts: string[]): Member {
  const m = member(w, 'Snag');
  const cls = 'partial-warrior-vowed';
  m.character = {
    ...m.character,
    classes: { current: cls, levels: { [cls]: 3 } },
    arts: ['martial-style', 'unarmed-might', 'unarmored-defense', ...arts],
    inventory: m.character.inventory.filter((e) => e.location !== 'worn'),
    // Exert-1 and Dex +1: Effort 2.
    skills: { ...m.character.skills, exert: 1 },
  };
  return m;
}

describe('Master’s Vigor (1.5.17)', () => {
  it('heals 12 a quarter and 2 every 6 dungeon turns, with no Effort, up to the maximum', () => {
    const w = world();
    const m = monk(w, ['masters-vigor']);
    m.effortDay = 9;
    setHp(m, 1);
    endQuarter(w, data);
    expect(m.character.hp.current).toBe(Math.min(13, m.character.hp.max));
    mastersVigor(w, data, 100);
    expect(m.character.hp.current).toBe(m.character.hp.max);
    const d = below();
    const n = monk(d, ['masters-vigor']);
    setHp(n, 1);
    (d.dungeon as NonNullable<typeof d.dungeon>).turn = 5;
    d.rng = createRng('turns');
    passTurn(d, data);
    expect(n.character.hp.current).toBe(3);
  });

  it('fails in armor and without the art', () => {
    const w = world();
    const m = monk(w, []);
    setHp(m, 1);
    mastersVigor(w, data, 2);
    expect(m.character.hp.current).toBe(1);
    const n = monk(world(), ['masters-vigor']);
    n.character = { ...n.character, inventory: member(world(), 'Snag').character.inventory };
    setHp(n, 1);
    mastersVigor({ ...w, members: [n] }, data, 2);
    expect(n.character.hp.current).toBe(1);
  });
});

describe('Purified Body (1.5.17)', () => {
  it('cures poison and then disease for Effort for the day each', () => {
    const w = world();
    const m = monk(w, ['purified-body']);
    m.poisoned = true;
    m.disease = { id: 'swamp-fever' } as Member['disease'];
    purifyBodies(w, data);
    expect(m).toMatchObject({ poisoned: false, disease: null });
    expect(m.effortDay).toBe(2);
  });

  it('stops when the Effort runs out', () => {
    const w = world();
    const m = monk(w, ['purified-body']);
    m.effortDay = 9;
    m.poisoned = true;
    purifyBodies(w, data);
    expect(m.poisoned).toBe(true);
    expect(purifiedNeeds(w, data, () => true).size).toBe(0);
  });

  it('spares the Vowed hunger and sleeplessness at day’s end', () => {
    const w = world();
    w.position = { col: 5, row: 9 };
    const m = monk(w, ['purified-body']);
    w.rations = 0;
    w.rng = createRng('night');
    endOfDay(w, data);
    expect(m).toMatchObject({ hungry: false, sleepless: false });
    expect(member(w, 'Grukk')).toMatchObject({ hungry: true, sleepless: true });
  });
});
