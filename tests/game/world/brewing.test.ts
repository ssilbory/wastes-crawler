import { describe, expect, it } from 'vitest';
import {
  brewCost,
  brewDifficulty,
  canBrew,
  reagentsListed,
  recipeOf,
  startBrew,
} from '../../../src/game/world/brewing.ts';
import { abandonProject, craftShift, workOn } from '../../../src/game/world/crafting.ts';
import { checkBonus } from '../../../src/game/world/members.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { projectText } from '../../../src/render/crafting-view.ts';
import { data, encounter, member, world } from './helpers.ts';

const learn = (m: Member, level = 1) => {
  m.character = { ...m.character, skills: { ...m.character.skills, alchemy: level } };
};
const potions = (m: Member, id: string) =>
  m.character.inventory.filter((e) => e.id === id).reduce((n, e) => n + e.quantity, 0);

const KIT = data.content.alchemy.kit.id;
const give = (m: Member, id: string) => {
  m.character = {
    ...m.character,
    inventory: [...m.character.inventory, { id, quantity: 1, location: 'stowed' }],
  };
};
const drop = (m: Member, id: string) => {
  m.character = { ...m.character, inventory: m.character.inventory.filter((e) => e.id !== id) };
};

/** Lirael with Alchemy and an alchemist's kit, the party with 100 crowns and 9 spore essence. */
function brewer(faces: number[] = []): { w: World; lirael: Member } {
  const w = world(faces);
  w.purse = 100;
  w.components = { 'spore-essence': 9 };
  const lirael = member(w, 'Lirael');
  learn(lirael);
  give(lirael, KIT);
  return { w, lirael };
}

describe('brewing (docs/rules-adaptation.md, Potions: Brewing)', () => {
  it('takes the Alchemy skill, and a batch costs the item’s cost whatever its size', () => {
    const { w, lirael } = brewer();
    expect(canBrew(data, lirael)).toBe(true);
    expect(canBrew(data, member(w, 'Snag'))).toBe(false);
    expect(reagentsListed(data, 'healing-draught')).toBe(10);
    expect(reagentsListed(data, 'antidote')).toBe(25);
    // The party pays half (Sam's call).
    expect(brewCost(data, 'healing-draught')).toBe(5);
    expect(brewCost(data, 'antidote')).toBe(12.5);
    expect(brewDifficulty(data, 'healing-draught', 1)).toBe(8);
    expect(brewDifficulty(data, 'healing-draught', 2)).toBe(9);
    expect(brewDifficulty(data, 'greater-healing', 4)).toBe(12);
    expect(() => recipeOf(data, 'dagger')).toThrow();
    expect(() => brewDifficulty(data, 'healing-draught', 3)).toThrow();
  });

  it('starts a week’s brew, paid now', () => {
    const { w, lirael } = brewer();
    expect(startBrew(w, data, lirael.id, 'healing-draught', 4)).toEqual({ ok: true });
    expect(w.purse).toBe(95);
    expect(w.components).toEqual({ 'spore-essence': 8 });
    expect(w.projects).toEqual([
      expect.objectContaining({ kind: 'brew', item: 'healing-draught', doses: 4, daysLeft: 7 }),
    ]);
    expect(projectText(w, data, w.projects[0] as World['projects'][number])).toBe(
      'Lirael: brewing 4 × Healing Draught, 7 days left',
    );
    expect(startBrew(w, data, lirael.id, 'healing-draught', 1)).toEqual({
      ok: false,
      reason: 'Lirael is already making something.',
    });
    expect(abandonProject(w, data, lirael.id)).toEqual({ ok: true });
    expect(w.log.at(-1)).toContain('gives up on the Healing Draught');
  });

  it('refuses without the skill, the crowns, or in an encounter', () => {
    const { w, lirael } = brewer();
    const snag = member(w, 'Snag');
    expect(startBrew(w, data, snag.id, 'healing-draught', 1)).toEqual({
      ok: false,
      reason: 'Snag has no Alchemy skill.',
    });
    w.components = {};
    expect(startBrew(w, data, lirael.id, 'healing-draught', 1)).toEqual({
      ok: false,
      reason: 'It needs 1 essence.',
    });
    w.components = { 'ooze-essence': 1 };
    w.purse = 0;
    expect(startBrew(w, data, lirael.id, 'healing-draught', 1).ok).toBe(false);
    // Short of crowns, the essence stays in the stash.
    expect(w.components).toEqual({ 'ooze-essence': 1 });
    drop(lirael, KIT);
    expect(startBrew(w, data, lirael.id, 'healing-draught', 1)).toEqual({
      ok: false,
      reason: "Lirael needs an Alchemist's Kit.",
    });
    expect(() => startBrew(w, data, 'nobody', 'healing-draught', 1)).toThrow();
    w.encounter = encounter([['thug-or-militia']]);
    expect(startBrew(w, data, lirael.id, 'healing-draught', 1)).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
  });

  it('rolls Int/Alchemy when the work is done: the batch, or the brew lost', () => {
    const { w, lirael } = brewer([6, 6, 1, 1]);
    startBrew(w, data, lirael.id, 'healing-draught', 2);
    const p = w.projects[0] as World['projects'][number];
    workOn(w, data, p, 7);
    expect(w.projects).toEqual([]);
    expect(potions(lirael, 'healing-draught')).toBe(2);
    expect(w.log.at(-1)).toContain('Lirael brews 2 × Healing Draught.');
    // Single-use items take no flaws: a failed brew is lost (Sam's call).
    startBrew(w, data, lirael.id, 'greater-healing', 1);
    workOn(w, data, w.projects[0] as World['projects'][number], 7);
    expect(potions(lirael, 'greater-healing')).toBe(0);
    expect(w.log.at(-1)).toContain('spoils in the pot');
  });

  it('gives +1 for another brewer in the party, as the SRD’s apprentice', () => {
    // Dice one short of Greater Healing's 10 alone, enough with help.
    const bonus = checkBonus(data, brewer().lirael, 'alchemy', ['int']);
    const dice = 9 - bonus;
    const faces = [Math.ceil(dice / 2), Math.floor(dice / 2)];
    const brews = (help: boolean) => {
      const { w, lirael } = brewer(faces);
      if (help) learn(member(w, 'Fizzwick'));
      startBrew(w, data, lirael.id, 'greater-healing', 1);
      workOn(w, data, w.projects[0] as World['projects'][number], 7);
      return potions(lirael, 'greater-healing');
    };
    expect(brews(false)).toBe(0);
    expect(brews(true)).toBe(1);
  });

  it('goes on in camp shifts with the alchemist’s kit, not crafting tools', () => {
    const { w, lirael } = brewer([6, 6]);
    startBrew(w, data, lirael.id, 'waking-tonic', 1);
    drop(lirael, KIT);
    give(lirael, data.content.craftingRules.tools.id);
    w.position = { col: 3, row: 3 };
    craftShift(w, data, lirael);
    expect(w.projects[0]?.daysLeft).toBe(7);
    expect(w.log.at(-1)).toContain('Lirael has nothing to work on here.');
    give(lirael, KIT);
    craftShift(w, data, lirael);
    expect(w.projects[0]?.daysLeft).toBe(6.5);
    expect(w.log.at(-1)).toContain('Lirael works on a brew of Waking Tonic.');
  });
});
