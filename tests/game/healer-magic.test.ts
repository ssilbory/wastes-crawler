import { describe, expect, it } from 'vitest';
import type { ClassOption } from '../../src/data/schemas/index.ts';
import { classOption } from '../../src/game/character/class-step.ts';
import {
  artChoices,
  artOpen,
  artPicks,
  evaluateMagic,
  learnableSpells,
} from '../../src/game/character/magic.ts';
import { data } from './combat/helpers.ts';

const mage = (id: string) =>
  (classOption(data, id) as ClassOption).mage as NonNullable<ClassOption['mage']>;

describe('the Priest of Death and the Blood Priest/Healer (Phase 14d)', () => {
  const priest = mage('healer-partial-mage');
  const healerPick = { tradition: 'healer', automatic: ['healing-touch'], picks: 1 };

  it('learns no spell that raises the dead', () => {
    const ids = learnableSpells(data, priest, 4).map((s) => s.id);
    expect(ids).toContain('command-the-dead');
    expect(ids).not.toContain('raise-corpse');
    expect(ids).not.toContain('raise-grave-knight');
    const necro = learnableSpells(data, mage('full-necromancer'), 4).map((s) => s.id);
    expect(necro).toContain('raise-corpse');
    expect(learnableSpells(data, mage('blood-priest-partial-mage'), 0)).toEqual([]);
  });

  it('opens Limb Restoration and Revive the Fallen at 8th level, as the SRD says', () => {
    expect(artOpen(data, 'healer', 'revive-the-fallen', 7)).toBe(false);
    expect(artOpen(data, 'healer', 'revive-the-fallen', 8)).toBe(true);
    expect(artOpen(data, 'healer', 'swift-healer', 1)).toBe(true);
    expect(artOpen(data, 'no-such-tradition', 'swift-healer', 1)).toBe(true);
    const early = artChoices(data, healerPick, ['swift-healer'], 1).map((a) => a.id);
    expect(early).not.toContain('healing-touch');
    expect(early).not.toContain('swift-healer');
    expect(early).not.toContain('revive-the-fallen');
    expect(early).not.toContain('limb-restoration');
    expect(early).toContain('vital-furnace');
    const late = artChoices(data, healerPick, [], 8).map((a) => a.id);
    expect(late).toContain('revive-the-fallen');
  });

  it('refuses a gated art at character creation', () => {
    expect(artPicks(data, priest).map((p) => p.tradition)).toEqual(['necromancer', 'healer']);
    expect(
      evaluateMagic(data, priest, { arts: ['revive-the-fallen'], known: [], prepared: [] }).status,
    ).toEqual({ state: 'error', message: 'revive-the-fallen waits for a higher level' });
    const bp = mage('blood-priest-partial-mage');
    const ok = evaluateMagic(data, bp, {
      arts: ['armor-of-god', 'merciful-healing', 'vital-furnace'],
      known: [],
      prepared: [],
    });
    expect(ok.status).toEqual({ state: 'ok' });
    expect(ok.arts).toEqual(['healing-touch', 'armor-of-god', 'merciful-healing', 'vital-furnace']);
  });
});
