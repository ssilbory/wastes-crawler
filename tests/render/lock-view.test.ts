import { describe, expect, it } from 'vitest';
import { lockSpoils } from '../../src/game/world/chests.ts';
import type { World } from '../../src/game/world/types.ts';
import { lockView, trapText } from '../../src/render/lock-view.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';
import { data, world } from '../game/world/helpers.ts';

const rules = data.content.chests;
const strip = (w: World, id: string) => {
  for (const m of w.members)
    m.character = {
      ...m.character,
      inventory: m.character.inventory.filter((e) => e.id !== id),
    };
};
const trap = rules.traps[0] as NonNullable<World['chests'][number]['trap']>;

describe('lockView', () => {
  it('shows nothing where nothing is locked', () => {
    expect(lockView(world(), data)).toBeNull();
  });

  it('names the hands and the gear each way in needs', () => {
    const w = world();
    strip(w, rules.tools.item);
    strip(w, rules.crowbar.item);
    w.rng = scriptedRng([0, 6, 6]);
    lockSpoils(w, data, [['thug-or-militia']], 1, null);
    const v = lockView(w, data);
    expect(v).toMatchObject({
      kind: 'chest',
      at: w.chests[0]?.at,
      trap: `A ${trap.name} guards it.`,
      disarm: { gear: '-2 without Criminal Tools' },
      pick: { gear: '-2 without Criminal Tools' },
      force: { gear: null },
      forceLabel: 'Force it open',
      noise: null,
    });
    expect(v?.pick.hand).toEqual(expect.any(String));
    const m = w.members[0];
    if (!m) throw new Error('no member');
    m.character = {
      ...m.character,
      inventory: [
        ...m.character.inventory,
        { id: rules.crowbar.item, quantity: 1, location: 'stowed' },
        { id: rules.tools.item, quantity: 1, location: 'stowed' },
      ],
    };
    expect(lockView(w, data)).toMatchObject({
      pick: { gear: null },
      force: { gear: '+1 with a crowbar' },
    });
  });

  it('tells what the party knows of the trap', () => {
    expect(trapText(null)).toBe('No one has looked it over yet.');
    const base = { trap, trapState: 'hidden' as const, looked: true };
    expect(trapText({ ...base, looked: false })).toBe('No one has looked it over yet.');
    expect(trapText(base)).toBe('No trap has been spotted on it.');
    expect(trapText({ ...base, trapState: 'noticed' })).toBe(`A ${trap.name} guards it.`);
    expect(trapText({ ...base, trap: null, trapState: 'noticed' })).toBe(
      'Something stirs inside it.',
    );
    expect(trapText({ ...base, trapState: 'disarmed' })).toContain('is disarmed');
    expect(trapText({ ...base, trapState: 'sprung' })).toContain('is spent');
    expect(trapText({ ...base, trap: null, trapState: 'sprung' })).toBe('Its trap is spent.');
  });
});
