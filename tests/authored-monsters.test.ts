import { describe, expect, it } from 'vitest';
import { combatReferenceErrors } from '../src/data/combat-check.ts';
import { loadContent } from '../src/data/content.ts';
import { loadSrd } from '../src/data/load.ts';
import { allMonsters, baseMonster, withSettingMonsters } from '../src/data/monsters.ts';
import { findMonster } from '../src/game/character/context.ts';
import { monsterCombatant } from '../src/game/combat/monster-combatant.ts';
import { createRng } from '../src/rules/rng.ts';

const srd = loadSrd();
const content = loadContent();
const data = { srd, content };

describe('authored monsters', () => {
  it('take setting monsters onto existing stat lines, combat entry and all', () => {
    const hound = findMonster(data, 'warbreed-hound');
    const pack = findMonster(data, 'small-pack-predator');
    expect(hound).toMatchObject({ name: 'Warbreed Hound', hitDice: pack?.hitDice, ac: pack?.ac });
    expect(content.monsterCombat.find((m) => m.id === 'warbreed-hound')).toEqual({
      ...content.monsterCombat.find((m) => m.id === 'small-pack-predator'),
      id: 'warbreed-hound',
    });
    expect(baseMonster(content, 'warbreed-hound')).toBe('small-pack-predator');
    // Every SRD automaton has a rogue clockwork or golem reskin.
    const automatons = srd.monsters.filter((m) => m.id.startsWith('automaton-')).map((m) => m.id);
    for (const id of automatons)
      expect(content.settingMonsters.some((r) => r.base === id)).toBe(true);
    expect(findMonster(data, 'iron-golem')).toMatchObject({ name: 'Iron Golem', hitDice: 10 });
    expect(baseMonster(content, 'vorpal-hare')).toBe('vorpal-hare');
    const orphan = {
      ...content,
      settingMonsters: [{ ...content.settingMonsters[0], base: 'nothing' }],
    };
    expect(allMonsters(srd, orphan as typeof content)).toHaveLength(
      srd.monsters.length + content.monsters.length,
    );
    expect(withSettingMonsters(orphan as typeof content).monsterCombat).toHaveLength(
      content.monsterCombat.length,
    );
  });

  it('stand alongside the SRD monsters, with combat data', () => {
    expect(allMonsters(srd, content).map((m) => m.id)).toContain('vorpal-hare');
    expect(allMonsters(srd, content)).toHaveLength(
      srd.monsters.length + content.monsters.length + content.settingMonsters.length,
    );
    expect(findMonster(data, 'vorpal-hare')).toMatchObject({
      name: 'Vorpal Hare',
      hitDice: 1,
      damage: { kind: 'dice', dice: { count: 1, sides: 12, modifier: 0 } },
      morale: 12,
    });
    expect(findMonster(data, 'jabberwock')).toBeUndefined();
    expect(content.monsterCombat.find((m) => m.id === 'vorpal-hare')?.mind).toBe('monster');
    const pit = content.arenaCards
      .find((c) => c.town === 'eastmarch')
      ?.bouts.find((b) => b.id === 'hare-pit');
    expect(pit).toMatchObject({ enemies: [Array(4).fill('vorpal-hare')], toTheDeath: true });
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
