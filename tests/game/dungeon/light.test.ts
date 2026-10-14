import { describe, expect, it } from 'vitest';
import {
  burn,
  carried,
  douse,
  drawKits,
  inDark,
  kindle,
  spareTorches,
} from '../../../src/game/dungeon/light.ts';
import { enterDungeon } from '../../../src/game/dungeon/explore.ts';
import type { World } from '../../../src/game/world/types.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, member, world } from '../world/helpers.ts';

const give = (w: World, name: string, id: string, quantity: number) => {
  const m = member(w, name);
  m.character = {
    ...m.character,
    inventory: [...m.character.inventory, { id, quantity, location: 'stowed' as const }],
  };
};
const below = (w = world()) => {
  w.position = { col: 5, row: 10 };
  enterDungeon(w, data);
  return w;
};

describe('light underground (docs/rules-adaptation.md, Dungeon exploration)', () => {
  it('draws one torch from each kit once per trip to town and lights one', () => {
    const w = below();
    expect(carried(w, 'dungeoneering-kit')).toBe(2);
    expect(w.light).toEqual({
      lit: 'torch',
      torch: 6,
      lantern: 0,
      kitTorches: 1,
      kitsReady: false,
    });
    expect(w.log.join('\n')).toContain('The party takes 2 torches from its kits.');
    drawKits(w);
    expect(w.light.kitTorches).toBe(1);
    expect(spareTorches(w)).toBe(1);
    expect(kindle(w)).toBe(true);
    expect(w.log.filter((l) => l.includes('A torch is lit.'))).toHaveLength(1);
  });

  it('draws nothing without kits', () => {
    const w = world();
    for (const m of w.members)
      m.character = {
        ...m.character,
        inventory: m.character.inventory.filter((e) => e.id !== 'dungeoneering-kit'),
      };
    drawKits(w);
    expect(w.light).toMatchObject({ kitTorches: 0, kitsReady: false });
  });

  it('prefers the lantern, filling it from a pint of oil', () => {
    const w = world();
    give(w, 'Snag', 'lantern', 1);
    give(w, 'Snag', 'oil-one-pint', 2);
    expect(kindle(w)).toBe(true);
    expect(w.light).toMatchObject({ lit: 'lantern', lantern: 12 });
    expect(carried(w, 'oil-one-pint')).toBe(1);
    expect(kindle(w)).toBe(true);
    expect(w.log.filter((l) => l.includes('The lantern is lit.'))).toHaveLength(1);
    // The last pint goes, and a dry lantern with no oil falls back to torches.
    w.light.lantern = 0;
    kindle(w);
    expect(carried(w, 'oil-one-pint')).toBe(0);
    w.light.lantern = 0;
    give(w, 'Grukk', 'torch', 2);
    w.light.kitTorches = 0;
    expect(kindle(w)).toBe(true);
    expect(w.light).toMatchObject({ lit: 'torch', torch: 6 });
    expect(carried(w, 'torch')).toBe(1);
  });

  it('burns down each use and lights the next, until the party is in the dark', () => {
    const w = below();
    w.light.kitTorches = 0;
    w.rng = scriptedRng([3, 1, 3, 2]);
    burn(w, data);
    expect(w.light.torch).toBe(6);
    burn(w, data);
    burn(w, data);
    expect(w.light.torch).toBe(4);
    burn(w, data);
    expect(w.light).toMatchObject({ lit: null, torch: 0 });
    expect(w.log.slice(-2)).toEqual([
      'Day 1, day: The torch gutters out.',
      'Day 1, day: The party is in the dark.',
    ]);
    expect(inDark(w, data)).toBe(true);
    burn(w, data);
    expect(w.light.lit).toBeNull();
  });

  it('runs a lantern dry', () => {
    const w = below();
    give(w, 'Snag', 'lantern', 1);
    w.light = { ...w.light, lit: 'lantern', lantern: 4 };
    w.rng = scriptedRng([1]);
    burn(w, data);
    expect(w.log.slice(-2)).toEqual([
      'Day 1, day: The lantern runs dry.',
      'Day 1, day: A torch is lit.',
    ]);
  });

  it('goes out on the surface without a word', () => {
    const w = world();
    expect(kindle(w)).toBe(false);
    expect(w.log.some((l) => l.includes('dark'))).toBe(false);
    expect(inDark(w, data)).toBe(false);
    w.light.lit = 'torch';
    douse(w);
    expect(w.light.lit).toBeNull();
  });
});

describe('fighting in the dark', () => {
  it('replays and fights the party at -4 to hit with no light', async () => {
    const { partySetup, battleFrom } = await import('../../../src/game/world/fight.ts');
    const { createRng } = await import('../../../src/rules/rng.ts');
    const w = below();
    expect(partySetup(w, data, [['thug-or-militia']], true).dark).toBe(false);
    w.light.lit = null;
    const setup = partySetup(w, data, [['thug-or-militia']], true);
    expect(setup.dark).toBe(true);
    const b = battleFrom(data, createRng('dark'), setup, false);
    expect(b.dark).toBe(true);
    const { hitModifier } = await import('../../../src/game/combat/targeting.ts');
    expect(b.combatants.map((c) => hitModifier(b, c))).toContain(-4);
  });
});

describe('world save version 7', () => {
  it('upgrades a version 6 save with kits ready and a party underground at turn 0', async () => {
    const { parseWorld, serializeWorld } = await import('../../../src/game/world/save.ts');
    const w = below();
    const save = JSON.parse(serializeWorld(w));
    delete save.light;
    delete save.dungeon.turn;
    delete save.dungeon.steps;
    const loaded = parseWorld(JSON.stringify({ ...save, schemaVersion: 6 }), data);
    expect(loaded.ok && loaded.world.dungeon).toMatchObject({ turn: 0, steps: 0 });
    expect(loaded.ok && loaded.world.light).toEqual({
      lit: null,
      torch: 0,
      lantern: 0,
      kitTorches: 0,
      kitsReady: true,
    });
    const back = parseWorld(serializeWorld(w), data);
    expect(back.ok && back.world.light).toEqual(w.light);
  });
});

describe('world save version 8', () => {
  it('upgrades a version 7 save with nothing found underground', async () => {
    const { parseWorld, serializeWorld } = await import('../../../src/game/world/save.ts');
    const save = JSON.parse(serializeWorld(below()));
    const gone = ['found', 'glimpsed', 'traps', 'read'];
    save.dungeon = Object.fromEntries(
      Object.entries(save.dungeon).filter(([k]) => !gone.includes(k)),
    );
    const loaded = parseWorld(JSON.stringify({ ...save, schemaVersion: 7 }), data);
    expect(loaded.ok && loaded.world.dungeon).toMatchObject({
      found: {},
      glimpsed: {},
      traps: {},
      read: {},
    });
    const surface = JSON.parse(serializeWorld(world()));
    const up = parseWorld(JSON.stringify({ ...surface, schemaVersion: 7 }), data);
    expect(up.ok && up.world.dungeon).toBeNull();
  });
});
