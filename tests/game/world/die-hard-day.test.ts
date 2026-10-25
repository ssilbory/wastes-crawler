import { describe, expect, it } from 'vitest';
import { concludeBattle } from '../../../src/game/combat/aftermath.ts';
import { applyBattle, encounterBattle } from '../../../src/game/world/fight.ts';
import { WORLD_MIGRATIONS } from '../../../src/game/world/save-migrations.ts';
import type { World } from '../../../src/game/world/types.ts';
import { data, encounter, member, world } from './helpers.ts';

// Die Hard level 2 (vendor/wwn-srd/1.0 Character Creation/1.6.0 Foci.md): "The first time each day
// that you are reduced to zero hit points by an injury, you instead survive with one hit point."
describe('Die Hard’s daily escape, across fights', () => {
  const grukkIn = (w: World) => {
    w.encounter = encounter([['thug-or-militia']]);
    const fight = encounterBattle(w, data);
    const c = fight.battle.combatants.find((x) => x.name === 'Grukk');
    if (!c) throw new Error('Grukk is not in the fight');
    return { fight, c };
  };

  it('is spent for the day once a fight uses it, and back the next day', () => {
    const w = world();
    const g = member(w, 'Grukk');
    g.character = {
      ...g.character,
      foci: g.character.foci.map((f) => (f.id === 'die-hard' ? { ...f, level: 2 } : f)),
    };
    const { fight, c } = grukkIn(w);
    expect(c.lastStand).toBe(true);
    Object.assign(c, { lastStand: false, lastStandUsed: true });
    for (const x of fight.battle.combatants.filter((y) => y.side === 'enemy')) x.status = 'dead';
    fight.battle.outcome = 'party';
    applyBattle(w, data, fight, concludeBattle(fight.battle), null);
    expect(g.lastStandDay).toBe(w.day);
    expect(grukkIn(w).c.lastStand).toBe(false);
    w.day += 1;
    expect(grukkIn(w).c.lastStand).toBe(true);
  });

  it('gives older saves no day spent', () => {
    const up = WORLD_MIGRATIONS[44] as (raw: Record<string, unknown>) => Record<string, unknown>;
    expect(up({ schemaVersion: 44, members: [{ id: 'm-0' }], benched: [] })).toEqual({
      schemaVersion: 45,
      members: [{ id: 'm-0', lastStandDay: null }],
      benched: [],
    });
    expect(up({ schemaVersion: 44, members: 'odd', benched: [] })).toMatchObject({
      members: 'odd',
    });
  });
});
