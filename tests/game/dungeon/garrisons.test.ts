import { describe, expect, it } from 'vitest';
import { enterDungeon, step } from '../../../src/game/dungeon/explore.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { encounterBattle } from '../../../src/game/world/fight.ts';
import { endOrder, learnCountersign, giveCountersign } from '../../../src/game/world/orders.ts';
import type { World } from '../../../src/game/world/types.ts';
import { data, encounter, member, world } from '../world/helpers.ts';
import { place } from './helpers.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';

/** The four starters inside a Dark Lands dungeon, on a cell. */
function inside(
  entrance: { col: number; row: number },
  level: string,
  x: number,
  y: number,
  facing: 'n' | 'e' | 's' | 'w',
): World {
  const w = world();
  enterRegion(w, 'dark-lands', entrance);
  enterDungeon(w, data);
  return place(w, level, x, y, facing);
}
const ASHGATE = { col: 22, row: 12 };
const VATS = { col: 17, row: 22 };

describe('garrison posts underground (docs/rules-adaptation.md, Standing orders)', () => {
  it('challenge on their cell until beaten or the order ends, and the post stays beaten', () => {
    const w = inside(ASHGATE, 'ashgate-ward', 4, 6, 'n');
    step(w, data, 'forward');
    expect(w.encounter).toMatchObject({
      enemies: [['bound-goblin-sentry', 'bound-goblin-sentry', 'bound-goblin-sentry']],
      order: 'ashgate-hold',
      garrison: 'ashgate-keep/ashgate-ward/4,5',
      hostile: true,
      spotted: true,
    });
    expect(w.encounter?.text).toContain('Three old goblins stand to in the gatehouse');
    expect(w.log.at(-1)).toContain('(The Outer Ward 4,5)');
    expect(encounterBattle(w, data).garrison).toBe('ashgate-keep/ashgate-ward/4,5');
    w.encounter = null;
    emit(w, data, { kind: 'fight-won', quest: null, garrison: 'ashgate-keep/ashgate-ward/4,5' });
    expect(w.beaten).toEqual(['ashgate-keep/ashgate-ward/4,5']);
    step(w, data, 'back');
    step(w, data, 'forward');
    expect(w.encounter).toBeNull();
    // A win elsewhere clears nothing.
    emit(w, data, { kind: 'fight-won', quest: null, garrison: null });
    expect(w.beaten).toHaveLength(1);
  });

  it('stand down everywhere once the countersign from the vaults is given', () => {
    const w = inside(ASHGATE, 'ashgate-vaults', 7, 6, 's');
    step(w, data, 'forward');
    expect(w.countersigns).toEqual(['ashgate-hold']);
    expect(w.log.at(-2)).toContain("the last orders of Ashgate's commander");
    place(w, 'ashgate-vaults', 1, 3, 'n');
    step(w, data, 'forward');
    expect(w.encounter?.enemies).toEqual([['bound-orc-guard'], ['bound-orc-captain']]);
    expect(giveCountersign(w, data)).toEqual({ ok: true });
    expect(w.encounter).toMatchObject({ hostile: false, offer: 'guard' });
    w.encounter = null;
    place(w, 'ashgate-ward', 4, 2, 'n');
    step(w, data, 'forward');
    expect(w.encounter).toBeNull();
  });

  it('beaten overland garrisons stay beaten', () => {
    const w = world();
    enterRegion(w, 'dark-lands', { col: 18, row: 12 });
    emit(w, data, { kind: 'hex-entered' });
    expect(w.encounter?.garrison).toBe('dark-lands/18,12');
    w.encounter = null;
    emit(w, data, { kind: 'fight-won', quest: null, garrison: 'dark-lands/18,12' });
    emit(w, data, { kind: 'hex-entered' });
    expect(w.encounter).toBeNull();
  });

  it('carry no post into a plain fight', () => {
    const w = world();
    w.encounter = encounter([['thug-or-militia']]);
    expect(encounterBattle(w, data).garrison).toBeNull();
    endOrder(w, data, 'ashgate-hold');
    learnCountersign(w, data, 'ashgate-hold');
    expect(w.ordersEnded).toEqual(['ashgate-hold']);
  });
});

describe('messages for some peoples (Phase 12c)', () => {
  it('speak to the orcs and goblins in the party, once', () => {
    const w = inside(VATS, 'vats-cull', 7, 6, 's');
    const before = w.log.length;
    step(w, data, 'forward');
    const read = w.log.slice(before).join('\n');
    expect(read).toContain('Ledgers fill the shelves');
    expect(read).toContain("Grukk finds the orc lines. Grukk's own breed is marked for the cull");
    expect(read).toContain("Snag finds the goblin lines. Snag's breed is listed as a failure");
    const lines = w.log.length;
    step(w, data, 'back');
    step(w, data, 'forward');
    expect(w.log).toHaveLength(lines);
  });

  it('say nothing to a party without them', () => {
    const w = inside(VATS, 'vats-cull', 7, 6, 's');
    member(w, 'Grukk').dead = true;
    member(w, 'Snag').dead = true;
    const before = w.log.length;
    step(w, data, 'forward');
    const read = w.log.slice(before).join('\n');
    expect(read).toContain('Ledgers fill the shelves');
    expect(read).not.toContain('lines');
  });
});
