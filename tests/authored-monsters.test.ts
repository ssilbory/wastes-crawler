import { describe, expect, it } from 'vitest';
import { combatReferenceErrors } from '../src/data/combat-check.ts';
import { loadContent } from '../src/data/content.ts';
import { loadSrd } from '../src/data/load.ts';
import { allMonsters } from '../src/data/monsters.ts';
import { findMonster } from '../src/game/character/context.ts';
import { monsterCombatant } from '../src/game/combat/combatants.ts';
import { createRng } from '../src/rules/rng.ts';

const srd = loadSrd();
const content = loadContent();
const data = { srd, content };

describe('authored monsters', () => {
  it('stand alongside the SRD monsters, with combat data', () => {
    expect(allMonsters(srd, content).map((m) => m.id)).toContain('vorpal-hare');
    expect(allMonsters(srd, content)).toHaveLength(srd.monsters.length + content.monsters.length);
    expect(findMonster(data, 'vorpal-hare')).toMatchObject({
      name: 'Vorpal Hare',
      hitDice: 1,
      damage: { kind: 'dice', dice: { count: 1, sides: 12, modifier: 0 } },
      morale: 12,
    });
    expect(findMonster(data, 'jabberwock')).toBeUndefined();
    expect(content.monsterCombat.find((m) => m.id === 'vorpal-hare')?.mind).toBe('monster');
  });

  it('fight like any monster: 1d8 hit points a hit die and their own attack', () => {
    const hare = monsterCombatant(data, 'vorpal-hare', 'foe-0-0', createRng('hare'));
    expect(hare.hp).toBeGreaterThanOrEqual(1);
    expect(hare.hp).toBeLessThanOrEqual(8);
    expect(hare.attacks[0]).toMatchObject({
      name: 'Natural attack',
      hit: 4,
      damage: { count: 1, sides: 12 },
      shock: { damage: 3, maxAc: 15 },
    });
  });

  it('may not reuse an SRD monster id', () => {
    const [hare] = content.monsters;
    if (!hare) throw new Error('missing content');
    const clash = { ...content, monsters: [{ ...hare, id: 'herd-beast' }] };
    expect(combatReferenceErrors(srd, clash)).toContain(
      'monsters/herd-beast: clashes with an SRD monster',
    );
  });
});
