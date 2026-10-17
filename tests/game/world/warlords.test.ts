import { describe, expect, it } from 'vitest';
import type { Special } from '../../../src/data/schemas/index.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { rollEnemies } from '../../../src/game/world/encounters.ts';
import { mountSellPrice } from '../../../src/game/world/mounts.ts';
import { newWorld } from '../../../src/game/world/new-world.ts';
import { addLoot, exchangeLoot, sellPrice } from '../../../src/game/world/shop.ts';
import { spoils, warbandWeights, warlordOfHoard } from '../../../src/game/world/warlords.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, starter } from './helpers.ts';

const party = (['snag', 'grukk'] as const).map((n, i) => ({
  character: starter(n),
  row: 0,
  column: i,
  defaultAction: 'auto' as const,
}));
const wastes = () => newWorld(data, createRng('warlords'), party, undefined, null, 'wastes');

/** Each warlord's hoard, by its fight's key. */
const hoards = data.content.dungeons.flatMap((d) =>
  d.levels.flatMap((l) =>
    l.specials.flatMap((s: Special) =>
      s.kind === 'cache' && s.warlord
        ? [{ key: `${d.id}/${l.id}/${s.at.x},${s.at.y}`, lord: s.warlord }]
        : [],
    ),
  ),
);
const keyOf = (lord: string) => (hoards.find((h) => h.lord === lord) as { key: string }).key;
const met = (w: ReturnType<typeof wastes>, table: string, monster: string, tries = 400) => {
  for (let i = 0; i < tries; i++)
    if (rollEnemies(w, data, table).rows.flat().includes(monster)) return true;
  return false;
};

describe('the Wastes’ warlords (Sam’s calls)', () => {
  it('each hold one hoard, named by its fight’s key', () => {
    expect(hoards.map((h) => h.lord).sort()).toEqual(
      data.content.warlords.warlords.map((l) => l.id).sort(),
    );
    for (const h of hoards) expect(warlordOfHoard(data, h.key)?.id).toBe(h.lord);
    expect(warlordOfHoard(data, 'nowhere/at-all/0,0')).toBeUndefined();
    expect(warlordOfHoard(data, 'garrison-post')).toBeUndefined();
    const plain = data.content.dungeons[0]?.levels[0];
    expect(
      warlordOfHoard(data, `${data.content.dungeons[0]?.id}/${plain?.id}/0,0`),
    ).toBeUndefined();
  });

  it('fall when their hoard is won, once, with word in the journal', () => {
    const w = wastes();
    emit(w, data, { kind: 'fight-won', quest: null, garrison: null });
    expect(w.warlords).toEqual([]);
    emit(w, data, { kind: 'fight-won', quest: null, garrison: keyOf('scrap-king') });
    emit(w, data, { kind: 'fight-won', quest: null, garrison: keyOf('scrap-king') });
    expect(w.warlords).toEqual(['scrap-king']);
    expect(w.log.join('\n')).toContain('The Scrap King is dead.');
    emit(w, data, { kind: 'hex-entered' });
    expect(w.warlords).toEqual(['scrap-king']);
  });

  it('send their warband riding until they fall, and thin their map after', () => {
    const w = wastes();
    expect(met(w, 'wastes-1-open', 'scrap-prince')).toBe(true);
    const open = data.content.encounterTables.find((t) => t.id === 'wastes-1-open');
    const ruins = data.content.encounterTables.find((t) => t.id === 'wastes-1-ruins');
    if (!open || !ruins) throw new Error('missing tables');
    const before = warbandWeights(w, data, open.id, open.entries);
    w.warlords.push('scrap-king');
    expect(met(w, 'wastes-1-open', 'scrap-prince')).toBe(false);
    const after = warbandWeights(w, data, open.id, open.entries);
    open.entries.forEach((e, i) => {
      const was = before[i] as number;
      expect(after[i]).toBe(e.warband ? 0 : e.nature === 'hostile' ? Math.ceil(was / 2) : was);
    });
    expect(warbandWeights(w, data, ruins.id, ruins.entries)).toEqual(
      ruins.entries.map((e) => e.weight),
    );
    // The next map's warband still rides.
    expect(met(w, 'wastes-2-open', 'gnoll-packlord')).toBe(true);
  });

  it('make their map’s villages pay a fifth more for gear, mounts, and loot', () => {
    const w = wastes();
    const crowbar = { id: 'crowbar', quantity: 1, location: 'stowed' as const };
    const gear = sellPrice(w, data, crowbar);
    const mount = mountSellPrice(w, data, 'riding-goat');
    expect(spoils(w, data)).toBe(0);
    w.warlords.push('baron-vesk');
    expect(spoils(w, data)).toBe(0);
    w.warlords.push('scrap-king');
    expect(spoils(w, data)).toBe(20);
    expect(sellPrice(w, data, crowbar)).toBeGreaterThan(gear);
    expect(mountSellPrice(w, data, 'riding-goat')).toBeGreaterThan(mount);
    addLoot(w, [{ count: 2, sides: 6 }]);
    w.rng = scriptedRng([5, 5]);
    expect(exchangeLoot(w, data)).toEqual({ rolled: 10, paid: 12 });
  });
});
