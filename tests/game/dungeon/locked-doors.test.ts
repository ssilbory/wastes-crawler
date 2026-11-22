import { describe, expect, it } from 'vitest';
import type { DoorState, Dungeon } from '../../../src/data/schemas/index.ts';
import type { GameData } from '../../../src/game/character/context.ts';
import {
  disarmDoor,
  lockedAt,
  lockedDoorAhead,
  openDoor,
  reachDoor,
} from '../../../src/game/dungeon/doors.ts';
import type { Ruin } from '../../../src/data/schemas/index.ts';
import { dungeonOf, levelOf } from '../../../src/game/dungeon/levels.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';
import { lockDifficulty } from '../../../src/rules/locks.ts';
import { enterDungeon, step } from '../../../src/game/dungeon/explore.ts';
import { edgeKey } from '../../../src/game/dungeon/secrets.ts';
import { walkPath } from '../../../src/game/dungeon/walk.ts';
import type { World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { lockView } from '../../../src/render/lock-view.ts';
import { scriptedThen } from '../../helpers/scripted-rng.ts';
import { data, encounter, world } from '../world/helpers.ts';
import { place, state } from './helpers.ts';

// The barrow with the door north of 1,3 locked.
const barrow = data.content.dungeons.find((d) => d.id === 'old-barrow') as Dungeon;
const upper = barrow.levels[0] as Dungeon['levels'][number];
const map = upper.map.map((row, i) => (i === 6 ? `${row.slice(0, 3)}l${row.slice(4)}` : row));
const locked: GameData = {
  ...data,
  content: {
    ...data.content,
    dungeons: data.content.dungeons.map((d) =>
      d === barrow ? { ...d, levels: [{ ...upper, map }, ...d.levels.slice(1)] } : d,
    ),
  },
};
const KEY = edgeKey({ x: 1, y: 3 }, 'n');

/** The party below the locked door, facing it. */
function atDoor(door?: Partial<DoorState>): World {
  const w = world();
  w.position = { ...barrow.entrance };
  enterDungeon(w, locked);
  place(w, upper.id, 1, 3, 'n');
  if (door)
    state(w).doors = {
      [upper.id]: {
        [KEY]: {
          difficulty: 8,
          trap: null,
          trapState: 'hidden',
          looked: true,
          heavy: false,
          opened: false,
          ...door,
        },
      },
    };
  return w;
}

const quiet = (w: World) => {
  // No wandering checks come up in these turns.
  state(w).turn = 1;
};

describe('locked doors (docs/rules-adaptation.md, Locks and chests)', () => {
  it('stop the party, which reaches the door and looks it over', () => {
    const w = atDoor();
    expect(lockedAt(w, locked, { x: 1, y: 3 }, 'n')).toBe(true);
    expect(lockedDoorAhead(w, locked)).toEqual({ known: null });
    expect(step(w, locked, 'forward')).toEqual({ ok: false, reason: 'The door is locked.' });
    expect(state(w).at).toEqual({ x: 1, y: 3 });
    const door = lockedDoorAhead(w, locked)?.known;
    expect(door).toMatchObject({ difficulty: 8, looked: true, opened: false, heavy: false });
    // Elsewhere, and above ground, nothing is locked.
    expect(lockedAt(w, locked, { x: 1, y: 3 }, 's')).toBe(false);
    expect(lockedAt(w, data, { x: 1, y: 3 }, 'n')).toBe(false);
  });

  it('set a trap on one in six', () => {
    const trapped = atDoor();
    trapped.rng = scriptedThen([1, 0], createRng('door'));
    step(trapped, locked, 'forward');
    expect(lockedDoorAhead(trapped, locked)?.known?.trap?.name).toBe(
      locked.content.chests.traps[0]?.name,
    );
    const plain = atDoor();
    plain.rng = scriptedThen([2], createRng('door'));
    step(plain, locked, 'forward');
    expect(lockedDoorAhead(plain, locked)?.known?.trap).toBeNull();
  });

  it('open when picked, for the rest of the visit, letting the party and its walks through', () => {
    const w = atDoor({});
    state(w).seen[upper.id] = [...(state(w).seen[upper.id] ?? []), '1,2', '1,3'];
    expect(walkPath(w, locked, { x: 1, y: 2 })).toBeNull();
    quiet(w);
    w.rng = scriptedThen([6, 6], createRng('pick'));
    expect(openDoor(w, locked, 'pick')).toEqual({ ok: true });
    expect(w.log.join('\n')).toContain("picks the door's lock");
    expect(lockedDoorAhead(w, locked)).toBeNull();
    expect(walkPath(w, locked, { x: 1, y: 2 })).toEqual([{ x: 1, y: 2 }]);
    expect(step(w, locked, 'forward')).toEqual({ ok: true });
  });

  it('bring the wanderers on 2 in 6 when broken down, opened or not', () => {
    const w = atDoor({});
    quiet(w);
    w.rng = scriptedThen([1, 1, 2], createRng('noise'));
    openDoor(w, locked, 'force');
    expect(w.log.join('\n')).toContain("can't break the door open");
    expect(w.log.join('\n')).toContain('The noise carries');
    expect(w.encounter).not.toBeNull();
    const calm = atDoor({});
    quiet(calm);
    calm.rng = scriptedThen([6, 6, 3], createRng('calm'));
    openDoor(calm, locked, 'force');
    expect(calm.log.join('\n')).toContain('breaks the door open');
    expect(calm.encounter).toBeNull();
    expect(lockedDoorAhead(calm, locked)).toBeNull();
  });

  it('disarm a spotted trap on a door, and refuse with none or none ahead', () => {
    const trap = locked.content.chests.traps[0] as NonNullable<DoorState['trap']>;
    const w = atDoor({ trap, trapState: 'noticed' });
    quiet(w);
    w.rng = scriptedThen([6, 6], createRng('disarm'));
    expect(disarmDoor(w, locked)).toEqual({ ok: true });
    expect(lockedDoorAhead(w, locked)?.known?.trapState).toBe('disarmed');
    expect(disarmDoor(w, locked)).toEqual({ ok: false, reason: 'No trap has been found on it.' });
    state(w).facing = 's';
    expect(openDoor(w, locked, 'pick')).toEqual({
      ok: false,
      reason: 'There is no locked door ahead.',
    });
  });

  it('lock again on the next visit', () => {
    const w = atDoor({ opened: true });
    expect(lockedDoorAhead(w, locked)).toBeNull();
    w.dungeon = null;
    w.position = { ...barrow.entrance };
    enterDungeon(w, locked);
    place(w, upper.id, 1, 3, 'n');
    expect(lockedDoorAhead(w, locked)).toEqual({ known: null });
  });

  it('show as a door to break down in the popup', () => {
    const w = atDoor();
    expect(lockView(w, locked)).toMatchObject({
      kind: 'door',
      at: `${barrow.id}/${upper.id}/1,3,n`,
      trap: 'No one has looked it over yet.',
      disarm: null,
      forceLabel: 'Break it down',
      noise: 'Loud: it may bring the wanderers.',
    });
    state(w).facing = 's';
    expect(lockView(w, locked)).toBeNull();
  });

  it('still show the popup once an untrapped door is reached and looked over', () => {
    const w = atDoor();
    w.rng = scriptedThen([2], createRng('plain'));
    step(w, locked, 'forward');
    expect(lockedDoorAhead(w, locked)?.known).toMatchObject({ trap: null, looked: true });
    expect(lockView(w, locked)).toMatchObject({
      kind: 'door',
      trap: 'No trap has been spotted on it.',
      disarm: null,
    });
  });

  it('refuse work above ground, under attack, and say a side door is locked without reaching it', () => {
    const top = world();
    expect(lockedAt(top, locked, { x: 1, y: 3 }, 'n')).toBe(false);
    expect(lockedDoorAhead(top, locked)).toBeNull();
    expect(() => openDoor(top, locked, 'pick')).toThrow('the party is not in a dungeon');
    const w = atDoor({
      trap: locked.content.chests.traps[0] as DoorState['trap'],
      trapState: 'noticed',
    });
    w.encounter = encounter([['thug-or-militia']]);
    expect(openDoor(w, locked, 'force')).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
    expect(disarmDoor(w, locked)).toEqual({ ok: false, reason: 'Settle the encounter first.' });
    w.encounter = null;
    // Facing east, a step to the left runs into the locked door, which is not yet reached.
    const side = atDoor();
    state(side).facing = 'e';
    expect(step(side, locked, 'left')).toEqual({ ok: false, reason: 'The door is locked.' });
    expect(state(side).doors).toBeUndefined();
  });

  it('take a shipped ruin’s difficulty', () => {
    const ruin = data.content.ruins.find((r) => r.level >= 4 && r.kind === 'delve') as Ruin;
    const w = world();
    enterRegion(w, ruin.region, ruin);
    enterDungeon(w, data);
    const s = state(w);
    const d = dungeonOf(data, s.dungeon);
    let found = false;
    for (const level of d.levels) {
      const { map } = levelOf(data, d.id, level.id);
      for (let y = 0; y < map.height && !found; y++)
        for (let x = 0; x < map.width && !found; x++)
          for (const f of ['n', 'e', 's', 'w'] as const)
            if (!found && map.locked({ x, y }, f)) {
              place(w, level.id, x, y, f);
              found = true;
            }
      if (found) break;
    }
    expect(found).toBe(true);
    expect(reachDoor(w, data)?.difficulty).toBe(
      lockDifficulty(data.content.chests.difficulty, ruin.level),
    );
  });

  it('offer a spotted door trap’s disarm in the popup, and no warning for quiet doors', () => {
    const trap = locked.content.chests.traps[0] as NonNullable<DoorState['trap']>;
    const w = atDoor({ trap, trapState: 'noticed' });
    expect(lockView(w, locked)?.disarm).not.toBeNull();
    const quiet: GameData = {
      ...locked,
      content: {
        ...locked.content,
        chests: { ...locked.content.chests, doors: { ...locked.content.chests.doors, noise: 0 } },
      },
    };
    expect(lockView(w, quiet)?.noise).toBeNull();
  });

  it('refuse work in the dark', () => {
    const w = atDoor({});
    w.light.lit = null;
    w.light.torch = 0;
    w.light.lantern = 0;
    expect(openDoor(w, locked, 'pick')).toEqual({ ok: false, reason: 'It is too dark to work.' });
  });
});
