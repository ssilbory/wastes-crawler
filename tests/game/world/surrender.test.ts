import { describe, expect, it } from 'vitest';
import { applyBattle, partyBattle } from '../../../src/game/world/fight.ts';
import { addNpc } from '../../../src/game/world/npcs.ts';
import { WORLD_MIGRATIONS } from '../../../src/game/world/save-migrations.ts';
import {
  killSurrendered,
  questionSurrendered,
  recruitable,
  recruitSurrendered,
  releaseSurrendered,
  surrenderedHere,
  surrenderQuestions,
  takeSurrender,
} from '../../../src/game/world/surrender.ts';
import type { World } from '../../../src/game/world/types.ts';
import { below, place, state } from '../dungeon/helpers.ts';
import { data, member, world } from './helpers.ts';

// docs/rules-adaptation.md, Morale, escape, and surrender in Phase 19: after a surrender.
const fail = (reason: string) => ({ ok: false, reason });
const lastNote = (w: World) => (w.log.at(-1) ?? '').replace(/^Day \d+, \w+: /, '');

/** Wins a fight against `enemies` in which the foes at `yielded` surrender and `ran` escape. */
function win(w: World, enemies: string[][], yielded: number[], ran: number[] = []): void {
  const fight = partyBattle(w, data, enemies, false, null);
  const foes = fight.battle.combatants.filter((c) => c.side === 'enemy');
  foes.forEach((c, i) => {
    if (yielded.includes(i)) Object.assign(c, { status: 'fled', surrendered: true });
    else if (ran.includes(i)) c.status = 'fled';
    else c.status = 'dead';
  });
  fight.battle.outcome = 'party';
  applyBattle(
    w,
    data,
    fight,
    { outcome: 'party', rounds: 2, deaths: 0, battle: fight.battle },
    null,
  );
}

describe('after a won fight', () => {
  it('keeps the surrendered where the fight was, and no corpse for them or the escaped', () => {
    const w = world();
    win(w, [['thug-or-militia', 'thug-or-militia', 'veteran-soldier', 'gnoll']], [1], [3]);
    expect(w.surrendered).toEqual({
      at: expect.any(String),
      monsters: ['thug-or-militia'],
      questioned: false,
      recruited: false,
    });
    expect(surrenderedHere(w)).toEqual(['thug-or-militia']);
    // The slain thug and the veteran lie here: 1 hit die each.
    expect(w.corpses?.hitDice).toEqual([1, 1]);
    // Elsewhere, no one waits.
    w.position = { col: w.position.col + 1, row: w.position.row };
    expect(surrenderedHere(w)).toEqual([]);
    expect(releaseSurrendered(w, data)).toEqual(fail('No one here has surrendered.'));
  });

  it('records no one when no one surrendered, and clears the last surrender', () => {
    const w = world();
    win(w, [['thug-or-militia']], [0]);
    win(w, [['thug-or-militia']], []);
    expect(w.surrendered).toBeNull();
    const fight = partyBattle(w, data, [['thug-or-militia']], false, null);
    takeSurrender(w, fight);
    expect(w.surrendered).toBeNull();
  });
});

describe('the surrendered', () => {
  it('describe the land once above ground', () => {
    const w = world();
    win(w, [['thug-or-militia']], [0]);
    expect(surrenderQuestions(w)).toEqual(['land']);
    expect(questionSurrendered(w, data, 'boss')).toEqual(fail('They know nothing of that here.'));
    expect(questionSurrendered(w, data, 'land')).toEqual({ ok: true });
    expect(lastNote(w)).toBe('They describe the land about.');
    expect(questionSurrendered(w, data, 'land')).toEqual(fail('They have told all they will.'));
  });

  it('locate the boss, a vault, or the hoards below ground', () => {
    const w = below();
    Object.assign(state(w), { dungeon: 'buried-waterworks' });
    place(w, 'buried-waterworks-1', 4, 2, 'n');
    win(w, [['thug-or-militia']], [0]);
    expect(surrenderQuestions(w)).toEqual(['boss', 'vault', 'hoard']);
    expect(questionSurrendered(w, data, 'boss')).toEqual({ ok: true });
    expect(lastNote(w)).toMatch(/^They (say|know)/);
  });

  it('can give one of them to the party as a hireling, only once', () => {
    const w = world();
    win(w, [['thug-or-militia', 'veteran-soldier']], [0, 1]);
    expect(recruitable(data, 'thug-or-militia')).toBe('hireling');
    expect(recruitSurrendered(w, data, 5, null)).toEqual(fail('No such prisoner.'));
    expect(recruitSurrendered(w, data, 0, null)).toEqual({ ok: true });
    expect(w.npcs.map((n) => n.type)).toEqual(['guard']);
    expect(w.surrendered?.monsters).toEqual(['veteran-soldier']);
    expect(recruitSurrendered(w, data, 0, null)).toEqual(fail('One of them has already joined.'));
  });

  it('needs room for a hireling, and a handler for a beast', () => {
    const w = world();
    win(w, [['thug-or-militia', 'small-pack-predator']], [0, 1]);
    while (addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', null, false));
    expect(recruitSurrendered(w, data, 0, null)).toEqual(fail('There is no room in the party.'));
    expect(recruitSurrendered(w, data, 1, null)).toEqual(
      fail('Choose someone with Animal Ken and room for another beast.'),
    );
  });

  it('will not take on those who fight as no hireling or beast', () => {
    const w = world();
    win(w, [['gnoll']], [0]);
    expect(recruitable(data, 'gnoll')).toBeNull();
    expect(recruitSurrendered(w, data, 0, null)).toEqual(fail('They will not serve.'));
  });

  it('can give a beast to a handler with Animal Ken, at its rations cost', () => {
    const w = world();
    win(w, [['small-pack-predator']], [0]);
    expect(recruitable(data, 'small-pack-predator')).toBe('beast');
    const snag = member(w, 'Snag');
    expect(recruitSurrendered(w, data, 0, snag.id).ok).toBe(false);
    const ken = data.content.skillRules.animalKen.skill;
    snag.character = { ...snag.character, skills: { ...snag.character.skills, [ken]: 0 } };
    const rations = w.rations;
    expect(recruitSurrendered(w, data, 0, snag.id)).toEqual({ ok: true });
    expect(w.npcs[0]).toMatchObject({ kind: 'beast', master: snag.id });
    expect(w.rations).not.toBe(rations);
    // The last of them joined, so none are left waiting.
    expect(w.surrendered).toBeNull();
  });

  it('go free when released', () => {
    const w = world();
    win(w, [['thug-or-militia', 'thug-or-militia']], [0, 1]);
    expect(releaseSurrendered(w, data)).toEqual({ ok: true });
    expect(lastNote(w)).toBe('The party lets them go.');
    expect(w.surrendered).toBeNull();
    win(w, [['thug-or-militia']], [0]);
    releaseSurrendered(w, data);
    expect(lastNote(w)).toBe('The party lets the thug or militia go.');
  });

  it('leave corpses when killed', () => {
    const w = world();
    win(w, [['thug-or-militia', 'veteran-soldier']], [0, 1]);
    expect(w.corpses).toBeNull();
    expect(killSurrendered(w, data)).toEqual({ ok: true });
    expect(w.corpses?.hitDice).toEqual([1, 1]);
    expect(lastNote(w)).toBe('The party kills them.');
    expect(questionSurrendered(w, data, 'land')).toEqual(fail('No one here has surrendered.'));
    expect(killSurrendered(w, data)).toEqual(fail('No one here has surrendered.'));
    expect(recruitSurrendered(w, data, 0, null)).toEqual(fail('No one here has surrendered.'));
    win(w, [['veteran-soldier']], [0]);
    killSurrendered(w, data);
    expect(lastNote(w)).toBe('The party kills the veteran soldier.');
  });

  it('start out none in older saves', () => {
    const migrate = WORLD_MIGRATIONS[49] as (raw: Record<string, unknown>) => unknown;
    expect(migrate({ schemaVersion: 49 })).toEqual({ schemaVersion: 50, surrendered: null });
  });
});
