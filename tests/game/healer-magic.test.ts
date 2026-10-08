import { describe, expect, it } from 'vitest';
import type { ClassOption } from '../../src/data/schemas/index.ts';
import { classOption } from '../../src/game/character/class-step.ts';
import {
  artBar,
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

  it('opens Revive the Fallen at 8th level, as the SRD says, and never Limb Restoration', () => {
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
    // Purge Ailment lifts Frailty in this game, so it's offered from 1st level.
    expect(early).toContain('purge-ailment');
    expect(artBar(data, 'healer', 'purge-ailment', 1)).toBeNull();
    const late = artChoices(data, healerPick, [], 8).map((a) => a.id);
    expect(late).toContain('revive-the-fallen');
    // No one in the game loses a limb, so Limb Restoration is left out at every level.
    expect(late).not.toContain('limb-restoration');
    expect(artBar(data, 'healer', 'limb-restoration', 10)).toBe(
      "limb-restoration isn't used in this game",
    );
    // Healing Touch reaches only beside and ahead, so Far Healer can be picked from 1st level.
    expect(artBar(data, 'healer', 'far-healer', 1)).toBeNull();
  });

  it('grants automatic arts as listed when a tradition has no content entry', () => {
    const bare = { ...data, content: { ...data.content, traditions: [] } };
    expect(artPicks(bare, mage('full-elementalist'))[0]?.automatic).toEqual([
      'elemental-resilience',
      'elemental-sparks',
    ]);
  });

  it('refuses a gated art at character creation', () => {
    expect(artPicks(data, priest).map((p) => p.tradition)).toEqual(['necromancer', 'healer']);
    expect(
      evaluateMagic(data, priest, { arts: ['revive-the-fallen'], known: [], prepared: [] }).status,
    ).toEqual({ state: 'error', message: 'revive-the-fallen waits for a higher level' });
    expect(
      evaluateMagic(data, priest, { arts: ['limb-restoration'], known: [], prepared: [] }).status,
    ).toEqual({ state: 'error', message: "limb-restoration isn't used in this game" });
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
