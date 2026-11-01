import { describe, expect, it } from 'vitest';
import { pcCombatant } from '../../../src/game/combat/combatants.ts';
import { finalScores } from '../../../src/game/character/derived.ts';
import { raisedMarks } from '../../../src/game/character/raised-marks.ts';
import { diseaseProof, poisonProof } from '../../../src/game/world/ailing.ts';
import { infect, nightForAilments } from '../../../src/game/world/ailments.ts';
import { immuneTo } from '../../../src/game/world/arts.ts';
import { acceptQuest, turnInQuest } from '../../../src/game/world/quest-board.ts';
import { memberSheet } from '../../../src/game/world/members.ts';
import {
  HALF_DEAD,
  RAISING_MARK,
  raiseMarked,
  raisePrice,
} from '../../../src/game/world/raised.ts';
import { enterTown } from '../../../src/game/world/town.ts';
import type { Member } from '../../../src/game/world/types.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, member, world } from './helpers.ts';

// docs/rules-adaptation.md, Raised by a necromancer or a priest in Phase 20.
const lastNote = (m: { log: string[] }) => (m.log.at(-1) ?? '').replace(/^Day \d+, \w+: /, '');

/** Snag, dead, with Con 14 (+1). */
function deadSnag(): { w: ReturnType<typeof world>; snag: Member } {
  const w = world();
  const snag = member(w, 'Snag');
  const c = snag.character;
  snag.character = {
    ...c,
    attributes: {
      ...c.attributes,
      base: { ...c.attributes.base, con: 14 },
      people: {},
      background: {},
      advancement: {},
    },
  };
  snag.dead = true;
  return { w, snag };
}

const halfDead = (m: Member, level: 1 | 2) => {
  m.character = { ...m.character, foci: [...m.character.foci, { id: HALF_DEAD, level }] };
};

describe('the price of raising', () => {
  it('is half at a crypt, rounded to the tenth', () => {
    expect(raisePrice(125, 1, 'crypt')).toBe(62.5);
    expect(raisePrice(125, 3, 'crypt')).toBe(187.5);
    expect(raisePrice(125, 3, 'mortuary')).toBe(375);
    expect(raisePrice(125, 3, 'temple')).toBe(375);
    expect(RAISING_MARK.crypt).toContain('Half-Dead');
    expect(RAISING_MARK.mortuary).toContain('Grave-touched');
  });
});

describe('a crypt raising', () => {
  it('brings the dead back Half-Dead, then at level 2, then no further', () => {
    const { snag } = deadSnag();
    expect(raiseMarked(data, snag, 'crypt')).toBe('Snag comes back Half-Dead.');
    expect(snag.dead).toBe(false);
    expect(snag.character.foci).toContainEqual({ id: HALF_DEAD, level: 1 });
    snag.dead = true;
    expect(raiseMarked(data, snag, 'crypt')).toBe('Snag comes back more dead than alive.');
    expect(snag.character.foci.filter((f) => f.id === HALF_DEAD)).toEqual([
      { id: HALF_DEAD, level: 2 },
    ]);
    snag.dead = true;
    expect(raiseMarked(data, snag, 'crypt')).toContain("as much the grave's as they can be");
    expect(snag.character.foci.filter((f) => f.id === HALF_DEAD)).toHaveLength(1);
  });
});

describe('a priest’s raising', () => {
  it('leaves the raised Grave-touched: −1 Con, and the hit points its modifier gave', () => {
    const { snag } = deadSnag();
    const level = memberSheet(data, snag).level;
    snag.character = { ...snag.character, hp: { max: 20, current: 0 } };
    expect(raiseMarked(data, snag, 'mortuary')).toBe('Snag comes back Grave-touched.');
    expect(finalScores(snag.character).con).toBe(13);
    expect(snag.character.attributes.raised).toEqual({ con: -1 });
    // 14 to 13 takes the modifier from +1 to +0: a hit point a level.
    expect(snag.character.hp).toEqual({ max: 20 - level, current: 1 });
    // 13 to 12 leaves the modifier as it was; the marks stack.
    snag.dead = true;
    raiseMarked(data, snag, 'temple');
    expect(snag.character.attributes.raised).toEqual({ con: -2 });
    expect(snag.character.hp.max).toBe(20 - level);
  });

  it('never takes Con below 3', () => {
    const { snag } = deadSnag();
    const c = snag.character;
    snag.character = {
      ...c,
      attributes: { ...c.attributes, base: { ...c.attributes.base, con: 3 } },
    };
    expect(raiseMarked(data, snag, 'mortuary')).toContain('already deep');
    expect(finalScores(snag.character).con).toBe(3);
  });

  it('comes with a priest’s raising quest too', () => {
    const w = world();
    const snag = member(w, 'Snag');
    snag.dead = true;
    w.position = { col: 20, row: 8 };
    enterTown(w, data, 'eastmarch');
    w.raising.offer = 'corpse-thieves';
    acceptQuest(w, data, 'corpse-thieves');
    w.quests['corpse-thieves'] = { status: 'ready', step: 1, acceptedDay: w.day };
    expect(turnInQuest(w, data, 'corpse-thieves', snag.id)).toEqual({ ok: true });
    expect(lastNote(w)).toBe('Snag comes back Grave-touched.');
  });
});

describe('the Half-Dead', () => {
  it('feel no hunger, sleeplessness, or cold', () => {
    const w = world();
    const snag = member(w, 'Snag');
    expect(immuneTo(data, snag, 'hungry')).toBe(false);
    halfDead(snag, 1);
    for (const c of ['hungry', 'sleepless', 'cold'] as const)
      expect(immuneTo(data, snag, c)).toBe(true);
    expect(raisedMarks(data, snag.character)).toEqual({
      privationProof: true,
      touchless: true,
      ailmentSave: 2,
      ailmentImmune: false,
    });
  });

  it('save at +2 against poison and disease, and at level 2 are immune to both', () => {
    const w = world();
    const snag = member(w, 'Snag');
    w.members = [snag];
    halfDead(snag, 1);
    snag.poisoned = true;
    // A roll 2 short of the save is made good by the +2.
    const target = memberSheet(data, snag).saves.physical;
    w.rng = scriptedRng([target - 2]);
    nightForAilments(w, data, true);
    expect(snag.poisoned).toBe(false);
    expect([poisonProof(data, snag), diseaseProof(data, snag)]).toEqual([false, false]);
    snag.character = {
      ...snag.character,
      foci: snag.character.foci.map((f) => (f.id === HALF_DEAD ? { ...f, level: 2 } : f)),
    };
    expect([poisonProof(data, snag), diseaseProof(data, snag)]).toEqual([true, true]);
    infect(w, data, snag, 'grave-rot');
    expect(snag.disease).toBeNull();
  });

  it('fight with their marks', () => {
    const w = world();
    const snag = member(w, 'Snag');
    halfDead(snag, 1);
    expect(pcCombatant(data, snag.character)).toMatchObject({
      touchless: true,
      ailmentSave: 2,
      poisonImmune: false,
      diseaseImmune: false,
    });
    halfDead(snag, 2);
    expect(pcCombatant(data, snag.character)).toMatchObject({
      poisonImmune: true,
      diseaseImmune: true,
    });
  });
});
