import { describe, expect, it } from 'vitest';
import { act } from '../../../src/game/combat/actions.ts';
import { createBattle, type NpcSetup } from '../../../src/game/combat/battle.ts';
import { answersCall, arrive, bind, howl, provoke } from '../../../src/game/combat/companions.ts';
import type { Battle, CasterState } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { beastmaster } from '../beastmaster.ts';
import { data, who } from './helpers.ts';

/** A raider hireling at the given slot, with `hp` hit points. */
const hand = (row: number, column: number, hp = 8): NpcSetup => ({
  monster: 'human-raider',
  name: `Hand ${row}-${column}`,
  row,
  column,
  hp,
  maxHp: 8,
  noncombatant: false,
});

/** Every slot but Snag's front-left one, filled through the given row count. */
const hands = (rows: number, weakest: number | null = null): NpcSetup[] =>
  Array.from({ length: rows * 4 }, (_, i) => hand(Math.floor(i / 4), i % 4))
    .slice(1)
    .map((h) => (h.column === weakest && h.row === 0 ? { ...h, hp: 1 } : h));

const WAITING = {
  monster: 'herd-beast',
  name: 'Bramble',
  hp: 6,
  maxHp: 9,
  hitDice: 2,
  chosen: false,
  shared: false,
};

/** Snag as a Ranger with the given arts and hirelings, able to bind, against `enemies`. */
function battle(arts: string[], npcs: NpcSetup[], enemies: string[][], waiting = false): Battle {
  return createBattle({
    data,
    rng: createRng('herd'),
    party: [
      {
        character: beastmaster(arts, 3),
        row: 0,
        column: 0,
        canBind: true,
        waiting: waiting ? WAITING : null,
      },
    ],
    npcs,
    enemies,
    log: true,
  });
}

const pc = (b: Battle) => who(b, 'pc-0');
const caster = (b: Battle) => pc(b).caster as CasterState;

/** The herd beast among the foes, sure to fail its Mental save. */
function weakBeast(b: Battle) {
  const beast = who(b, 'foe-0-0');
  beast.saves.mental = 99;
  return beast;
}

describe('a bound beast finding room in the line (1.5.4)', () => {
  it('steps the weakest of a full front row back to make room', () => {
    const b = battle([], hands(1, 2), [['herd-beast']]);
    const beast = weakBeast(b);
    bind(b, pc(b), beast.id);
    expect(beast).toMatchObject({ side: 'party', row: 0, column: 2, group: 0 });
    expect(who(b, 'Hand 0-2')).toMatchObject({ row: 1, column: 2 });
    expect(b.log?.some((l) => l.includes('Hand 0-2 steps back for Herd Beast.'))).toBe(true);
  });

  it('stays a foe when every slot is taken, and the Beastmaster may try another', () => {
    const b = battle([], hands(2), [['herd-beast']]);
    const beast = weakBeast(b);
    bind(b, pc(b), beast.id);
    expect(beast.side).toBe('enemy');
    expect(beast.companion).toBeFalsy();
    expect(pc(b).canBind).toBe(true);
    expect(b.log?.some((l) => l.includes('There is no room for Herd Beast beside'))).toBe(true);
  });

  it('stays a foe when the party fights in rows rather than a formation', () => {
    const b = battle([], [], [['herd-beast']]);
    b.layout.party = 'rows';
    const beast = weakBeast(b);
    bind(b, pc(b), beast.id);
    expect(beast.side).toBe('enemy');
    expect(pc(b).canBind).toBe(true);
  });

  it('ignores a target that isn’t a bindable beast', () => {
    const b = battle([], [], [['herd-beast', 'human-raider']]);
    const raider = who(b, 'foe-0-1');
    const before = b.log?.length;
    bind(b, pc(b), raider.id);
    expect(raider.side).toBe('enemy');
    expect(caster(b).usedThisScene.has(`bind:${raider.id}`)).toBe(false);
    expect(b.log?.length).toBe(before);
  });
});

describe('a howled companion finding room in the line (1.5.4)', () => {
  it('arrives but stays out of the fight when every slot is taken', () => {
    const b = battle(['howl-of-distant-summons'], hands(2), [['human-raider']], true);
    act(b, pc(b), { kind: 'howl' });
    const bramble = who(b, 'Bramble');
    arrive(b, bramble);
    expect(bramble).toMatchObject({ status: 'out', returnsRound: 0 });
    expect(b.log?.some((l) => l.includes('Bramble arrives, but finds no room'))).toBe(true);
  });

  it('can’t be howled for without the art', () => {
    const b = battle([], [], [['human-raider']], true);
    howl(b, pc(b));
    expect(pc(b).waiting).toMatchObject({ name: 'Bramble' });
    expect(b.combatants.some((c) => c.name === 'Bramble')).toBe(false);
    expect(caster(b).effortDay).toBe(0);
  });
});

describe('Mind Call needs a master who can act (1.5.4)', () => {
  it('doesn’t answer for a master who is down, or for one who isn’t a companion', () => {
    const b = createBattle({
      data,
      rng: createRng('herd'),
      party: [{ character: beastmaster(['mind-call'], 3), row: 0, column: 0 }],
      npcs: [
        {
          ...hand(0, 1),
          monster: 'herd-beast',
          name: 'Bramble',
          servant: true,
          companion: { master: 0, chosen: true, shared: false, hitDice: 2 },
        },
      ],
      enemies: [['human-raider']],
    });
    const bramble = who(b, 'Bramble');
    expect(answersCall(b, bramble)).toBe(true);
    expect(answersCall(b, pc(b))).toBe(false);
    pc(b).status = 'stable';
    expect(answersCall(b, bramble)).toBe(false);
  });
});

describe('provoking a beast (1.5.4, Beast Ward)', () => {
  it('provokes only a beast on the other side', () => {
    const b = battle([], [], [['herd-beast', 'human-raider']]);
    const beast = who(b, 'foe-0-0');
    const raider = who(b, 'foe-0-1');
    provoke(raider, beast);
    expect(beast.provoked).toBe(false);
    provoke(pc(b), raider);
    expect(raider.provoked).toBe(false);
    provoke(pc(b), beast);
    expect(beast.provoked).toBe(true);
  });
});
