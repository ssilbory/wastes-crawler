import { describe, expect, it } from 'vitest';
import type { Siege } from '../../../src/data/schemas/index.ts';
import { pickGoal } from '../../../src/game/factions/goals.ts';
import { beginSiege } from '../../../src/game/factions/siege.ts';
import { addAsset } from '../../../src/game/factions/state.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { chooseSide, undecided } from '../../../src/game/world/siege-sides.ts';
import { partySide } from '../../../src/game/world/siege-state.ts';
import { storm } from '../../../src/game/world/storm.ts';
import type { World } from '../../../src/game/world/types.ts';
import { sideChoices, siegeLines } from '../../../src/render/siege-view.ts';
import { data, encounter, member, siege } from './helpers.ts';
import { fightOf, HILLS, heldTown, LANTERNFALL, won } from './siege-helpers.ts';

/**
 * Lanternfall held by the warhost, its base sturdy so no one night ends the siege, and the
 * Dawnwall Bastion's warband come to besiege it, the party where it is asked to stand.
 */
function rivals(at = LANTERNFALL): { w: World; s: Siege } {
  const w = heldTown(at);
  const base = w.factions.warhost?.bases.find((b) => b.at === 'lanternfall');
  if (base) Object.assign(base, { hp: 20, max: 20 });
  const bastion = w.factions.bastion;
  if (!bastion) throw new Error('no bastion');
  addAsset(data, bastion, 'infantry', 'lanternfall');
  pickGoal(w, data, 'bastion', 0);
  const s = beginSiege(w, data, 'bastion', 'lanternfall', 'warhost');
  return { w, s };
}

const bastionBand = (w: World) => w.factions.bastion?.assets.find((a) => a.at === 'lanternfall');
const warband = (w: World) => w.factions.warhost?.assets.find((a) => a.uid === 'a1');

describe('a rivals’ siege of a held settlement (docs/rules-adaptation.md, Sieges; Phase 23d)', () => {
  it('puts the party against a siege on the ally, with the ally’s own, else as it picks', () => {
    expect(partySide(data, siege())).toBe('defender');
    expect(partySide(data, siege({ attacker: 'settlements', defender: 'warhost' }))).toBe(
      'attacker',
    );
    const rival = siege({ attacker: 'bastion', defender: 'warhost' });
    expect(partySide(data, rival)).toBeNull();
    rival.side = 'out';
    expect(partySide(data, rival)).toBe('out');
  });

  it('waits on the party inside to pick a side, the first assault a week off', () => {
    const { w, s } = rivals();
    expect(s).toMatchObject({ joined: false, next: w.day + 7 });
    expect(w.log.at(-1)).toContain(
      "The Dawnwall Bastion lays siege to Lanternfall, held by Grisk's Warhost. The party may take a side, or keep out of it.",
    );
    expect(undecided(w, data)).toEqual([s]);
    expect(sideChoices(w, data)).toEqual([
      { attacker: 'bastion', besiegers: 'The Dawnwall Bastion', holder: "Grisk's Warhost" },
    ]);
    // Away from the town there is no side to pick, and the news only spreads.
    const away = rivals(HILLS);
    expect(undecided(away.w, data)).toEqual([]);
    expect(away.w.log.at(-1)).toContain('Word spreads: The Dawnwall Bastion lays siege');
  });

  it('picks a side only in a rivals’ siege here, and not mid-fight', () => {
    const { w } = rivals();
    expect(chooseSide(w, data, 'warhost', 'out')).toEqual({
      ok: false,
      reason: 'There is no side to take here.',
    });
    w.encounter = encounter([['beastman-trooper']]);
    expect(chooseSide(w, data, 'bastion', 'out')).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
  });

  it('leaves a party keeping out alone: no share, no lines, never driven out', () => {
    const { w, s } = rivals();
    expect(chooseSide(w, data, 'bastion', 'out')).toEqual({ ok: true });
    expect(w.log.at(-1)).toContain('The party keeps out of the siege of Lanternfall.');
    expect(s).toMatchObject({ side: 'out', joined: false });
    expect(sideChoices(w, data)).toEqual([]);
    expect(siegeLines(w, data).at(-1)).toContain('The party keeps out of it.');
    s.next = w.day;
    emit(w, data, { kind: 'day-passed' });
    expect(w.encounter).toBeNull();
    expect(w.position).toEqual(LANTERNFALL);
    emit(w, data, { kind: 'town-entered', town: 'lanternfall' });
    expect(w.encounter).toBeNull();
  });

  it('fights the holder’s sturdiest asset on the besiegers’ side, a hit point a fighter', () => {
    const { w, s } = rivals();
    expect(chooseSide(w, data, 'bastion', 'attacker')).toEqual({ ok: true });
    expect(w.log.at(-1)).toContain(
      "The party takes The Dawnwall Bastion's side in the siege of Lanternfall. The assault comes tonight.",
    );
    expect(s).toMatchObject({ side: 'attacker', joined: true, next: w.day });
    expect(siegeLines(w, data).at(-1)).toContain('The party sides with The Dawnwall Bastion.');
    emit(w, data, { kind: 'day-passed' });
    expect(w.encounter?.siege).toEqual(fightOf(s, 'a1', 'breach'));
    expect(s.gate).toMatchObject({ uid: 'a1', size: 4 });
    emit(w, data, won(fightOf(s, 'a1', 'breach')));
    expect(warband(w)?.hp).toBe(2);
    // A share whose night has been cleared away costs nothing more.
    s.gate = null;
    emit(w, data, won(fightOf(s, 'a1', 'breach')));
    expect(warband(w)?.hp).toBe(2);
    // The lines let the party through, and storming joins the siege it sided with.
    w.encounter = null;
    emit(w, data, { kind: 'town-entered', town: 'lanternfall' });
    expect(w.encounter).toBeNull();
    s.next = w.day + 5;
    storm(w, data);
    expect(s.next).toBe(w.day);
  });

  it('faces the base’s guard once the holder has no asset there, and spends the base', () => {
    const { w, s } = rivals();
    const holder = w.factions.warhost;
    if (holder) holder.assets = holder.assets.filter((a) => a.at !== 'lanternfall');
    chooseSide(w, data, 'bastion', 'attacker');
    emit(w, data, { kind: 'day-passed' });
    expect(w.encounter?.siege).toEqual(fightOf(s, 'base', 'breach'));
    const base = () => holder?.bases.find((b) => b.at === 'lanternfall')?.hp ?? 0;
    const hp = base();
    const size = s.gate?.size ?? 0;
    emit(w, data, won(fightOf(s, 'base', 'breach')));
    expect(base()).toBe(hp - size);
    // A breach whose siege is over changes nothing.
    w.sieges = [];
    emit(w, data, won(fightOf(s, 'base', 'breach')));
    expect(base()).toBe(hp - size);
  });

  it('drives a party on the besiegers’ side out when the assault is thrown back', () => {
    const { w, s } = rivals();
    chooseSide(w, data, 'bastion', 'attacker');
    s.gate = { uid: 'a1', size: 4, lost: true };
    w.encounter = encounter([['beastman-trooper']]);
    emit(w, data, { kind: 'fight-over', won: true, siege: fightOf(s, 'a1', 'breach') });
    expect(w.position).not.toEqual(LANTERNFALL);
    expect(member(w, 'Snag').character.strain.value).toBe(3);
  });

  it('fights the besiegers on the holder’s side, its lines barring the way', () => {
    const { w, s } = rivals();
    chooseSide(w, data, 'bastion', 'defender');
    emit(w, data, { kind: 'day-passed' });
    const band = bastionBand(w);
    expect(w.encounter?.siege).toEqual(fightOf(s, band?.uid ?? '', 'assault'));
    // Storming the town is no part of a siege the party defends.
    w.encounter = null;
    s.next = w.day + 5;
    storm(w, data);
    expect(s.next).toBe(w.day + 5);
  });
});
