import { describe, expect, it } from 'vitest';
import { lockSpoils } from '../../src/game/world/chests.ts';
import type { World } from '../../src/game/world/types.ts';
import { chestView } from '../../src/render/chest-view.ts';
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

describe('chestView', () => {
  it('shows nothing where nothing is locked', () => {
    expect(chestView(world(), data)).toBeNull();
  });

  it('names the hands and the gear each way in needs', () => {
    const w = world();
    strip(w, rules.tools.item);
    strip(w, rules.crowbar.item);
    w.rng = scriptedRng([0, 6, 6]);
    lockSpoils(w, data, [['thug-or-militia']], 1, null);
    const v = chestView(w, data);
    expect(v).toMatchObject({
      name: 'chest',
      trap: `A ${rules.traps[0]?.name} guards it.`,
      disarm: { gear: '-2 without Criminal Tools' },
      pick: { gear: '-2 without Criminal Tools' },
      force: { gear: null },
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
    expect(chestView(w, data)).toMatchObject({
      pick: { gear: null },
      force: { gear: '+1 with a crowbar' },
    });
  });

  it('tells what the party knows of the trap', () => {
    const w = world();
    w.rng = scriptedRng([0, 1, 1]);
    lockSpoils(w, data, [['thug-or-militia']], 1, null);
    const c = w.chests[0];
    if (!c) throw new Error('no chest');
    expect(chestView(w, data)?.trap).toBe('No trap has been spotted on it.');
    expect(chestView(w, data)?.disarm).toBeNull();
    c.looked = false;
    expect(chestView(w, data)?.trap).toBe('No one has looked it over yet.');
    c.trapState = 'disarmed';
    expect(chestView(w, data)?.trap).toContain('is disarmed');
    c.trapState = 'sprung';
    c.vault = true;
    expect(chestView(w, data)).toMatchObject({
      name: 'vault',
      trap: expect.stringContaining('spent'),
    });
  });
});
