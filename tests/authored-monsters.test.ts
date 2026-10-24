import { describe, expect, it } from 'vitest';
import { WORLD_MIGRATIONS } from '../src/game/world/save-migrations.ts';
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
    expect(baseMonster(content, 'death-hare')).toBe('death-hare');
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
    expect(allMonsters(srd, content).map((m) => m.id)).toContain('death-hare');
    expect(allMonsters(srd, content)).toHaveLength(
      srd.monsters.length + content.monsters.length + content.settingMonsters.length,
    );
    expect(findMonster(data, 'death-hare')).toMatchObject({
      name: 'Death Hare',
      hitDice: 1,
      hitPoints: { count: 1, sides: 3, modifier: 0 },
      damage: { kind: 'dice', dice: { count: 2, sides: 8, modifier: 0 } },
      morale: 12,
    });
    expect(findMonster(data, 'jabberwock')).toBeUndefined();
    expect(content.monsterCombat.find((m) => m.id === 'death-hare')?.mind).toBe('monster');
    const pit = content.arenaCards
      .find((c) => c.town === 'eastmarch')
      ?.bouts.find((b) => b.id === 'hare-pit');
    expect(pit).toMatchObject({ enemies: [Array(4).fill('death-hare')], toTheDeath: true });
  });

  it('breed the death hare into a beastman that fights and talks like one (Sam’s call)', () => {
    const hare = findMonster(data, 'death-hare');
    expect(findMonster(data, 'death-hare-beastman')).toMatchObject({
      name: 'Death Hare Beastman',
      hitDice: 2,
      attacks: 2,
      damage: hare?.damage,
      shock: hare?.shock,
      morale: 12,
    });
    expect(content.monsterCombat.find((m) => m.id === 'death-hare-beastman')).toMatchObject({
      mind: 'sapient',
      tags: ['humanoid'],
    });
    const forest = content.encounterTables.find((t) => t.id === 'forest');
    expect(
      forest?.entries.some((e) => e.groups.some((g) => g.monster === 'death-hare-beastman')),
    ).toBe(true);
    // Saves from before the rename meet the death hare.
    const up = WORLD_MIGRATIONS[42] as (raw: Record<string, unknown>) => Record<string, unknown>;
    expect(up({ schemaVersion: 42, encounter: { enemies: [['vorpal-hare']] } })).toEqual({
      schemaVersion: 43,
      encounter: { enemies: [['death-hare']] },
    });
  });

  it('fight like any monster: 1d8 hit points a hit die, or their own dice, and their attack', () => {
    for (let seed = 0; seed < 20; seed++) {
      const hare = monsterCombatant(data, 'death-hare', 'foe-0-0', createRng(`hare-${seed}`));
      expect(hare.hp).toBeGreaterThanOrEqual(1);
      expect(hare.hp).toBeLessThanOrEqual(3);
      const beastman = monsterCombatant(
        data,
        'death-hare-beastman',
        'foe-0-0',
        createRng(`${seed}`),
      );
      expect(beastman.hp).toBeGreaterThanOrEqual(2);
      expect(beastman.hp).toBeLessThanOrEqual(16);
    }
    const hare = monsterCombatant(data, 'death-hare', 'foe-0-0', createRng('hare'));
    expect(hare.ac).toBe(17);
    expect(hare.attacks[0]).toMatchObject({
      name: 'Natural attack',
      hit: 5,
      damage: { count: 2, sides: 8 },
      shock: { damage: 6, maxAc: 18 },
    });
    // The beastman claws and bites each round, both with the hare's Shock; the bite festers.
    const beastman = monsterCombatant(data, 'death-hare-beastman', 'foe-0-1', createRng('b'));
    expect(beastman.attacks.map((a) => [a.name, a.shock?.damage, a.onHit?.kind ?? null])).toEqual([
      ['Claw', 6, null],
      ['Shearing bite', 6, 'disease'],
    ]);
  });

  it('may not reuse an SRD monster id', () => {
    const [hare] = content.monsters;
    if (!hare) throw new Error('missing content');
    const clash = { ...content, monsters: [{ ...hare, id: 'herd-beast' }] };
    expect(combatReferenceErrors(srd, clash)).toContain(
      'monsters/herd-beast: clashes with an SRD monster',
    );
  });

  it('gives the master vampire blood priest arts and necromancy spells', () => {
    const vamp = content.monsterCombat.find((m) => m.id === 'master-vampire');
    expect(vamp?.caster).toMatchObject({
      tradition: 'blood-priest',
      spellTradition: 'necromancer',
      spells: ['final-death', 'compel-flesh'],
    });
    expect(combatReferenceErrors(srd, content)).toEqual([]);
  });
});
