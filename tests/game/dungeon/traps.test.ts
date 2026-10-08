import { describe, expect, it } from 'vitest';
import { step } from '../../../src/game/dungeon/explore.ts';
import { disarm, knownTrapAhead, springHere } from '../../../src/game/dungeon/traps.ts';
import { checkBonus, setHp } from '../../../src/game/world/members.ts';
import type { World } from '../../../src/game/world/types.ts';
import type { Trap } from '../../../src/data/schemas/index.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, encounter, member, world } from '../world/helpers.ts';
import { below, place, state } from './helpers.ts';

/** Data whose barrow dart trap is replaced. */
const withTrap = (change: Partial<Trap>) => ({
  ...data,
  content: {
    ...data.content,
    dungeons: data.content.dungeons.map((d) => ({
      ...d,
      levels: d.levels.map((l) => ({ ...l, traps: l.traps.map((t) => ({ ...t, ...change })) })),
    })),
  },
});
const sure = withTrap({ save: null });
/** At the dead end's trap, which is sprung by calling springHere. */
const onTrap = () => place(below(), 'barrow-upper', 4, 6, 'n');
/** Facing the trap from the cell south of it. */
const facing = () => place(below(), 'barrow-upper', 4, 7, 'n');
const only = (w: World, ...names: string[]) => {
  for (const m of w.members) if (!names.includes(m.character.name)) m.dead = true;
};

describe('traps (docs/rules-adaptation.md, Dungeon exploration)', () => {
  it('may be spotted ahead, stopping the party, and is then known', () => {
    const w = facing();
    w.rng = scriptedRng([6, 6]);
    const r = step(w, data, 'forward');
    expect(r.ok).toBe(false);
    expect(w.log.at(-1)).toMatch(/spots a dart trap ahead\.$/);
    expect(knownTrapAhead(w, data)?.name).toBe('dart trap');
    expect(step(w, data, 'forward')).toEqual({ ok: false, reason: 'The dart trap lies ahead.' });
    expect(state(w).at).toEqual({ x: 4, y: 7 });
    expect(knownTrapAhead(world(), data)).toBeUndefined();
  });

  it('springs on a party that misses it: each PC saves or is hurt', () => {
    const w = facing();
    w.rng = scriptedRng([1, 1, 20, 20, 20, 1, 3]);
    expect(step(w, data, 'forward')).toEqual({ ok: true });
    expect(w.log.slice(-5).map((l) => l.replace(/^.*?: /, ''))).toEqual([
      'The dart trap springs!',
      'Snag avoids it.',
      'Grukk avoids it.',
      'Lirael avoids it.',
      'Fizzwick takes 3 damage.',
    ]);
    expect(member(w, 'Fizzwick').character.hp.current).toBe(2);
    expect(state(w).traps['barrow-upper']).toEqual({ '4,6': 'noticed' });
  });

  it('springs when a known trap is stepped into, and in the dark goes unseen', () => {
    const w = facing();
    w.rng = scriptedRng([6, 6]);
    step(w, data, 'forward');
    w.rng = scriptedRng([20, 20, 20, 20]);
    expect(step(w, data, 'forward', true)).toEqual({ ok: true });
    expect(w.log.at(-5)).toContain('The dart trap springs!');
    const dark = facing();
    dark.light.lit = null;
    dark.rng = scriptedRng([20, 20, 20, 20]);
    expect(step(dark, data, 'forward')).toEqual({ ok: true });
  });

  it('is disarmed in a turn by the best hand, and is gone for good', () => {
    const w = facing();
    w.rng = scriptedRng([6, 6]);
    step(w, data, 'forward');
    w.rng = scriptedRng([6, 6, 3]);
    expect(disarm(w, data)).toEqual({ ok: true });
    expect(w.log.at(-1)).toMatch(/disarms the dart trap\.$/);
    expect(state(w)).toMatchObject({ turn: 1, traps: { 'barrow-upper': { '4,6': 'disarmed' } } });
    expect(knownTrapAhead(w, data)).toBeUndefined();
    w.rng = scriptedRng([]);
    expect(step(w, data, 'forward')).toEqual({ ok: true });
  });

  it('springs on a fumble by 2 or more, and holds on a near miss', () => {
    const near = facing();
    near.rng = scriptedRng([6, 6]);
    step(near, data, 'forward');
    const hand = near.members.reduce((a, b) =>
      checkBonus(data, b, 'sneak', ['dex']) > checkBonus(data, a, 'sneak', ['dex']) ? b : a,
    );
    const bonus = checkBonus(data, hand, 'sneak', ['dex']);
    // Two dice making 7 less the bonus: one short of difficulty 8.
    const dice = 7 - bonus;
    near.rng = scriptedRng([Math.min(6, dice - 1), Math.max(1, dice - Math.min(6, dice - 1)), 3]);
    disarm(near, data);
    expect(near.log.at(-1)).toMatch(/can't work out the dart trap\.$/);
    const bad = facing();
    bad.rng = scriptedRng([6, 6]);
    step(bad, data, 'forward');
    bad.rng = scriptedRng([1, 1, 20, 20, 20, 20, 3]);
    disarm(bad, data);
    expect(bad.log.join('\n')).toMatch(/fumbles the dart trap\.\n.*The dart trap springs!/);
  });

  it('refuses to disarm without a known trap ahead, in the dark, or mid-encounter', () => {
    const w = facing();
    expect(disarm(w, data)).toEqual({ ok: false, reason: 'There is no known trap ahead.' });
    w.rng = scriptedRng([6, 6]);
    step(w, data, 'forward');
    w.light.lit = null;
    expect(disarm(w, data)).toEqual({ ok: false, reason: 'It is too dark to work.' });
    w.encounter = encounter([['thug-or-militia']]);
    expect(disarm(w, data)).toEqual({ ok: false, reason: 'Settle the encounter first.' });
    expect(() => disarm(world(), data)).toThrow('the party is not in a dungeon');
  });

  it('leaves a PC brought to 0 HP Mortally Injured until another stabilizes them', () => {
    const w = onTrap();
    only(w, 'Snag', 'Grukk');
    setHp(member(w, 'Grukk'), 1);
    w.rng = scriptedRng([6, 6, 1, 1, 6, 6]);
    springHere(w, sure);
    expect(member(w, 'Snag').character.hp.current).toBe(2);
    expect(member(w, 'Grukk')).toMatchObject({ frail: true, dead: false });
    expect(member(w, 'Grukk').character.hp.current).toBe(1);
    expect(w.log.at(-1)).toContain('Snag saves Grukk, who is left Frail.');
  });

  it('kills the Mortally Injured no one can save, and the Frail at once', () => {
    const w = onTrap();
    only(w, 'Snag', 'Grukk');
    setHp(member(w, 'Grukk'), 1);
    w.rng = scriptedRng([1, 1, ...Array(12).fill(1)]);
    springHere(w, sure);
    expect(member(w, 'Grukk').dead).toBe(true);
    const frail = onTrap();
    only(frail, 'Snag', 'Grukk');
    member(frail, 'Grukk').frail = true;
    setHp(member(frail, 'Grukk'), 1);
    frail.rng = scriptedRng([1, 1]);
    springHere(frail, sure);
    expect(frail.log.at(-1)).toContain('Grukk was already Frail and dies.');
  });

  it('sends the party back to town when it kills everyone', () => {
    const w = onTrap();
    only(w, 'Grukk');
    setHp(member(w, 'Grukk'), 1);
    // The last face draws the crypt's raising quest for the dead (raising.ts).
    w.rng = scriptedRng([1, 0]);
    springHere(w, sure);
    expect(w.dungeon).toBeNull();
    expect(w.log.join('\n')).toContain('The party falls.');
  });

  it('ends the step or the disarming there when it kills the last of the party', () => {
    const w = facing();
    only(w, 'Grukk');
    setHp(member(w, 'Grukk'), 1);
    w.rng = scriptedRng([1, 1, 1, 6, 0]);
    expect(step(w, data, 'forward')).toEqual({ ok: true });
    expect(w.dungeon).toBeNull();
    const d = facing();
    only(d, 'Grukk');
    d.rng = scriptedRng([6, 6]);
    step(d, data, 'forward');
    setHp(member(d, 'Grukk'), 1);
    d.rng = scriptedRng([1, 1, 1, 6, 0]);
    expect(disarm(d, data)).toEqual({ ok: true });
    expect(d.dungeon).toBeNull();
  });

  it('alarms bring nothing on a quiet level, or while others wait', () => {
    const quiet = {
      ...sure,
      content: {
        ...sure.content,
        dungeons: sure.content.dungeons.map((x) => ({
          ...x,
          levels: x.levels.map((l) => ({ ...l, wander: null })),
        })),
      },
    };
    const w = onTrap();
    const alarm = (d: typeof data) => ({
      ...d,
      content: {
        ...d.content,
        dungeons: d.content.dungeons.map((x) => ({
          ...x,
          levels: x.levels.map((l) => ({
            ...l,
            traps: l.traps.map((t) => ({ ...t, save: null, effect: { kind: 'alarm' as const } })),
          })),
        })),
      },
    });
    w.rng = scriptedRng([]);
    springHere(w, alarm(quiet));
    expect(w.encounter).toBeNull();
    w.encounter = encounter([['thug-or-militia']]);
    springHere(w, alarm(data));
    expect(w.encounter.enemies).toEqual([['thug-or-militia']]);
  });

  it('poisons for half the maximum hit points, and alarms call the wanderers', () => {
    const w = onTrap();
    only(w, 'Snag');
    w.rng = scriptedRng([]);
    springHere(w, withTrap({ save: null, effect: { kind: 'poison' } }));
    expect(member(w, 'Snag').character.hp.current).toBe(4);
    // The poison lingers.
    expect(member(w, 'Snag').poisoned).toBe(true);
    // Filth passes on its disease and does no other harm.
    const filth = onTrap();
    only(filth, 'Snag');
    filth.rng = scriptedRng([]);
    springHere(filth, withTrap({ save: null, effect: { kind: 'disease', disease: 'pit-flux' } }));
    const snag = member(filth, 'Snag');
    expect([snag.disease?.id, snag.character.hp.current]).toEqual(['pit-flux', 8]);
    const loud = onTrap();
    loud.rng = scriptedRng([1, 1, 1, 1, 1, 1, 1]);
    springHere(loud, withTrap({ save: null, effect: { kind: 'alarm' } }));
    expect(loud.encounter?.spotted).toBe(false);
  });
});
