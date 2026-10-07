import { describe, expect, it } from 'vitest';
import {
  impute,
  IMPUTATION,
  mimesis,
  MIMESIS,
  cannotImpute,
} from '../../../src/game/world/illusions.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng, scriptedThen } from '../../helpers/scripted-rng.ts';
import { below } from '../dungeon/helpers.ts';
import { fail, highMage } from './helpers-mage.ts';
import { data, encounter, world } from './helpers.ts';

describe('The Inexorable Imputation', () => {
  it('moves the mood two bands friendlier on a failed save, with its goodwill', () => {
    const w = world();
    const m = highMage(w, [IMPUTATION]);
    w.encounter = encounter([['thug-or-militia', 'thug-or-militia']], { reaction: 'unfriendly' });
    w.rng = scriptedRng([1]);
    expect(impute(w, data, m.id)).toEqual({ ok: true });
    expect(m.spellsCast).toBe(1);
    expect(w.encounter).toMatchObject({ reaction: 'friendly', hostile: false, parleyed: true });
    expect(w.log.at(-1)).toContain('Fizzwick speaks, and they believe every word.');
  });

  it('stops at helpful, and pays tribute there', () => {
    const w = world();
    const m = highMage(w, [IMPUTATION]);
    w.encounter = encounter([['thug-or-militia']], { reaction: 'friendly', hostile: false });
    w.rng = scriptedThen([1], createRng('tribute'));
    impute(w, data, m.id);
    expect(w.encounter?.reaction).toBe('helpful');
    expect(w.log.join('\n')).toContain('They offer tribute to be left in peace.');
  });

  it('changes nothing but the parley when they save', () => {
    const w = world();
    const m = highMage(w, [IMPUTATION]);
    w.encounter = encounter([['thug-or-militia']]);
    w.rng = scriptedRng([20]);
    expect(impute(w, data, m.id)).toEqual({ ok: true });
    expect(w.encounter).toMatchObject({ reaction: 'expected', hostile: true, parleyed: true });
    expect(w.log.at(-1)).toContain("Fizzwick speaks, but they aren't persuaded.");
    m.spellsCast = 0;
    expect(impute(w, data, m.id)).toEqual(fail('They have heard enough.'));
  });

  it('lets the party past the bound while their order holds', () => {
    const w = world();
    const m = highMage(w, [IMPUTATION]);
    w.encounter = encounter([['bound-goblin-sentry']], { order: 'ash-road-patrol' });
    w.rng = scriptedRng([1]);
    impute(w, data, m.id);
    expect(w.encounter).toMatchObject({ hostile: false, spotted: true, reaction: 'expected' });
    expect(w.ordersEnded).toEqual([]);
  });

  it('works on people only, never on a quest encounter', () => {
    const w = world();
    const m = highMage(w, [IMPUTATION]);
    expect(impute(w, data, m.id)).toEqual(fail('There is no one here to tell.'));
    w.encounter = encounter([['thug-or-militia', 'small-pack-predator']]);
    expect(cannotImpute(w, data)).toBe('Only people can be made to believe.');
    expect(impute(w, data, m.id)).toEqual(fail('Only people can be made to believe.'));
    w.encounter = encounter([['thug-or-militia']], { quest: 'some-quest' });
    expect(impute(w, data, m.id)).toEqual(
      fail('Nothing they could hear would turn them from this fight.'),
    );
    w.encounter = encounter([['thug-or-militia']]);
    m.character.spells.prepared = [];
    expect(impute(w, data, m.id)).toEqual(
      fail("Fizzwick hasn't prepared The Inexorable Imputation."),
    );
    expect(m.spellsCast).toBe(0);
  });
});

describe('Phantasmal Mimesis', () => {
  it('slips the party away from a group that spotted it, on a failed save', () => {
    const w = world();
    const m = highMage(w, [MIMESIS]);
    w.encounter = encounter([['thug-or-militia']]);
    w.rng = scriptedThen([1], createRng('away'));
    const quarter = w.quarter;
    expect(mimesis(w, data, m.id)).toEqual({ ok: true });
    expect(w.encounter === null || w.quarter !== quarter).toBe(true);
    expect(w.log.join('\n')).toContain("Fizzwick's illusion draws their eyes away.");
    expect(w.log.join('\n')).toContain('The party slips away unseen.');
  });

  it('takes a turn to slip away underground', () => {
    const d = below();
    const m = highMage(d, [MIMESIS]);
    d.encounter = encounter([['thug-or-militia']]);
    d.rng = scriptedThen([1], createRng('below'));
    const turn = d.dungeon?.turn ?? 0;
    mimesis(d, data, m.id);
    expect(d.dungeon?.turn).toBe(turn + 1);
  });

  it('is seen through on a save, and the spell is spent', () => {
    const w = world();
    const m = highMage(w, [MIMESIS]);
    w.encounter = encounter([['thug-or-militia']]);
    w.rng = scriptedRng([20]);
    expect(mimesis(w, data, m.id)).toEqual({ ok: true });
    expect(m.spellsCast).toBe(1);
    expect(w.encounter).toMatchObject({ hostile: true, spotted: false });
    expect(w.log.at(-1)).toContain("Fizzwick's illusion is seen for what it is.");
  });

  it('is no use on the mindless, a spotted group, or a peaceful one', () => {
    const w = world();
    const m = highMage(w, [MIMESIS]);
    expect(mimesis(w, data, m.id)).toEqual(fail('There is no one here to fool.'));
    w.encounter = encounter([['automaton-humanlike']]);
    expect(mimesis(w, data, m.id)).toEqual(fail('The mindless pay illusions no heed.'));
    w.encounter = encounter([['thug-or-militia']], { spotted: true });
    expect(mimesis(w, data, m.id)).toEqual(fail('The party can leave without magic.'));
    w.encounter = encounter([['thug-or-militia']], { hostile: false });
    expect(mimesis(w, data, m.id)).toEqual(fail('The party can leave without magic.'));
    w.encounter = encounter([['thug-or-militia']]);
    m.spellsCast = 99;
    expect(mimesis(w, data, m.id)).toEqual(fail('Fizzwick has no spells left today.'));
  });
});
