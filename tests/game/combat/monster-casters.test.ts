import { describe, expect, it } from 'vitest';
import { findMonster } from '../../../src/game/character/context.ts';
import { monsterAction } from '../../../src/game/combat/ai.ts';
import { monsterCombatant } from '../../../src/game/combat/monster-combatant.ts';
import { monsterCaster } from '../../../src/game/combat/monster-caster.ts';
import { takeTurn } from '../../../src/game/combat/round.ts';
import type { CasterState, Combatant } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, standardBattle, who } from './helpers.ts';

const caster = (c: Combatant) => c.caster as CasterState;

describe('monster casters (SRD 5.0 Monster and NPC Stats)', () => {
  it('casts at its hit dice, with Effort of its skill plus two and Magic at its skill', () => {
    const mage = monsterCombatant(data, 'petty-mage', 'm', createRng('mage'));
    expect(mage.caster).toMatchObject({
      level: 2,
      effortMax: 3,
      spellsLeft: 1,
      prepared: ['the-coruscating-coffin'],
      known: ['the-coruscating-coffin'],
      arts: ['empowered-sorcery'],
      magicSkill: 1,
      canCast: true,
    });
    expect(mage.skills).toEqual({ magic: 1 });
    const thug = monsterCombatant(data, 'thug-or-militia', 't', createRng('thug'));
    expect(thug.caster).toBeNull();
    expect(thug.skills).toEqual({});
  });

  it("gives reskins their base's magic, or their own", () => {
    const crafter = monsterCombatant(data, 'flesh-crafter', 'c', createRng('c'));
    expect(caster(crafter).prepared).toEqual(['the-coruscating-coffin']);
    // A 6-HD partial elementalist: three spells a day, Effort 2 + 2.
    const patriarch = monsterCombatant(data, 'elven-patriarch', 'p', createRng('p'));
    expect(patriarch.caster).toMatchObject({
      level: 6,
      effortMax: 4,
      spellsLeft: 3,
      arts: ['elemental-blast', 'stunning-shock'],
    });
    expect(monsterCombatant(data, 'warrior-baron', 'b', createRng('b')).caster).toBeNull();
  });

  it('rejects an unknown casting table', () => {
    const m = findMonster(data, 'petty-mage');
    if (!m) throw new Error('missing content');
    expect(() =>
      monsterCaster(data, m, { tradition: 'high-mage', slots: 'bardic', spells: [], arts: [] }),
    ).toThrow('unknown casting table bardic');
  });

  it('casts before it attacks, and falls back to its weapon', () => {
    const b = standardBattle([['thug-or-militia'], ['petty-mage']]);
    const mage = who(b, 'foe-1-0');
    const grukk = who(b, 'Grukk');
    grukk.hp = 99;
    expect(monsterAction(b, mage)).toEqual({
      kind: 'cast',
      magic: 'the-coruscating-coffin',
      target: grukk.id,
      strain: false,
    });
    caster(mage).spellsLeft = 0;
    // No spell left, and the rear row can't reach with a dagger.
    expect(monsterAction(b, mage)).toEqual({ kind: 'wait' });
    caster(mage).spellsLeft = 1;
    mage.instinctive = true;
    mage.row = 0;
    expect(monsterAction(b, mage)).toMatchObject({ kind: 'attack' });
  });

  it('stuns a PC with Stunning Shock', () => {
    const b = standardBattle([['elven-patriarch']]);
    const patriarch = who(b, 'foe-0-0');
    caster(patriarch).spellsLeft = 0;
    expect(monsterAction(b, patriarch)).toMatchObject({ kind: 'cast', magic: 'stunning-shock' });
  });

  it('casts once a turn whatever its attacks, and takes On Turn magic first', () => {
    const b = standardBattle([['tribal-shaman']], createRng('shaman'));
    const shaman = who(b, 'foe-0-0');
    shaman.attacksPerRound = 2;
    b.queue = [shaman.id];
    takeTurn(b, shaman, monsterAction);
    // Pavis of Elements as a free action, then one Coffin and no second swing.
    expect(shaman.acBonus).toBe(4);
    expect(caster(shaman).spellsLeft).toBe(1);
    expect(b.log?.filter((l) => l.includes('casts'))).toHaveLength(1);
  });
});
