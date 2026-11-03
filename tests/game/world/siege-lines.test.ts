import { describe, expect, it } from 'vitest';
import type { Siege } from '../../../src/data/schemas/index.ts';
import { hike } from '../../../src/game/world/activities.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { applyBattle, encounterBattle } from '../../../src/game/world/fight.ts';
import { hexesToAvoid } from '../../../src/game/world/groves.ts';
import { campsHere } from '../../../src/game/world/siege-state.ts';
import { breakOut, nearbyHex, siegesListener } from '../../../src/game/world/sieges.ts';
import type { World } from '../../../src/game/world/types.ts';
import { data, encounter } from './helpers.ts';
import { asset, besieged, fightOf, HILLS, LANTERNFALL, won } from './siege-helpers.ts';

describe('the siege lines (docs/rules-adaptation.md, Sieges: Blockade, Breaking it from outside)', () => {
  it('bar the way into the town with a camp’s group, joining the siege', () => {
    const { w, s } = besieged();
    emit(w, data, { kind: 'town-entered', town: 'lanternfall' });
    expect(w.encounter?.siege).toEqual(fightOf(s, 'a1', 'enter'));
    expect(s).toMatchObject({ joined: true, next: w.day });
    // Turned back, the party stands outside again.
    emit(w, data, { kind: 'fight-over', won: false, siege: fightOf(s, 'a1', 'enter') });
    expect(w.position).not.toEqual(LANTERNFALL);
    expect(w.log.at(-1)).toContain('The party falls back from the gates of Lanternfall.');
  });

  it('let the party through once it has beaten a camp', () => {
    const { w, s } = besieged();
    s.pass = true;
    emit(w, data, { kind: 'town-entered', town: 'lanternfall' });
    expect(w.encounter).toBeNull();
    expect(s.pass).toBe(false);
    expect(w.log.at(-1)).toContain('slips through the siege lines into Lanternfall');
  });

  it('ignore towns not besieged, a party already fighting, and lines with no one left', () => {
    const { w, s } = besieged();
    emit(w, data, { kind: 'town-entered', town: 'mirewatch' });
    expect(w.encounter).toBeNull();
    w.encounter = encounter([['beastman-trooper']]);
    emit(w, data, { kind: 'town-entered', town: 'lanternfall' });
    expect(w.encounter.siege).toBeUndefined();
    w.encounter = null;
    const warhostState = w.factions.warhost;
    if (warhostState) warhostState.assets = [];
    emit(w, data, { kind: 'town-entered', town: 'lanternfall' });
    expect(w.sieges).not.toContain(s);
  });

  it('fight a camp the party steps onto; beating it breaks that asset and opens the way', () => {
    const { w, s } = besieged();
    const camp = s.camps[1] as Siege['camps'][number];
    w.position = { col: camp.col, row: camp.row };
    emit(w, data, { kind: 'hex-entered' });
    expect(w.encounter?.siege).toEqual(fightOf(s, 'a2', 'camp'));
    expect(w.log.at(-1)).toContain("The party falls on the camp of Grisk's Warhost's");
    expect(s.joined).toBe(true);
    emit(w, data, won(fightOf(s, 'a2', 'camp')));
    expect(asset(w, 'a2')).toBeUndefined();
    expect(s.pass).toBe(true);
    expect(s.camps.map((c) => c.uid)).toEqual(['a1', 'a3']);
  });

  it('leave other hexes, other maps, and dungeons alone', () => {
    const { w, s } = besieged(HILLS);
    emit(w, data, { kind: 'hex-entered' });
    expect(w.encounter).toBeNull();
    const camp = s.camps[0] as Siege['camps'][number];
    w.position = { col: camp.col, row: camp.row };
    w.dungeon = {} as World['dungeon'];
    siegesListener(w, data, { kind: 'hex-entered' });
    w.dungeon = null;
    w.region = 'borderlands';
    siegesListener(w, data, { kind: 'hex-entered' });
    w.region = 'dark-lands';
    // A camp whose asset has already gone is no fight.
    w.factions.warhost?.assets.splice(0, 1);
    siegesListener(w, data, { kind: 'hex-entered' });
    expect(w.encounter).toBeNull();
  });

  it('bar the way out unless the party holds a pass; breaking out leaves the town', () => {
    const { w, s } = besieged();
    expect(breakOut(w, data)).toBe(true);
    expect(w.encounter?.siege).toEqual(fightOf(s, 'a1', 'exit'));
    w.encounter = null;
    emit(w, data, won(fightOf(s, 'a1', 'exit')));
    expect(asset(w, 'a1')).toBeUndefined();
    expect(w.position).not.toEqual(LANTERNFALL);
    expect(w.log.at(-1)).toContain('The party breaks out of Lanternfall.');
    w.position = { ...LANTERNFALL };
    s.pass = true;
    expect(breakOut(w, data)).toBe(false);
    expect(s.pass).toBe(false);
    expect(w.log.at(-1)).toContain('slips out through the siege lines');
  });

  it('let the party leave a town not besieged, or one whose besiegers are gone', () => {
    const { w, s } = besieged(HILLS);
    expect(breakOut(w, data)).toBe(false);
    w.position = { ...LANTERNFALL };
    w.encounter = encounter([['beastman-trooper']]);
    expect(breakOut(w, data)).toBe(false);
    w.encounter = null;
    const warhostState = w.factions.warhost;
    if (warhostState) warhostState.assets = [];
    expect(breakOut(w, data)).toBe(false);
    expect(w.sieges).not.toContain(s);
  });

  it('stop a march out of a besieged town for the fight at the lines', () => {
    const { w } = besieged();
    w.destination = { ...HILLS };
    expect(hike(w, data, null, false)).toBe(0);
    expect(w.position).toEqual(LANTERNFALL);
    expect(w.encounter?.siege?.kind).toBe('exit');
  });

  it('break the beaten asset when the party wins its way in', () => {
    const { w, s } = besieged();
    emit(w, data, won(fightOf(s, 'a3', 'enter')));
    expect(asset(w, 'a3')).toBeUndefined();
    expect(s.pass).toBe(false);
    expect(w.position).toEqual(LANTERNFALL);
    // Wins over assets or sieges already gone change nothing.
    emit(w, data, won(fightOf(s, 'a3', 'camp')));
    w.sieges = [];
    emit(w, data, won(fightOf(s, 'a1', 'camp')));
    expect(asset(w, 'a1')).toBeDefined();
  });

  it('find a hex beside the town away from the camps, or the camps’, or stays put', () => {
    const { w, s } = besieged();
    expect(
      s.camps.some(
        (c) => c.col === nearbyHex(w, data, s).col && c.row === nearbyHex(w, data, s).row,
      ),
    ).toBe(false);
    const crowded = { ...s, camps: [0, 1, 2, 3, 4, 5].map(() => s.camps[0]) } as Siege;
    const all = [
      { col: 11, row: 3 },
      { col: 11, row: 4 },
      { col: 10, row: 5 },
      { col: 9, row: 4 },
      { col: 9, row: 3 },
      { col: 10, row: 3 },
    ];
    crowded.camps = all.map((h, i) => ({ uid: `x${i}`, ...h }));
    expect(nearbyHex(w, data, crowded)).toEqual(all[0]);
    expect(nearbyHex(w, data, { ...s, town: 'atlantis' })).toEqual(w.position);
  });
});

describe('a siege fight fought through (fight.ts)', () => {
  it('carries the siege from the encounter to the won fight', () => {
    const { w, s } = besieged();
    emit(w, data, { kind: 'town-entered', town: 'lanternfall' });
    const fight = encounterBattle(w, data);
    expect(fight.siege).toEqual(fightOf(s, 'a1', 'enter'));
    for (const c of fight.battle.combatants.filter((x) => x.side === 'enemy')) c.status = 'dead';
    fight.battle.outcome = 'party';
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'party', rounds: 1, deaths: 0, battle: fight.battle },
      null,
    );
    expect(asset(w, 'a1')).toBeUndefined();
    expect(w.position).toEqual(LANTERNFALL);
  });
});

describe('routes past the siege lines', () => {
  it('steer around the camps on the map, unless a camp is where the party heads', () => {
    const { w, s } = besieged(HILLS);
    const keys = s.camps.map((c) => `${c.col},${c.row}`);
    expect([...hexesToAvoid(w, data, HILLS)].filter((k) => keys.includes(k))).toEqual(keys);
    const [first] = s.camps;
    expect(hexesToAvoid(w, data, first ?? null).has(keys[0] as string)).toBe(false);
    w.region = 'borderlands';
    expect(campsHere(w, data)).toEqual([]);
  });
});
