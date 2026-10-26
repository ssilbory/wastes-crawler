import { describe, expect, it } from 'vitest';
import {
  createBattle,
  initiativeModifiers,
  runBattle,
  runRound,
  type NpcSetup,
} from '../../../src/game/combat/battle.ts';
import { monsterAction } from '../../../src/game/combat/ai.ts';
import { targets } from '../../../src/game/combat/targeting.ts';
import type { Attack } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { tendRound } from '../../../src/game/combat/aftermath.ts';
import { scriptedThen } from '../../helpers/scripted-rng.ts';
import { data, starter, who } from './helpers.ts';

const guard: NpcSetup = {
  monster: 'thug-or-militia',
  name: 'Bran',
  row: 0,
  column: 1,
  hp: 5,
  maxHp: 6,
  noncombatant: false,
};
const captive: NpcSetup = {
  monster: 'peaceful-human',
  name: 'Merrit',
  row: 1,
  column: 0,
  hp: 3,
  maxHp: 3,
  noncombatant: true,
};

function battle(npcs: NpcSetup[], enemies = [['thug-or-militia']], seed = 'npc') {
  return createBattle({
    data,
    rng: createRng(seed),
    party: [{ character: starter('snag'), row: 0, column: 0 }],
    npcs,
    enemies,
    log: true,
  });
}

describe('NPCs in the formation (docs/rules-adaptation.md, Party and formation)', () => {
  it('stand in their slots with the world’s hit points and their own name', () => {
    const b = battle([guard, captive]);
    expect(who(b, 'Bran')).toMatchObject({
      id: 'npc-0',
      side: 'party',
      kind: 'monster',
      row: 0,
      column: 1,
      hp: 5,
      maxHp: 6,
      noncombatant: false,
    });
    expect(who(b, 'Merrit')).toMatchObject({ id: 'npc-1', row: 1, noncombatant: true });
    expect(b.layout.party).toBe('formation');
    const dead = battle([{ ...guard, hp: 0 }]);
    expect(who(dead, 'Bran').status).toBe('dead');
  });

  it('checks the formation size and keeps characters and monster rows apart', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      ...guard,
      column: i % 4,
      row: i < 4 ? 0 : 1,
    }));
    expect(() => battle(many)).toThrow('at most eight party members');
    expect(() =>
      createBattle({
        data,
        rng: createRng('x'),
        party: [],
        npcs: [guard],
        allies: [['thug-or-militia']],
        enemies: [['thug-or-militia']],
      }),
    ).toThrow('a side is either characters or monsters');
  });

  it('targets non-combatants only when nobody else can be reached', () => {
    const b = battle([captive], [['veteran-soldier']]);
    const foe = who(b, 'foe-0-0');
    const attack = foe.attacks[0] as Attack;
    expect(targets(b, foe, attack).map((t) => t.name)).toEqual(['Snag']);
    who(b, 'Snag').status = 'dead';
    // The captive's rear slot is exposed with no one in front of it.
    expect(targets(b, foe, attack).map((t) => t.name)).toEqual(['Merrit']);
  });

  it('never attacks; a healer tends the dying, others wait', () => {
    const medic = { ...captive, name: 'Doc', healer: 1 };
    const b = battle([captive, { ...medic, column: 1 }]);
    expect(monsterAction(b, who(b, 'Merrit'))).toEqual({ kind: 'wait' });
    expect(monsterAction(b, who(b, 'Doc'))).toEqual({ kind: 'wait' });
    Object.assign(who(b, 'Snag'), { status: 'dying', hp: 0, fellRound: 1 });
    expect(monsterAction(b, who(b, 'Doc'))).toEqual({ kind: 'stabilize', target: 'pc-0' });
    expect(who(b, 'Doc')).toMatchObject({ healModifier: 1, hasHealKit: true });
  });

  it('rolls the side’s initiative from its PCs alone', () => {
    const b = battle([guard]);
    const snag = who(b, 'Snag');
    snag.modifiers = { ...snag.modifiers, dex: -1 };
    snag.initiativeBonus = 0;
    // The guard's flat +0 doesn't lift a clumsy party.
    expect(initiativeModifiers(b.combatants.filter((c) => c.side === 'party'))).toEqual({
      dex: -1,
      bonus: 0,
    });
    // With no PC able to act, the side rolls flat.
    snag.status = 'dying';
    expect(initiativeModifiers([snag, who(b, 'Bran')])).toEqual({ dex: 0, bonus: 0 });
  });

  it('leaves the dying to PCs and healers after a win: not guards, beasts or mounts', () => {
    const medic = { ...captive, name: 'Doc', healer: 1 };
    const b = battle([guard, { ...medic, column: 2 }]);
    for (const c of b.combatants.filter((x) => x.side === 'enemy')) c.status = 'dead';
    b.outcome = 'party';
    const snag = who(b, 'Snag');
    Object.assign(snag, { status: 'dying', hp: 0, fellRound: b.round });
    // Bran the guard has the best Heal bonus a non-healer could have (untrained −1), and Doc +1
    // with a kit: Doc tends, and Bran neither tends nor aids.
    b.rng = scriptedThen([6, 6], createRng('tend'));
    tendRound(b);
    expect(b.log?.join('\n')).toContain('Doc stabilizes Snag.');
    expect(b.log?.join('\n')).not.toContain('Bran');
  });

  it('loses when only non-combatants are left standing, and never promotes them', () => {
    const b = battle([captive], [['veteran-soldier']]);
    Object.assign(who(b, 'Snag'), { status: 'dead', hp: 0 });
    runRound(b);
    expect(b.outcome).toBe('enemy');
    expect(who(b, 'Merrit').row).toBe(1);
  });

  it('fights alongside the party, keeping its formation row', () => {
    const result = runBattle(battle([guard], [['peaceful-human']], 'side'));
    expect(result.outcome).toBe('party');
    expect(who(result.battle, 'Bran').row).toBe(0);
  });
});
