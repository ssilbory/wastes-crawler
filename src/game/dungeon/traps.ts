// Traps (docs/rules-adaptation.md, Dungeon exploration): stepping toward a trap, the party's best
// Wis/Notice may spot it and stop; a known trap can be disarmed in a turn (failing by 2 or more
// springs it), stepped into, or walked around. A sprung trap asks each PC for its save. A PC
// brought to 0 HP is Mortally Wounded, and the party tends them as after a won fight
// (trap-falls.ts; vendor/wwn-srd/2.0 The Rules of the Game/2.5.0 Injury, Healing, And System
// Strain.md, 2.5.1). Dungeon poison takes half the victim's maximum hit points
// (2.10.0 Falling and Other Hazards.md).
import type { Trap } from '../../data/schemas/index.ts';
import { roll } from '../../rules/dice.ts';
import { ahead, cellKey, type Cell } from '../../rules/grid.ts';
import { rollSave } from '../../rules/saves.ts';
import type { GameData } from '../character/context.ts';
import { activeEffects } from '../character/equipment.ts';
import { poisonProof } from '../world/ailing.ts';
import { infect, poisonMember } from '../world/ailments.ts';
import { pactOf } from '../world/pacts.ts';
import { alive, bestAt, memberCheck, memberSheet, note, setHp } from '../world/members.ts';
import type { TownResult } from '../world/services.ts';
import type { Member, World } from '../world/types.ts';
import { blind } from './light.ts';
import { callWanderers, passTurn } from './time.ts';
import { levelOf } from './levels.ts';

const state = (w: World) => w.dungeon as NonNullable<World['dungeon']>;
const able = (w: World) => alive(w).filter((m) => m.character.hp.current > 0);

/** The armed trap in a cell of the party's level, if any. */
function armedAt(w: World, data: GameData, c: Cell): Trap | undefined {
  const s = state(w);
  const trap = levelOf(data, s.dungeon, s.level).level.traps.find(
    (t) => t.at.x === c.x && t.at.y === c.y,
  );
  return trap && s.traps[s.level]?.[cellKey(c)] !== 'disarmed' ? trap : undefined;
}

const known = (w: World, c: Cell) => state(w).traps[state(w).level]?.[cellKey(c)] === 'noticed';

function mark(w: World, c: Cell, how: 'noticed' | 'disarmed'): void {
  const s = state(w);
  s.traps[s.level] = { ...s.traps[s.level], [cellKey(c)]: how };
}

/** The armed trap the party knows of in the cell straight ahead. */
export function knownTrapAhead(w: World, data: GameData): Trap | undefined {
  const s = w.dungeon;
  if (!s) return undefined;
  const c = ahead(s.at, s.facing);
  return known(w, c) ? armedAt(w, data, c) : undefined;
}

/**
 * Before stepping into a cell: a reason to stop, or null to go on. An unknown trap may be
 * spotted; a known one stops the party unless it means to step in.
 */
export function approach(w: World, data: GameData, target: Cell, stepIn: boolean): string | null {
  const trap = armedAt(w, data, target);
  if (!trap || stepIn) return null;
  if (known(w, target)) return `The ${trap.name} lies ahead.`;
  const eyes = bestAt(data, able(w), 'notice', ['wis']);
  if (blind(w, data) || !eyes) return null;
  if (!memberCheck(w, data, eyes, 'notice', ['wis'], trap.notice).success) return null;
  mark(w, target, 'noticed');
  const text = `${eyes.character.name} spots a ${trap.name} ahead.`;
  note(w, text);
  return text;
}

/**
 * A PC brought to zero lies Mortally Wounded, for the party to tend (trap-falls.ts), unless Die
 * Hard keeps them up at 1 HP, once a day (vendor/wwn-srd/1.0 Character Creation/1.6.0 Foci.md).
 */
function wound(w: World, data: GameData, m: Member, amount: number): void {
  const hp = m.character.hp.current - amount;
  note(w, `${m.character.name} takes ${amount} damage.`);
  const lastStand =
    m.lastStandDay !== w.day &&
    activeEffects(data, m.character.foci).some((e) => e.kind === 'last-stand');
  if (hp <= 0 && lastStand) {
    setHp(m, 1);
    m.lastStandDay = w.day;
    note(w, `${m.character.name} should be down, and stays on their feet.`);
    return;
  }
  setHp(m, Math.max(0, hp));
  if (hp <= 0) note(w, `${m.character.name} falls, mortally wounded.`);
}

function spring(w: World, data: GameData, trap: Trap): void {
  note(w, `The ${trap.name} springs!`);
  mark(w, trap.at, 'noticed');
  const e = trap.effect;
  if (e.kind === 'alarm') {
    callWanderers(w, data);
    return;
  }
  const victims = able(w);
  // Everyone saves before anyone tries to stabilize the fallen.
  const hit = victims.filter((m) => {
    // Pact of Stone and Sea wards off a trap of its element.
    if (trap.element && pactOf(w, m.id) === trap.element) {
      note(w, `The ${trap.name} can't harm ${m.character.name}.`);
      return false;
    }
    if (!trap.save) return true;
    const target = memberSheet(data, m).saves[trap.save];
    if (!rollSave(w.rng, target).success) return true;
    note(w, `${m.character.name} avoids it.`);
    return false;
  });
  for (const m of hit) {
    // Filth passes on its disease, doing no other harm (Sam's call).
    if (e.kind === 'disease') {
      infect(w, data, m, e.disease);
      continue;
    }
    // Unaging and the Poisoner: immune to poisons (Phase 15; 1.6.0).
    if (e.kind === 'poison' && poisonProof(m)) {
      note(w, `The poison does nothing to ${m.character.name}.`);
      continue;
    }
    // The poison lingers in those it doesn't kill (Sam's call).
    if (e.kind === 'poison') poisonMember(w, data, m);
    const amount =
      e.kind === 'damage' ? roll(w.rng, e.dice).total : Math.ceil(m.character.hp.max / 2);
    wound(w, data, m, amount);
  }
}

/** Springs the trap where the party now stands, if it is armed. */
export function springHere(w: World, data: GameData): void {
  const trap = armedAt(w, data, state(w).at);
  if (trap) spring(w, data, trap);
}

/** A turn spent on the known trap ahead: the best hand at its skill tries to disarm it. */
export function disarm(w: World, data: GameData): TownResult {
  if (!w.dungeon) throw new Error('the party is not in a dungeon');
  if (w.encounter) return { ok: false, reason: 'Settle the encounter first.' };
  const trap = knownTrapAhead(w, data);
  if (!trap) return { ok: false, reason: 'There is no known trap ahead.' };
  if (blind(w, data)) return { ok: false, reason: 'It is too dark to work.' };
  const { skill, attributes, difficulty } = trap.disarm;
  const hand = bestAt(data, able(w), skill, attributes) as Member;
  const check = memberCheck(w, data, hand, skill, attributes, difficulty);
  if (check.success) {
    mark(w, trap.at, 'disarmed');
    note(w, `${hand.character.name} disarms the ${trap.name}.`);
  } else if (difficulty - check.score >= 2) {
    note(w, `${hand.character.name} fumbles the ${trap.name}.`);
    spring(w, data, trap);
  } else note(w, `${hand.character.name} can't work out the ${trap.name}.`);
  passTurn(w, data);
  return { ok: true };
}
