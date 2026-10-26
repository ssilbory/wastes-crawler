import { describe, expect, it } from 'vitest';
import type { PendingEncounter } from '../../../src/data/schemas/index.ts';
import { characterSheet } from '../../../src/game/character/derived.ts';
import { purgeSickness, sickAllies } from '../../../src/game/world/purge.ts';
import { purgeView } from '../../../src/render/purge-view.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, member, world } from './helpers.ts';

const fail = (reason: string) => ({ ok: false, reason });

describe('Purge Ailment against poison and disease (1.5.9)', () => {
  /** Fizzwick at `level` with Heal-1 and Purge Ailment, and Snag Poisoned and sick. */
  function sick(faces: number[], level = 3, disease = 'pit-flux') {
    const w = world();
    w.rng = scriptedRng(faces);
    const h = member(w, 'Fizzwick');
    h.character = {
      ...h.character,
      classes: { current: 'healer-partial-mage', levels: { 'healer-partial-mage': level } },
      skills: { ...h.character.skills, heal: 1 },
      arts: ['healing-touch', 'purge-ailment'],
      spells: { known: [], prepared: [] },
    };
    const snag = member(w, 'Snag');
    Object.assign(snag, { poisoned: true, disease: { id: disease, nights: 3, saves: 1 } });
    return { w, h, snag };
  }

  it('cures a poison or a plain disease outright, for a point of day Effort each', () => {
    const { w, h, snag } = sick([]);
    expect(purgeSickness(w, data, h.id, snag.id, 'poison')).toEqual({ ok: true });
    expect(snag.poisoned).toBe(false);
    expect(w.log.at(-1)).toMatch(/purges Snag of the poison/);
    expect(purgeSickness(w, data, h.id, snag.id, 'disease')).toEqual({ ok: true });
    expect(snag.disease).toBeNull();
    expect(w.log.at(-1)).toMatch(/purges Snag of Pit Flux/);
    expect(h.effortDay).toBe(2);
    // Neither adds strain.
    expect(snag.character.strain.value).toBe(0);
  });

  it('needs a Heal check for a disease with a purge difficulty, spending the Effort either way', () => {
    // Grave Rot: difficulty 8. 1 + 1 + Heal-1 and Fizzwick's Int can't make it; 6 + 6 can.
    const miss = sick([1, 1], 3, 'grave-rot');
    expect(purgeSickness(miss.w, data, miss.h.id, miss.snag.id, 'disease')).toEqual({ ok: true });
    expect(miss.snag.disease?.id).toBe('grave-rot');
    expect(miss.h.effortDay).toBe(1);
    expect(miss.w.log.at(-1)).toMatch(/the Grave Rot holds/);
    const hit = sick([6, 6], 3, 'grave-rot');
    purgeSickness(hit.w, data, hit.h.id, hit.snag.id, 'disease');
    expect(hit.snag.disease).toBeNull();
  });

  it('takes only scene Effort from 7th level, which a Healer with Effort left keeps', () => {
    const { w, h, snag } = sick([], 7);
    purgeSickness(w, data, h.id, snag.id, 'poison');
    purgeSickness(w, data, h.id, snag.id, 'disease');
    expect(h.effortDay).toBe(0);
    // Still needs Effort to commit.
    const tired = sick([], 7);
    tired.h.effortDay = (
      characterSheet(tired.h.character, data).magic as { effort: number }
    ).effort;
    expect(purgeSickness(tired.w, data, tired.h.id, tired.snag.id, 'poison')).toEqual(
      fail('Fizzwick has no Effort left today.'),
    );
  });

  it('tends only allies who have the ailment, never the Healer', () => {
    const { w, h, snag } = sick([]);
    h.poisoned = true;
    expect(sickAllies(w, h.id, 'poison')).toEqual([snag]);
    expect(purgeSickness(w, data, h.id, h.id, 'poison')).toEqual(
      fail('Choose an ally who is Poisoned.'),
    );
    expect(purgeSickness(w, data, h.id, member(w, 'Grukk').id, 'disease')).toEqual(
      fail('Choose an ally who is sick.'),
    );
    w.encounter = {} as PendingEncounter;
    expect(purgeSickness(w, data, h.id, snag.id, 'poison')).toEqual(
      fail('Settle the encounter first.'),
    );
    w.encounter = null;
    expect(purgeSickness(w, data, 'nobody', snag.id, 'poison')).toEqual(
      fail('No one is able to purge an ailment.'),
    );
    expect(h.effortDay).toBe(0);
  });

  it('shows each ailment an ally has on the panel', () => {
    const { w, h, snag } = sick([], 3, 'grave-rot');
    snag.frail = true;
    expect(purgeView(w, data)?.healers[0]?.tend).toEqual([
      { id: snag.id, name: 'Snag', ailment: 'frailty', label: 'Frailty' },
      { id: snag.id, name: 'Snag', ailment: 'poison', label: 'poison' },
      { id: snag.id, name: 'Snag', ailment: 'disease', label: 'Grave Rot' },
    ]);
    expect(h.id).toBe('m-3');
  });
});
