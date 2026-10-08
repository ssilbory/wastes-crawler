import { describe, expect, it } from 'vitest';
import { act } from '../../../src/game/combat/actions.ts';
import { createBattle } from '../../../src/game/combat/battle.ts';
import { commandsFor } from '../../../src/game/combat/commands.ts';
import {
  answersCall,
  bindTargets,
  heedCall,
  knowsWeakSpot,
} from '../../../src/game/combat/companions.ts';
import { roundPasses } from '../../../src/game/combat/conditions.ts';
import { harm } from '../../../src/game/combat/damage.ts';
import { canUse, combatMagic } from '../../../src/game/combat/spells.ts';
import { targets } from '../../../src/game/combat/targeting.ts';
import type { Battle, CasterState, Combatant } from '../../../src/game/combat/types.ts';
import type { Character } from '../../../src/data/schemas/index.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { beastmaster } from '../beastmaster.ts';
import { data, who } from './helpers.ts';

const BRAMBLE = {
  monster: 'herd-beast',
  name: 'Bramble',
  row: 0,
  column: 1,
  hp: 9,
  maxHp: 9,
  noncombatant: false,
  servant: true,
};

/** Snag as a Ranger with the given arts, Bramble beside them if `companion`, against `enemies`. */
function battle(
  arts: string[],
  enemies: string[][],
  companion: { chosen?: boolean; shared?: boolean; hitDice?: number } | null = {},
  extra: Partial<{ canBind: boolean; character: Character }> = {},
): Battle {
  return createBattle({
    data,
    rng: createRng('companions'),
    party: [
      {
        character: extra.character ?? beastmaster(arts, 3),
        row: 0,
        column: 0,
        canBind: extra.canBind ?? companion === null,
      },
    ],
    npcs: companion
      ? [
          {
            ...BRAMBLE,
            companion: {
              master: 0,
              chosen: companion.chosen ?? false,
              shared: companion.shared ?? false,
              hitDice: companion.hitDice ?? 2,
            },
          },
        ]
      : [],
    enemies,
  });
}

const pc = (b: Battle) => who(b, 'pc-0');
const caster = (b: Battle) => pc(b).caster as CasterState;

describe('a companion in a fight (1.5.4)', () => {
  it('fights for its master, with Shared Vitality’s hit dice and hit bonus floor', () => {
    const plain = who(battle([], [['human-raider']]), 'Bramble');
    expect(plain.companion).toEqual({ master: 'pc-0', chosen: false, shared: false });
    expect(plain.hitDice).toBe(2);
    const lifted = who(battle([], [['human-raider']], { shared: true, hitDice: 7 }), 'Bramble');
    expect(lifted.hitDice).toBe(7);
    // Half of 7, rounded up, over the herd beast's +2.
    expect(lifted.attacks[0]?.hit).toBe(4);
  });

  it('is stabilized at zero by Shared Vitality for Effort, while the master can act', () => {
    const b = battle([], [['human-raider']], { shared: true, hitDice: 3 });
    const bramble = who(b, 'Bramble');
    harm(b, bramble, 99);
    expect(bramble.status).toBe('stable');
    expect(caster(b).effortUsed).toBe(1);
    const spent = battle([], [['human-raider']], { shared: true, hitDice: 3 });
    caster(spent).effortUsed = caster(spent).effortMax;
    harm(spent, who(spent, 'Bramble'), 99);
    expect(who(spent, 'Bramble').status).toBe('dead');
    const plain = battle([], [['human-raider']]);
    harm(plain, who(plain, 'Bramble'), 99);
    expect(who(plain, 'Bramble').status).toBe('dead');
  });
});

describe('Bind Companion in a fight (1.5.4)', () => {
  it('offers beasts of no more than the level plus one hit dice', () => {
    const b = battle([], [['herd-beast', 'cave-bear', 'human-raider']], null);
    expect(bindTargets(b, pc(b)).map((t) => t.name)).toEqual(['Herd Beast']);
    expect(commandsFor(b, pc(b)).some((c) => c.key === 'bind')).toBe(true);
    const bound = battle([], [['herd-beast']], {});
    expect(bindTargets(bound, pc(bound))).toEqual([]);
  });

  it('turns a beast that fails its Mental save to the party’s side', () => {
    const b = battle([], [['herd-beast', 'human-raider']], null);
    const beast = who(b, 'foe-0-0');
    beast.saves.mental = 99;
    act(b, pc(b), { kind: 'bind', target: beast.id });
    expect(beast).toMatchObject({
      side: 'party',
      bound: { by: 'pc-0' },
      companion: { master: 'pc-0' },
      row: 0,
    });
    expect(pc(b).canBind).toBe(false);
    expect(bindTargets(b, pc(b))).toEqual([]);
  });

  it('can’t try again on a beast that resisted', () => {
    const b = battle([], [['herd-beast']], null);
    const beast = who(b, 'foe-0-0');
    beast.saves.mental = 1;
    act(b, pc(b), { kind: 'bind', target: beast.id });
    expect(beast.side).toBe('enemy');
    expect(bindTargets(b, pc(b))).toEqual([]);
  });
});

describe('Howl of Distant Summons (1.5.4)', () => {
  it('brings a waiting companion in at the next round’s start, for Effort for the day', () => {
    const b = createBattle({
      data,
      rng: createRng('howl'),
      party: [
        {
          character: beastmaster(['howl-of-distant-summons'], 3),
          waiting: {
            monster: 'herd-beast',
            name: 'Bramble',
            hp: 6,
            maxHp: 9,
            hitDice: 2,
            chosen: false,
            shared: false,
          },
        },
      ],
      enemies: [['human-raider']],
    });
    expect(commandsFor(b, pc(b)).some((c) => c.key === 'howl')).toBe(true);
    act(b, pc(b), { kind: 'howl' });
    expect(caster(b).effortDay).toBe(1);
    const bramble = who(b, 'Bramble');
    expect(bramble.status).toBe('out');
    expect(commandsFor(b, pc(b)).some((c) => c.key === 'howl')).toBe(false);
    b.round += 1;
    roundPasses(b);
    expect(bramble).toMatchObject({ status: 'active', side: 'party', hp: 6, row: 0 });
  });
});

describe('Mind Call (1.5.4)', () => {
  it('lets the master command the companion, committing Effort for the scene once', () => {
    const b = battle(['mind-call'], [['human-raider']]);
    const bramble = who(b, 'Bramble');
    expect(answersCall(b, bramble)).toBe(true);
    heedCall(b, bramble);
    heedCall(b, bramble);
    expect(caster(b).effortUsed).toBe(1);
    // Effort committed already keeps the call open.
    expect(answersCall(b, bramble)).toBe(true);
    expect(
      answersCall(battle([], [['human-raider']]), who(battle([], [['human-raider']]), 'Bramble')),
    ).toBe(false);
  });

  it('needs no art or Effort for a Chosen Friend', () => {
    const b = battle([], [['human-raider']], { chosen: true, shared: true });
    const friend = who(b, 'Bramble');
    expect(answersCall(b, friend)).toBe(true);
    heedCall(b, friend);
    expect(caster(b).effortUsed).toBe(0);
  });
});

describe('Know the Weak Spot and Beast Ward (1.5.4)', () => {
  it('knows a beast’s weak spot, and no one else’s', () => {
    const b = battle(['know-the-weak-spot'], [['herd-beast', 'human-raider']], null);
    expect(knowsWeakSpot(pc(b), who(b, 'foe-0-0'))).toBe(true);
    expect(knowsWeakSpot(pc(b), who(b, 'foe-0-1'))).toBe(false);
  });

  it('keeps unprovoked beasts off the warded until a hostile act', () => {
    const b = battle(['beast-ward'], [['herd-beast', 'human-raider']], null);
    const beast = who(b, 'foe-0-0');
    const raider = who(b, 'foe-0-1');
    const ward = combatMagic(b, 'beast-ward');
    expect(ward && canUse(b, pc(b), ward, false, pc(b).id)).toBe(true);
    act(b, pc(b), { kind: 'cast', magic: 'beast-ward', target: pc(b).id });
    expect(pc(b).beastWard).toBe(true);
    const hits = (c: Combatant) => targets(b, c, c.attacks[0] as Combatant['attacks'][number]);
    expect(hits(beast)).toEqual([]);
    expect(hits(raider)).toContain(pc(b));
    beast.provoked = true;
    expect(hits(beast)).toContain(pc(b));
  });
});

describe('Swift Healing in a fight (1.5.4)', () => {
  it('heals only the Beastmaster’s own companion, once a scene', () => {
    const b = battle(['swift-healing'], [['human-raider']]);
    const heal = combatMagic(b, 'swift-healing');
    if (!heal) throw new Error('no Swift Healing');
    const bramble = who(b, 'Bramble');
    bramble.hp = 1;
    expect(canUse(b, pc(b), heal, false, pc(b).id)).toBe(false);
    expect(canUse(b, pc(b), heal, false, bramble.id)).toBe(true);
    act(b, pc(b), { kind: 'cast', magic: 'swift-healing', target: bramble.id });
    expect(bramble.hp).toBeGreaterThan(1);
    bramble.hp = 1;
    expect(canUse(b, pc(b), heal, false, bramble.id)).toBe(false);
  });
});
