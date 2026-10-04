import { describe, expect, it } from 'vitest';
import type { GameData } from '../../../src/game/character/context.ts';
import { camp } from '../../../src/game/world/activities.ts';
import { endOfDay } from '../../../src/game/world/day.ts';
import { startEncounter } from '../../../src/game/world/encounters.ts';
import { addNpc } from '../../../src/game/world/npcs.ts';
import type { World } from '../../../src/game/world/types.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { below } from '../dungeon/helpers.ts';
import { data, member, world } from './helpers.ts';

const PLAINS = { col: 5, row: 9 };
const rolled = { rows: [['thug-or-militia']], nature: 'wary' as const, captive: null };

/** The party out on the plains with a hireling of the given type. */
function withHireling(type: 'wilderness-guide' | 'mundane-physician', name: string): World {
  const w = world();
  w.purse = 100;
  addNpc(w, data, 'hireling', type, 'peaceful-human', name, false);
  w.position = { ...PLAINS };
  return w;
}

describe('Wilderness Guides (docs/rules-adaptation.md, Guides and porters)', () => {
  it('make a second roll to spot a group when the watcher misses it', () => {
    const w = withHireling('wilderness-guide', 'Tam');
    // Reaction 3+3; theirs 1+1; the watcher 1+1 loses; the guide 6+6 wins.
    w.rng = scriptedRng([3, 3, 4, 4, 1, 1, 6, 6]);
    startEncounter(w, data, rolled, member(w, 'Snag'), 0, '5,9');
    expect(w.encounter?.spotted).toBe(true);
    expect(w.encounter?.text).toContain('Tam spots 1 Thug or Militia');
    // With no watcher at all, the guide still looks.
    Object.assign(w, { encounter: null });
    w.rng = scriptedRng([3, 3, 6, 6, 1, 1]);
    startEncounter(w, data, rolled, undefined, 0, '5,9');
    expect(w.encounter?.spotted).toBe(false);
    expect(w.encounter?.text).toContain('The party meets 1');
  });

  it("don't roll when the watcher saw them first, or underground", () => {
    const w = withHireling('wilderness-guide', 'Tam');
    w.rng = scriptedRng([3, 3, 1, 1, 6, 6]);
    startEncounter(w, data, rolled, member(w, 'Snag'), 0, '5,9');
    expect(w.encounter?.text).toContain('Snag spots');
    const d = below();
    addNpc(d, data, 'hireling', 'wilderness-guide', 'peaceful-human', 'Tam', false);
    d.rng = scriptedRng([3, 3]);
    startEncounter(d, data, rolled, undefined, 0, 'here');
    expect(d.encounter?.spotted).toBe(false);
  });

  it('hunt once a day while the party camps outside town, without an extra check', () => {
    const w = withHireling('wilderness-guide', 'Tam');
    w.rations = 6;
    w.rng = scriptedRng([6, 6]);
    expect(camp(w, data, {}).extraChecks).toBe(0);
    expect(w.rations).toBe(10);
    expect(w.log.at(-1)).toContain('Tam brings in food.');
    camp(w, data, {});
    expect(w.rations).toBe(10);
    w.day += 1;
    w.rng = scriptedRng([1, 1]);
    camp(w, data, {});
    expect(w.log.at(-1)).toContain('Tam finds nothing.');
    // In town, and with no guide, nothing.
    const t = world();
    addNpc(t, data, 'hireling', 'wilderness-guide', 'peaceful-human', 'Tam', false);
    const lines = t.log.length;
    camp(t, data, {});
    expect(t.log).toHaveLength(lines);
  });

  it('forage where there is no game, and fish on water', () => {
    const noGame = (water: boolean): GameData => ({
      ...data,
      content: {
        ...data.content,
        terrains: data.content.terrains.map((t) =>
          t.id === 'plains' ? { ...t, hunt: null, water } : t,
        ),
      },
    });
    const w = withHireling('wilderness-guide', 'Tam');
    w.rations = 6;
    w.rng = scriptedRng([6, 6]);
    camp(w, noGame(false), {});
    expect(w.rations).toBe(8);
    expect(w.log.at(-1)).toContain('Tam forages food.');
    w.day += 1;
    w.rng = scriptedRng([6, 6]);
    camp(w, noGame(true), {});
    expect(w.log.at(-1)).toContain('Tam brings in food.');
  });
});

describe('Mundane Physicians (docs/rules-adaptation.md, First aid)', () => {
  it('keep off every condition but hunger, and add 1 HP to the night’s healing', () => {
    const w = withHireling('mundane-physician', 'Doc');
    w.position = { col: 3, row: 8 };
    const snag = member(w, 'Snag');
    snag.character = { ...snag.character, hp: { ...snag.character.hp, current: 1 } };
    endOfDay(w, data);
    // Nobody slept, yet nobody is Sleepless, and Snag heals level 1 + 1.
    expect(w.members.some((m) => m.sleepless || m.cold)).toBe(false);
    expect(snag.character.hp.current).toBe(3);
    expect(snag.character.strain.value).toBe(0);
  });

  it('try each night to nurse the Frail out of it (SRD 2.5.0, difficulty 10)', () => {
    const w = withHireling('mundane-physician', 'Doc');
    w.position = { col: 3, row: 8 };
    member(w, 'Snag').frail = true;
    member(w, 'Grukk').frail = true;
    w.rng = scriptedRng([6, 6, 1, 1]);
    endOfDay(w, data);
    expect(member(w, 'Snag').frail).toBe(false);
    expect(member(w, 'Grukk').frail).toBe(true);
    expect(w.log.join('\n')).toContain('Doc nurses Snag out of Frailty.');
  });
});
