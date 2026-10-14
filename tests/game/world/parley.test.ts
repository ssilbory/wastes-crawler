import { describe, expect, it } from 'vitest';
import { applyBattle, encounterBattle } from '../../../src/game/world/fight.ts';
import { firstAid, healers } from '../../../src/game/world/first-aid.ts';
import { hire } from '../../../src/game/world/hire.ts';
import { mindOf, parleyReach, reactionBonus } from '../../../src/game/world/minds.ts';
import { addNpc, guideOf, removeNpc } from '../../../src/game/world/npcs.ts';
import { maybeEncounter } from '../../../src/game/world/encounters.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { acceptOffer, bribePrice, canParley, parley } from '../../../src/game/world/parley.ts';
import { freeCaptive } from '../../../src/game/world/rescue.ts';
import { enterTown } from '../../../src/game/world/town.ts';
import type { Npc, World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, encounter, member, world } from './helpers.ts';

const plains = { col: 5, row: 9 };
function out(faces: number[] = []): World {
  const w = world(faces);
  w.purse = 100;
  w.position = plains;
  return w;
}
const withFocus = (w: World, name: string, id: string, level = 1) => {
  const m = member(w, name);
  m.character = {
    ...m.character,
    foci: [...m.character.foci.filter((f) => f.id !== id), { id, level }],
  };
};

describe('who will talk (docs/rules-adaptation.md, Parley)', () => {
  it('knows each monster’s mind', () => {
    expect(mindOf(data, 'thug-or-militia')).toBe('sapient');
    expect(mindOf(data, 'herd-beast')).toBe('animal');
    expect(mindOf(data, 'predator-small-vicious')).toBe('monster');
    expect(mindOf(data, 'slime-or-ooze')).toBe('mindless');
    expect(() => mindOf(data, 'dragon')).toThrow('unknown monster dragon');
  });

  it('opens animals with Rider and monsters with Well-Met 2; Well-Met adds +1 to reactions', () => {
    const w = out();
    expect(reactionBonus(w, data)).toBe(1);
    expect(parleyReach(w, data)).toEqual({ minds: new Set(['sapient']), evenAggressive: true });
    withFocus(w, 'Snag', 'rider');
    withFocus(w, 'Lirael', 'well-met', 2);
    expect(parleyReach(w, data).minds).toEqual(new Set(['sapient', 'animal', 'monster']));
    member(w, 'Lirael').character = {
      ...member(w, 'Lirael').character,
      hp: { ...member(w, 'Lirael').character.hp, current: 0 },
    };
    expect(reactionBonus(w, data)).toBe(0);
  });

  it('parleys once, never with the mindless, and with the aggressive only through Well-Met', () => {
    const w = out();
    expect(canParley(w, data)).toBe(false);
    w.encounter = encounter([['thug-or-militia']], { reaction: 'aggressive' });
    expect(canParley(w, data)).toBe(true);
    w.encounter = encounter([['herd-beast']]);
    expect(canParley(w, data)).toBe(false);
    w.encounter = encounter([['slime-or-ooze']]);
    withFocus(w, 'Lirael', 'well-met', 2);
    expect(canParley(w, data)).toBe(false);
    w.encounter = encounter([['predator-small-vicious']]);
    expect(canParley(w, data)).toBe(true);
    w.encounter = encounter([['thug-or-militia']], { parleyed: true });
    expect(canParley(w, data)).toBe(false);
    const plain = out();
    plain.members = plain.members.filter((m) => m.character.name !== 'Lirael');
    plain.encounter = encounter([['thug-or-militia']], { reaction: 'aggressive' });
    expect(canParley(plain, data)).toBe(false);
    expect(parley(plain, data, 'bribe', null)).toEqual({ ok: false, reason: "They won't parley." });
  });
});

describe('parley (SRD 5.2.1, 5.2.2)', () => {
  it('bribes at 5 crowns a hit die for one band friendlier', () => {
    const w = out();
    w.encounter = encounter([['thug-or-militia', 'skilled-veteran']]);
    expect(bribePrice(w, data)).toBe(15);
    w.purse = 10;
    expect(parley(w, data, 'bribe', null)).toEqual({
      ok: false,
      reason: 'A bribe costs 15 crowns.',
    });
    w.purse = 15;
    expect(parley(w, data, 'bribe', null)).toEqual({ ok: true });
    expect(w.encounter).toMatchObject({ reaction: 'friendly', hostile: false, parleyed: true });
    expect(w.purse).toBe(0);
    expect(w.log.at(-1)).toBe(
      'Day 1, morning: The parley goes well. They seem in no mood for trouble.',
    );
    w.encounter = null;
    expect(() => bribePrice(w, data)).toThrow('no encounter');
  });

  it('talks with Cha/Convince against 8, or 10 when they mean to fight', () => {
    const w = out([1, 1]);
    w.encounter = encounter([['thug-or-militia']]);
    expect(parley(w, data, 'talk', null)).toEqual({
      ok: false,
      reason: 'Choose someone to do the talking.',
    });
    expect(parley(w, data, 'talk', 'm-2')).toEqual({ ok: true });
    expect(w.encounter).toMatchObject({ reaction: 'unfriendly', hostile: true });
    expect(w.log.at(-1)).toContain('The parley goes badly.');
    w.encounter = encounter([['thug-or-militia']], { reaction: 'aggressive' });
    w.rng = scriptedRng([1, 1]);
    parley(w, data, 'talk', 'm-2');
    expect(w.encounter?.reaction).toBe('aggressive');
    // A group that doesn't mean to fight is easier: 6 + 5, less 2 for Lirael's unskilled Cha -1,
    // makes 9, enough against 8 but not 10.
    w.encounter = encounter([['peaceful-human']], { nature: 'wary', hostile: false });
    w.rng = scriptedRng([6, 5]);
    parley(w, data, 'talk', 'm-2');
    expect(w.encounter.reaction).toBe('friendly');
  });

  it('intimidates with Str or Cha/Lead, with advantage when the party outnumbers them', () => {
    const w = out([6, 6, 1]);
    w.encounter = encounter([['thug-or-militia']]);
    expect(parley(w, data, 'intimidate', 'm-1')).toEqual({ ok: true });
    expect(w.encounter?.reaction).toBe('friendly');
    const crowd = out([6, 5]);
    crowd.encounter = encounter([Array(6).fill('thug-or-militia')], { nature: 'wary' });
    parley(crowd, data, 'intimidate', 'm-1');
    expect(crowd.encounter?.hostile).toBe(false);
  });

  it('frees captives, and the most helpful pay tribute and offer to sign on', () => {
    const w = out([1]);
    w.encounter = encounter([['thug-or-militia', 'herd-beast']], {
      reaction: 'friendly',
      captive: 'merchant',
    });
    withFocus(w, 'Snag', 'rider');
    expect(acceptOffer(w, data)).toEqual({ ok: false, reason: 'No one has offered to join.' });
    parley(w, data, 'bribe', null);
    expect(w.encounter).toMatchObject({ reaction: 'helpful', captive: null, offer: 'guard' });
    expect(w.npcs[0]).toMatchObject({
      kind: 'captive',
      type: 'merchant',
      name: 'A captured merchant',
    });
    expect(w.loot).toEqual([{ count: 1, sides: 6 }]);
    w.rng = scriptedRng([4]);
    expect(acceptOffer(w, data)).toEqual({ ok: true });
    expect(w.npcs[1]).toMatchObject({ kind: 'hireling', type: 'guard', hp: 4 });
    expect(w.encounter?.offer).toBeNull();
    w.encounter = encounter([['herd-beast']], { reaction: 'friendly' });
    parley(w, data, 'bribe', null);
    expect(w.encounter.offer).toBeNull();
    w.encounter = { ...w.encounter, offer: 'guard' };
    expect(acceptOffer(w, data)).toEqual({ ok: false, reason: 'There is no room in the party.' });
  });
});

describe('rescues', () => {
  it('needs a free slot, and delivers captives home for crowns and XP', () => {
    const w = out([2, 2, 3, 0, 0]);
    expect(freeCaptive(w, data, 'merchant')).toBe(true);
    // The party learns where they are bound.
    expect(w.log.at(-1)).toContain('joins the party until they reach Scrapmarch.');
    expect(freeCaptive(w, data, 'pilgrim')).toBe(true);
    expect(freeCaptive(w, data, 'scholar')).toBe(false);
    expect(w.log.at(-1)).toContain('with no room in the party goes their own way');
    w.npcs = w.npcs.filter((n) => n.type !== 'pilgrim');
    const quitter = addNpc(w, data, 'hireling', 'porter', 'peaceful-human', 'Quitter', false);
    Object.assign(quitter ?? {}, {
      quitting: true,
      inventory: [{ id: 'crowbar', quantity: 1, location: 'stowed' }],
    });
    member(w, 'Snag').dead = true;
    w.position = { col: 20, row: 8 };
    enterTown(w, data, 'eastmarch');
    expect(w.npcs).toEqual([]);
    expect(w.purse).toBe(160);
    expect(member(w, 'Grukk').character.xp).toBe(1);
    expect(member(w, 'Snag').pendingXp).toBe(1);
    const log = w.log.join('\n');
    expect(log).toContain(
      'A captured merchant is home safe: a reward of 60 crowns, and 1 XP each.',
    );
    expect(log).toContain('Quitter collects their pay and leaves, dropping the load.');
    expect(log).toContain('Brother Aldo has work that would raise the dead');
    const empty = out([2, 1]);
    freeCaptive(empty, data, 'scholar');
    addNpc(empty, data, 'hireling', 'guard', 'thug-or-militia', 'Stays', true);
    empty.position = { col: 3, row: 8 };
    enterTown(empty, data, 'westhold');
    expect(empty.npcs).toHaveLength(2);
  });
});

describe('NPCs in overland fights', () => {
  it('fight in their slots, die for good, and free the enemy’s captive on a win', () => {
    const w = world();
    w.purse = 100;
    hire(w, data, 'guard');
    hire(w, data, 'mundane-physician');
    w.position = plains;
    w.encounter = encounter([['thug-or-militia']], { captive: 'merchant' });
    const fight = encounterBattle(w, data);
    expect(fight.npcIds).toEqual(['npc-0', 'npc-1']);
    expect(fight.battle.combatants[5]).toMatchObject({
      name: 'Brenna',
      noncombatant: true,
      hasHealKit: true,
      healModifier: 1,
    });
    Object.assign(fight.battle.combatants[4] ?? {}, { status: 'dead', hp: 0 });
    Object.assign(fight.battle.combatants[5] ?? {}, { hp: 1 });
    w.rng = scriptedRng([3, 1, 1]);
    const won = { outcome: 'party' as const, rounds: 2, deaths: 0, battle: fight.battle };
    applyBattle(w, data, fight, won, null);
    expect(w.npcs.map((n) => [n.name, n.hp])).toEqual([
      ['Brenna', 1],
      ['A captured merchant', 3],
    ]);
    expect(w.log.join('\n')).toContain('Aldo dies.');
  });

  it('tests Morale after a dangerous win, and loses captives when the party falls', () => {
    const w = out();
    w.rng = createRng('setup');
    addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'Aldo', true);
    addNpc(w, data, 'captive', 'merchant', 'peaceful-human', 'Merrit', false);
    w.encounter = encounter([['thug-or-militia']]);
    let fight = encounterBattle(w, data);
    Object.assign(fight.battle.combatants[5] ?? {}, { status: 'dead', hp: 0 });
    w.rng = scriptedRng([6, 6]);
    const deadly = { downRate: 0.9, winRate: 0.1 };
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'draw', rounds: 2, deaths: 0, battle: fight.battle },
      deadly,
    );
    expect(w.log.join('\n')).toContain('Merrit is killed; the rescue is lost.');
    expect(w.npcs[0]?.quitting).toBe(true);
    w.rng = createRng('again');
    addNpc(w, data, 'captive', 'merchant', 'peaceful-human', 'Merrit', false);
    w.encounter = encounter([['thug-or-militia']]);
    fight = encounterBattle(w, data);
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'enemy', rounds: 3, deaths: 0, battle: fight.battle },
      null,
    );
    expect(w.npcs).toEqual([]);
    const log = w.log.join('\n');
    expect(log).toContain('Merrit is taken captive again.');
    expect(log).toContain('Aldo collects their pay and leaves.');
  });
});

describe('first aid (SRD 2.5.4)', () => {
  it('needs a healer’s kit: Heal skill or 1d6-1, physicians +1', () => {
    const w = out([6]);
    expect(healers(w, data)).toEqual([]);
    const lirael = member(w, 'Lirael');
    lirael.character = {
      ...lirael.character,
      inventory: [
        ...lirael.character.inventory,
        { id: 'healers-pouch', quantity: 1, location: 'stowed' },
      ],
    };
    const fizz = member(w, 'Fizzwick');
    fizz.character = {
      ...fizz.character,
      skills: {},
      inventory: [
        ...fizz.character.inventory,
        { id: 'healers-pouch', quantity: 1, location: 'stowed' },
      ],
    };
    addNpc(w, data, 'hireling', 'mundane-physician', 'peaceful-human', 'Doc', false);
    expect(healers(w, data)).toEqual([
      { id: 'm-2', name: 'Lirael', bonus: 1 },
      { id: 'm-3', name: 'Fizzwick', bonus: -1 },
      { id: 'npc-0', name: 'Doc', bonus: 1 },
    ]);
  });

  it('heals 1d6 plus the bonus, adding 1 strain to PCs after the free one each day', () => {
    const w = out([3, 5]);
    addNpc(w, data, 'hireling', 'mundane-physician', 'peaceful-human', 'Doc', false);
    addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'Aldo', true);
    expect(firstAid(w, data, 'm-0', 'm-1')).toEqual({
      ok: false,
      reason: 'That healer has no healer’s kit at hand.',
    });
    expect(firstAid(w, data, 'npc-0', 'm-1')).toEqual({ ok: false, reason: 'Grukk is unhurt.' });
    const grukk = member(w, 'Grukk');
    grukk.character = { ...grukk.character, hp: { ...grukk.character.hp, current: 1 } };
    // The physician's first application of the day costs no strain; the next one does.
    w.rng = scriptedRng([2, 2]);
    expect(firstAid(w, data, 'npc-0', 'm-1')).toEqual({ ok: true });
    expect(grukk.character.hp.current).toBe(4);
    expect(grukk.character.strain.value).toBe(0);
    expect(w.log.at(-1)).toContain('gently enough to cost no strain');
    expect(firstAid(w, data, 'npc-0', 'm-1')).toEqual({ ok: true });
    expect(grukk.character.hp.current).toBe(7);
    expect(grukk.character.strain.value).toBe(1);
    grukk.character = { ...grukk.character, hp: { ...grukk.character.hp, current: 1 } };
    grukk.character = { ...grukk.character, strain: { value: 12, broken: false } };
    expect(firstAid(w, data, 'npc-0', 'm-1')).toEqual({
      ok: false,
      reason: "Grukk can't take any more strain.",
    });
    expect(firstAid(w, data, 'npc-0', 'npc-1')).toEqual({ ok: false, reason: 'Aldo is unhurt.' });
    (w.npcs[1] as Npc).hp = 1;
    w.rng = scriptedRng([6]);
    expect(firstAid(w, data, 'npc-0', 'npc-1')).toEqual({ ok: true });
    expect(w.npcs[1]?.hp).toBe(5);
    expect(() => firstAid(w, data, 'npc-0', 'm-9')).toThrow('no living party member m-9');
    w.encounter = encounter([['thug-or-militia']]);
    expect(firstAid(w, data, 'npc-0', 'm-1')).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
  });
});

describe('NPC odds and ends', () => {
  it('meets a group holding a captive', () => {
    const w = out([1, 13, 2, 3, 4, 1, 1]);
    expect(maybeEncounter(w, data, undefined, false)).toBe(true);
    expect(w.encounter).toMatchObject({ captive: 'merchant', nature: 'hostile' });
    expect(w.encounter?.text).toContain('A bound merchant sits among them.');
  });

  it('counts fighting hirelings when intimidating, and finds guides only when able', () => {
    const w = out([4, 5, 6, 6, 1]);
    addNpc(w, data, 'hireling', 'wilderness-guide', 'peaceful-human', 'G', false);
    addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'Aldo', true);
    const fizz = member(w, 'Fizzwick');
    fizz.character = { ...fizz.character, hp: { ...fizz.character.hp, current: 0 } };
    expect(guideOf(w, data, 'npc-0')?.name).toBe('G');
    (w.npcs[0] as Npc).hp = 0;
    expect(guideOf(w, data, 'npc-0')).toBeUndefined();
    expect(guideOf(w, data, 'm-0')).toBeUndefined();
    w.encounter = encounter([Array(5).fill('thug-or-militia')]);
    expect(parley(w, data, 'talk', 'm-3')).toEqual({
      ok: false,
      reason: 'Choose someone to do the talking.',
    });
    expect(parley(w, data, 'intimidate', 'm-1')).toEqual({ ok: true });
    expect(() => removeNpc(w, 'npc-7')).toThrow('no NPC npc-7');
  });

  it('reuses names once the list runs out', () => {
    const w = out([1, 1]);
    const few = {
      ...data,
      content: { ...data.content, npcRules: { ...data.content.npcRules, names: ['Solo'] } },
    };
    expect(addNpc(w, few, 'hireling', 'guard', 'thug-or-militia', null, true)?.name).toBe('Solo');
    expect(addNpc(w, few, 'hireling', 'guard', 'thug-or-militia', null, true)?.name).toBe('Solo');
  });

  it('upgrades version 2 saves with no NPCs and a matching mood', () => {
    const w = world();
    const v2 = (e: unknown) => {
      const save = JSON.parse(serializeWorld(w));
      delete save.npcs;
      return JSON.stringify({ ...save, schemaVersion: 2, encounter: e });
    };
    const old = { enemies: [['thug-or-militia']], hostile: true, spotted: false, text: '' };
    const load = (e: unknown) => {
      const r = parseWorld(v2(e), data);
      if (!r.ok) throw new Error(r.errors.join('; '));
      return r.world;
    };
    expect(load(old).encounter).toMatchObject({
      reaction: 'unfriendly',
      nature: 'hostile',
      offer: null,
    });
    expect(load({ ...old, hostile: false }).encounter?.reaction).toBe('friendly');
    expect(load(null)).toMatchObject({ encounter: null, npcs: [] });
  });
});
