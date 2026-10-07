// High Magic that travels with the party (vendor/wwn-srd/4.0 Magic and Spellcasting/4.4.0 High
// Magic Spells by Level.md; Sam's calls, docs/rules-adaptation.md, High Magic outside fights).
// Adopt the Simulacular Visage gives the party the seeming of the bound's own until dawn, so bound
// garrisons and patrols let it pass without their order ending; it takes a target per caster level,
// so the caster's level must cover everyone in the party. The Jade Palanquin carries the party's
// stowed gear until dusk or dawn, so it weighs on no one.
import type { PendingEncounter } from '../../data/schemas/index.ts';
import { characterLevel } from '../../rules/progression.ts';
import type { GameData } from '../character/context.ts';
import { cannotCast, spendCast } from './casting.ts';
import { alive, note } from './members.ts';
import type { TownResult } from './services.ts';
import type { Member, World } from './types.ts';

export const VISAGE = 'adopt-the-simulacular-visage';
export const PALANQUIN = 'the-jade-palanquin-of-the-faceless-god';

const no = (reason: string): TownResult => ({ ok: false, reason });

function caster(w: World, data: GameData, memberId: string, spell: string): Member | string {
  const m = w.members.find((x) => x.id === memberId);
  return cannotCast(data, m, spell) ?? (m as Member);
}

/** Everyone travelling with the party: living members and NPCs. */
const everyone = (w: World) => [...alive(w).map((m) => m.id), ...w.npcs.map((n) => n.id)];

/** Adopt the Simulacular Visage: the whole party takes the seeming of the bound until dawn. */
export function adoptVisage(w: World, data: GameData, memberId: string): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const m = caster(w, data, memberId, VISAGE);
  if (typeof m === 'string') return no(m);
  const ids = everyone(w);
  const level = characterLevel(m.character.classes);
  if (ids.length > level)
    return no(`${m.character.name} can change no more than ${level} of the party.`);
  spendCast(data, m, VISAGE);
  w.disguise = { day: w.day, ids };
  note(w, `${m.character.name} gives the party the seeming of the bound.`);
  return { ok: true };
}

/** The seeming holds until dawn, and only while everyone in the party wears it. */
export function disguised(w: World): boolean {
  const d = w.disguise;
  return d !== null && d.day === w.day && everyone(w).every((id) => d.ids.includes(id));
}

/** A bound group meeting the disguised party takes it for its own and lets it pass. */
export function passInDisguise(w: World, e: PendingEncounter): void {
  if (!e.order || w.ordersEnded.includes(e.order) || !disguised(w)) return;
  e.hostile = false;
  e.spotted = true;
  note(w, 'Taking the party for their own, the bound let it pass.');
}

/** Quarters since the world began: morning, day, evening, and night make a day. */
const quarterNow = (w: World) => w.day * 4 + w.quarter;

/** The palanquin floats beside the party. */
export const palanquinUp = (w: World) => w.palanquin !== null && quarterNow(w) < w.palanquin;

/** The Jade Palanquin: until dusk, or until dawn if cast in the evening or night. */
export function raisePalanquin(w: World, data: GameData, memberId: string): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  if (w.dungeon) return no('The palanquin is no help below ground.');
  if (palanquinUp(w)) return no('The palanquin already floats beside the party.');
  const m = caster(w, data, memberId, PALANQUIN);
  if (typeof m === 'string') return no(m);
  spendCast(data, m, PALANQUIN);
  w.palanquin = w.quarter < 2 ? w.day * 4 + 2 : (w.day + 1) * 4;
  note(w, `${m.character.name} calls up a jade palanquin, and the party's packs ride on it.`);
  return { ok: true };
}
