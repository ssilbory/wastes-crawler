// The marks a raising leaves (docs/rules-adaptation.md, Raised by a necromancer or a priest in
// Phase 20; Sam's calls). A necromancer's crypt brings the dead back Half-Dead, a focus that grows
// to level 2 with a second crypt raising, at half the price; a death priest's mortuary or a Blood
// Priest temple raises them whole but Grave-touched, −1 Con each time, never below 3. Hit points
// follow the Con modifier as for a change of form (vendor/wwn-srd/1.0 Character Creation/1.5.0
// Class List/1.5.15 The Skinshifter.md, Feral Prowess; src/rules/forms.ts).
import type { RaiserKind } from '../../data/schemas/index.ts';
import { toTenths } from '../../rules/economy.ts';
import { shiftedHp } from '../../rules/forms.ts';
import type { GameData } from '../character/context.ts';
import { finalScores } from '../character/derived.ts';
import { revive } from './healer.ts';
import { memberSheet } from './members.ts';
import type { Member } from './types.ts';

export const HALF_DEAD = 'half-dead';

/** Con never falls below the lowest score an attribute can have. */
const CON_FLOOR = 3;

/** A crypt raises for half the price. */
export const raisePrice = (perLevel: number, level: number, kind: RaiserKind): number =>
  toTenths((perLevel * level) / (kind === 'crypt' ? 2 : 1));

/** What each place's raising leaves, for the town's service panel. */
export const RAISING_MARK: Record<RaiserKind, string> = {
  crypt: 'The necromancer brings the dead back only partly: they return Half-Dead.',
  mortuary: 'The dead come back whole, but Grave-touched: −1 Con for good.',
  temple: 'The dead come back whole, but Grave-touched: −1 Con for good.',
};

/** Half-Dead, or a level more of it, up to level 2. */
function halfDead(m: Member): string {
  const c = m.character;
  const held = c.foci.find((f) => f.id === HALF_DEAD);
  if (held && held.level >= 2) return `${c.name} is as much the grave's as they can be.`;
  const foci = held
    ? c.foci.map((f) => (f === held ? { ...f, level: 2 } : f))
    : [...c.foci, { id: HALF_DEAD, level: 1 }];
  m.character = { ...c, foci };
  return held ? `${c.name} comes back more dead than alive.` : `${c.name} comes back Half-Dead.`;
}

/** −1 Con, never below 3; hit points follow the change in the Con modifier. */
function graveTouch(data: GameData, m: Member): string {
  const c = m.character;
  if (finalScores(c).con <= CON_FLOOR)
    return `${c.name} comes back, the grave's chill already deep.`;
  const before = memberSheet(data, m);
  const raised = c.attributes.raised ?? {};
  m.character = {
    ...c,
    attributes: { ...c.attributes, raised: { ...raised, con: (raised.con ?? 0) - 1 } },
  };
  const after = memberSheet(data, m);
  const hp = shiftedHp(c.hp, after.level, after.modifiers.con - before.modifiers.con);
  m.character = { ...m.character, hp };
  return `${c.name} comes back Grave-touched.`;
}

/** Raises a dead member as the place raising them does, returning the line for the journal. */
export function raiseMarked(data: GameData, m: Member, kind: RaiserKind): string {
  revive(m);
  return kind === 'crypt' ? halfDead(m) : graveTouch(data, m);
}
