import { describe, expect, it } from 'vitest';
import { NO_HARDCORE, type Project } from '../../../src/data/schemas/index.ts';
import { workOn } from '../../../src/game/world/crafting.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';
import {
  craftingXpPerDay,
  purgeStrain,
  questXp,
  setHardcore,
} from '../../../src/game/world/hardcore.ts';
import { partySetup } from '../../../src/game/world/battle-setup.ts';
import { purgeSickness } from '../../../src/game/world/purge.ts';
import { turnInQuest } from '../../../src/game/world/quest-board.ts';
import { WORLD_MIGRATIONS } from '../../../src/game/world/save-migrations.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { questOf } from '../../../src/game/world/quests.ts';
import { rewardText } from '../../../src/render/quest-view.ts';
import { hardcoreView } from '../../../src/render/hardcore-view.ts';
import { data, member, world } from './helpers.ts';

// docs/rules-adaptation.md, Hardcore options (Sam's calls).
describe('hardcore options in the world', () => {
  it('start off, switch either way at any time, and note each change', () => {
    const w = world();
    expect(w.hardcore).toEqual(NO_HARDCORE);
    setHardcore(w, 'noQuestXp', true);
    expect(w.hardcore.noQuestXp).toBe(true);
    expect(w.log.at(-1)).toMatch(/Hardcore: No quest XP is now on\.$/);
    const lines = w.log.length;
    setHardcore(w, 'noQuestXp', true);
    expect(w.log.length).toBe(lines);
    setHardcore(w, 'noQuestXp', false);
    expect(w.log.at(-1)).toMatch(/Hardcore: No quest XP is now off\.$/);
  });

  it('go into the fight with the party', () => {
    const w = world();
    setHardcore(w, 'deathAtZero', true);
    expect(partySetup(w, data, [['thug-or-militia']], false).hardcore?.deathAtZero).toBe(true);
  });

  it('are kept in the save, and old saves load with all of them off', () => {
    const w = world();
    setHardcore(w, 'harshHealing', true);
    const back = parseWorld(serializeWorld(w), data);
    if (!back.ok) throw new Error(back.errors.join('; '));
    expect(back.world.hardcore).toEqual({ ...NO_HARDCORE, harshHealing: true });
    const up = WORLD_MIGRATIONS[59] as (raw: Record<string, unknown>) => Record<string, unknown>;
    expect(up({ schemaVersion: 59 })).toEqual({ schemaVersion: 60, hardcore: NO_HARDCORE });
  });

  it('list every option in the Hardcore window', () => {
    const w = world();
    setHardcore(w, 'noCraftingXp', true);
    const view = hardcoreView(w);
    expect(view.map((o) => o.option)).toEqual([
      'noStrainCasting',
      'deathAtZero',
      'noCraftingXp',
      'noQuestXp',
      'harshHealing',
      'healerStrain',
    ]);
    expect(view.filter((o) => o.on).map((o) => o.name)).toEqual(['No crafting XP']);
    expect(view.every((o) => o.text.length > 0)).toBe(true);
  });
});

describe('No crafting XP', () => {
  it('pays nothing for a day of work', () => {
    const w = world();
    const perDay = data.content.craftingRules.xpPerDay;
    expect(craftingXpPerDay(w, perDay)).toBe(perDay);
    setHardcore(w, 'noCraftingXp', true);
    expect(craftingXpPerDay(w, perDay)).toBe(0);
    const snag = member(w, 'Snag');
    const xp = snag.character.xp;
    const p: Project = {
      crafter: snag.id,
      kind: 'gear',
      item: 'dagger',
      quality: 'normal',
      daysLeft: 2,
      town: w.lastTown,
      staying: false,
    };
    w.projects.push(p);
    workOn(w, data, p);
    expect(p.daysLeft).toBe(1);
    expect(snag.character.xp).toBe(xp);
  });
});

describe('No quest XP', () => {
  it('pays the crowns but no XP, and the quest board says so', () => {
    const w = world();
    enterRegion(w, 'dark-lands', { col: 16, row: 15 });
    const q = questOf(data, 'mire-slavers');
    expect(questXp(w, q.reward.xp)).toBe(q.reward.xp);
    setHardcore(w, 'noQuestXp', true);
    expect(questXp(w, q.reward.xp)).toBe(0);
    const snag = member(w, 'Snag');
    const xp = snag.character.xp;
    const purse = w.purse;
    w.quests[q.id] = { status: 'ready', step: 1, acceptedDay: 0 };
    expect(turnInQuest(w, data, q.id)).toEqual({ ok: true });
    expect(snag.character.xp).toBe(xp);
    expect(w.purse).toBeGreaterThan(purse);
    expect(w.log.some((l) => l.includes('crowns and 0 XP each'))).toBe(true);
    expect(rewardText(q, true)).not.toMatch(/XP/);
    expect(rewardText(q)).toMatch(/XP/);
  });
});

describe('Harsh healing: Purge Ailment', () => {
  function sick() {
    const w = world();
    const h = member(w, 'Fizzwick');
    h.character = {
      ...h.character,
      classes: { current: 'healer-partial-mage', levels: { 'healer-partial-mage': 3 } },
      skills: { ...h.character.skills, heal: 1 },
      arts: ['healing-touch', 'purge-ailment'],
      spells: { known: [], prepared: [] },
    };
    const snag = member(w, 'Snag');
    Object.assign(snag, { poisoned: true });
    setHardcore(w, 'harshHealing', true);
    return { w, h, snag };
  }

  it('adds 1 System Strain to the ally for a poison or disease', () => {
    const { w, h, snag } = sick();
    expect(purgeStrain(w)).toBe(1);
    expect(purgeSickness(w, data, h.id, snag.id, 'poison')).toEqual({ ok: true });
    expect(snag.poisoned).toBe(false);
    expect(snag.character.strain.value).toBe(1);
    setHardcore(w, 'harshHealing', false);
    expect(purgeStrain(w)).toBe(0);
  });

  it('is refused, spending nothing, for an ally who can’t bear it', () => {
    const { w, h, snag } = sick();
    const max = snag.character.attributes.base.con;
    snag.character = { ...snag.character, strain: { value: max, broken: false } };
    expect(purgeSickness(w, data, h.id, snag.id, 'poison')).toEqual({
      ok: false,
      reason: "Snag can't bear more strain.",
    });
    expect(snag.poisoned).toBe(true);
    expect(h.effortDay).toBe(0);
  });
});
