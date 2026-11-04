import { describe, expect, it } from 'vitest';
import type { GameData } from '../../../src/game/character/context.ts';
import { startFactions } from '../../../src/game/factions/state.ts';
import type { WorldEvent } from '../../../src/game/world/bus.ts';
import { startProject } from '../../../src/game/world/crafting.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';
import {
  allyHosts,
  allyNews,
  waitForSiege,
  waitingWork,
} from '../../../src/game/world/siege-wait.ts';
import type { World } from '../../../src/game/world/types.ts';
import { data, encounter, member, siege, world } from './helpers.ts';
import { HILLS, heldTown, LANTERNFALL } from './siege-helpers.ts';

const CINDERHOLD = { col: 6, row: 12 };

/** The party in a Dark Lands settlement, the Free Settlements the only faction left. */
function guests(at = CINDERHOLD): World {
  const w = world();
  enterRegion(w, 'dark-lands', at);
  w.position = { ...at };
  startFactions(w, data);
  w.factions = { settlements: w.factions.settlements as World['factions'][string] };
  w.day = 1;
  w.purse = 1000;
  return w;
}

/** The game data with one more listener, run on each day passed at the day given. */
function on(day: number, act: (w: World) => void): GameData {
  const extra = (w: World, _d: GameData, e: WorldEvent) => {
    if (e.kind === 'day-passed' && w.day === day) act(w);
  };
  return { ...data, listeners: { ...data.listeners, all: [...data.listeners.all, extra] } };
}

const TOOLS = data.content.craftingRules.tools.id;

describe('waiting for a siege (docs/rules-adaptation.md, Sieges: Waiting for a siege)', () => {
  it('is offered in a settlement the Free Settlements hold, and nowhere else', () => {
    expect(allyHosts(guests(), data)).toBe(true);
    expect(allyHosts(guests(LANTERNFALL), data)).toBe(true);
    // Out on the hills, underground, held by a rival, with no party, or with the ally gone.
    expect(allyHosts(guests(HILLS), data)).toBe(false);
    const under = guests();
    under.dungeon = {} as World['dungeon'];
    expect(allyHosts(under, data)).toBe(false);
    expect(allyHosts(heldTown(), data)).toBe(false);
    const empty = guests();
    empty.members = [];
    expect(allyHosts(empty, data)).toBe(false);
    const gone = guests();
    gone.factions = {};
    expect(allyHosts(gone, data)).toBe(false);
    // A Borderlands town is no ally's.
    expect(allyHosts(world(), data)).toBe(false);
  });

  it('hears of sieges on the ally and its held settlements', () => {
    const w = guests();
    const quiet = allyNews(w, data);
    w.sieges = [siege({ town: 'gutterwick', attacker: 'bastion', defender: 'warhost' })];
    expect(allyNews(w, data)).toBe(quiet);
    w.sieges = [siege()];
    expect(allyNews(w, data)).not.toBe(quiet);
    expect(allyNews(heldTown(), data)).toContain('lanternfall');
  });

  it('refuses mid-fight, outside the ally’s settlements, and in a siege already begun', () => {
    const w = guests();
    w.encounter = encounter([['beastman-trooper']]);
    expect(waitForSiege(w, data)).toEqual({ ok: false, reason: 'Settle the encounter first.' });
    expect(waitForSiege(heldTown(LANTERNFALL), data)).toEqual({
      ok: false,
      reason: 'Only the Free Settlements put the party up while it waits.',
    });
    const besieged = guests();
    besieged.sieges = [siege()];
    expect(waitForSiege(besieged, data)).toEqual({
      ok: false,
      reason: 'Cinderhold is already under siege.',
    });
  });

  it('waits free, night after night, until a month turns with no siege', () => {
    const w = guests();
    expect(waitForSiege(w, data)).toEqual({ ok: true });
    expect(w.day).toBe(30);
    expect(w.purse).toBe(1000);
    const log = w.log.join('\n');
    expect(log).toContain(
      "The party waits in Cinderhold for a siege, the Free Settlements' guests.",
    );
    expect(log).toContain('The party stays the night at the inn in Cinderhold.');
    expect(w.log.at(-1)).toContain('A month turns with no siege on Cinderhold; the wait ends.');
  });

  it('ends when a siege begins here, or news of the ally comes from elsewhere', () => {
    const here = guests();
    expect(
      waitForSiege(
        here,
        on(5, (w) => w.sieges.push(siege())),
      ),
    ).toEqual({ ok: true });
    expect(here.day).toBe(6);
    expect(here.log.at(-1)).toContain('The siege of Cinderhold ends the wait.');
    const away = guests();
    waitForSiege(
      away,
      on(5, (w) => w.sieges.push(siege({ town: 'lanternfall' }))),
    );
    expect(away.log.at(-1)).toContain('News of the Free Settlements ends the wait.');
  });

  it('stops for a fight, or a party wiped out', () => {
    const fight = guests();
    waitForSiege(
      fight,
      on(3, (w) => (w.encounter = encounter([['beastman-trooper']]))),
    );
    expect(fight.day).toBe(4);
    const lost = guests();
    waitForSiege(
      lost,
      on(3, (w) => (w.members = [])),
    );
    expect(lost.members).toEqual([]);
    expect(lost.day).toBeLessThan(30);
  });

  it('works its crafters a workshop day each, rent free, in a town', () => {
    const w = guests();
    expect(startProject(w, data, 'm-3', 'crowbar', 'normal')).toEqual({ ok: true });
    const p = w.projects[0];
    // A long build, so a day's work leaves it unfinished.
    if (p) p.daysLeft = 5;
    const left = 5;
    waitingWork(w, data);
    expect(p?.daysLeft).toBe(left - 1);
    // One who stayed behind, whose work failed, or who is gone from the party, is not worked here.
    if (!p) throw new Error('no project');
    const failed = { ...p, crafter: 'm-2', failed: true as const };
    const gone = { ...p, crafter: 'm-9' };
    w.projects.push(failed, gone);
    p.staying = true;
    waitingWork(w, data);
    expect([p.daysLeft, failed.daysLeft, gone.daysLeft]).toEqual([left - 1, left - 1, left - 1]);
  });

  it('works only those carrying tools, a camp shift each, in a village', () => {
    const w = guests();
    startProject(w, data, 'm-3', 'crowbar', 'normal');
    const p = w.projects[0];
    // A long build, so a day's work leaves it unfinished.
    if (p) p.daysLeft = 5;
    const left = 5;
    w.position = { ...LANTERNFALL };
    waitingWork(w, data);
    expect(p?.daysLeft).toBe(left);
    const fizz = member(w, 'Fizzwick');
    fizz.character = {
      ...fizz.character,
      inventory: [...fizz.character.inventory, { id: TOOLS, quantity: 1, location: 'stowed' }],
    };
    // Stripping gear down needs the workshop itself.
    if (!p) throw new Error('no project');
    const strip = { ...p, crafter: 'm-2', kind: 'strip' as const };
    w.projects.push(strip);
    waitingWork(w, data);
    expect(p.daysLeft).toBe(left - data.content.craftingRules.shiftDays);
    expect(strip.daysLeft).toBe(left);
  });
});
