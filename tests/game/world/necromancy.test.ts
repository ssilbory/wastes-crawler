import { describe, expect, it } from 'vitest';
import { applyBattle, type WorldBattle } from '../../../src/game/world/fight.ts';
import { firstAid } from '../../../src/game/world/first-aid.ts';
import { dismiss } from '../../../src/game/world/hire.ts';
import {
  commandTheDead,
  corpsesHere,
  leaveCorpses,
  mendCorpse,
  placeKey,
  raiseCorpse,
  raiseGraveKnight,
} from '../../../src/game/world/necromancy.ts';
import { fights, nightForNpcs, npcMonster } from '../../../src/game/world/npcs.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { below } from '../dungeon/helpers.ts';
import { data, encounter, member, world } from './helpers.ts';

/** Fizzwick as a level-`level` Necromancer with the three necromantic spells prepared. */
function necromancer(w: World, level = 3): Member {
  const m = member(w, 'Fizzwick');
  m.character = {
    ...m.character,
    classes: { current: 'full-necromancer', levels: { 'full-necromancer': level } },
    spells: {
      known: ['raise-corpse', 'command-the-dead', 'raise-grave-knight'],
      prepared: ['raise-corpse', 'command-the-dead', 'raise-grave-knight'],
    },
    arts: ['bonetalker'],
  };
  return m;
}

const fail = (reason: string) => ({ ok: false, reason });

describe('corpses (Phase 14b)', () => {
  it('lie where a fight was won, if they were ever alive', () => {
    const w = world();
    expect(placeKey(w)).toBe('borderlands/3,8');
    leaveCorpses(w, data, [['thug-or-militia', 'automaton-humanlike'], ['veteran-soldier']]);
    expect(w.corpses).toEqual({ at: 'borderlands/3,8', hitDice: [1, 1], day: 0, queried: false });
    w.day = 2;
    (w.corpses as NonNullable<typeof w.corpses>).queried = true;
    leaveCorpses(w, data, [['thug-or-militia']]);
    // Fresh dead can be questioned, and the pile is dated to the latest.
    expect(w.corpses).toMatchObject({ day: 2, queried: false });
    expect(corpsesHere(w)).toEqual([1, 1, 1]);
    leaveCorpses(w, data, [['automaton-humanlike']]);
    expect(corpsesHere(w)).toHaveLength(3);
    w.position = { col: 4, row: 8 };
    expect(corpsesHere(w)).toEqual([]);
    leaveCorpses(w, data, [['thug-or-militia']]);
    expect(w.corpses).toEqual({ at: 'borderlands/4,8', hitDice: [1], day: 2, queried: false });
    const d = below();
    expect(placeKey(d)).toMatch(/^old-barrow\/barrow-upper\/\d+,\d+$/);
  });

  it('are left by a won battle', () => {
    const w = world();
    w.encounter = encounter([['thug-or-militia']]);
    const fight = {
      battle: { combatants: [] } as never,
      setup: null as never,
      memberIds: [],
      npcIds: [],
      mountIds: [],
      enemies: [['thug-or-militia']],
      captive: null,
      quest: null,
      garrison: null,
      patrol: null,
    } satisfies WorldBattle;
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'party', rounds: 1, deaths: 0, battle: null as never },
      null,
    );
    expect(corpsesHere(w)).toEqual([1]);
  });
});

describe('Raise Corpse (4.6.0)', () => {
  it('raises a zombie or a skeleton into an NPC slot, a spell each', () => {
    const w = world();
    const m = necromancer(w, 5);
    w.rng = createRng('raise');
    expect(raiseCorpse(w, data, m.id, 'zombie')).toEqual(fail('There are no corpses here.'));
    leaveCorpses(w, data, [['thug-or-militia', 'thug-or-militia', 'thug-or-militia']]);
    expect(raiseCorpse(w, data, m.id, 'zombie')).toEqual({ ok: true });
    expect(raiseCorpse(w, data, m.id, 'skeleton')).toEqual({ ok: true });
    expect(w.npcs.map((n) => [n.kind, n.type, n.name, n.master])).toEqual([
      ['undead', 'raised-zombie', 'Raised Zombie', m.id],
      ['undead', 'raised-skeleton', 'Raised Skeleton', m.id],
    ]);
    expect(w.log.at(-1)).toContain('Fizzwick raises a corpse; Raised Skeleton stands.');
    expect(m.spellsCast).toBe(2);
    expect(corpsesHere(w)).toEqual([1]);
    leaveCorpses(w, data, [['thug-or-militia']]);
    // A second of a kind is numbered.
    w.npcs = w.npcs.slice(0, 1);
    m.spellsCast = 0;
    expect(raiseCorpse(w, data, m.id, 'zombie')).toEqual({ ok: true });
    expect(w.npcs[1]?.name).toBe('Raised Zombie 2');
    // Both NPC slots are full.
    expect(raiseCorpse(w, data, m.id, 'zombie')).toEqual(fail('There is no room in the party.'));
    expect(fights(data, w.npcs[0] as never)).toBe(true);
    expect(npcMonster(data, w.npcs[0] as never).id).toBe('raised-zombie');
  });

  it('keeps to the caster level, the day, armor, and who has the spell', () => {
    const w = world();
    const m = necromancer(w, 1);
    leaveCorpses(w, data, [['thug-or-militia', 'thug-or-militia']]);
    w.rng = createRng('cap');
    // Raise Corpse is a second-level spell: castable from level 3.
    expect(raiseCorpse(w, data, m.id, 'zombie')).toEqual(
      fail("Fizzwick can't cast level-2 spells yet."),
    );
    necromancer(w, 3);
    for (let i = 0; i < 3; i++)
      w.npcs.push({ ...npcBase(), id: `npc-${i}`, type: 'raised-zombie', master: m.id });
    expect(raiseCorpse(w, data, m.id, 'zombie')).toEqual(
      fail('Fizzwick can keep no more raised dead.'),
    );
    const v = world();
    const n = necromancer(v);
    leaveCorpses(v, data, [['thug-or-militia']]);
    n.spellsCast = 2;
    expect(raiseCorpse(v, data, n.id, 'zombie')).toEqual(
      fail('Fizzwick has no spells left today.'),
    );
    n.spellsCast = 0;
    n.character = {
      ...n.character,
      inventory: [...n.character.inventory, { id: 'mail-shirt', quantity: 1, location: 'worn' }],
    };
    expect(raiseCorpse(v, data, n.id, 'zombie')).toEqual(
      fail("Fizzwick can't cast in armor or with a shield."),
    );
    expect(raiseCorpse(v, data, member(v, 'Snag').id, 'zombie')).toEqual(
      fail("Snag hasn't prepared Raise Corpse."),
    );
    expect(raiseCorpse(v, data, 'nobody', 'zombie')).toEqual(fail('No one is able to cast that.'));
    n.dead = true;
    expect(raiseCorpse(v, data, n.id, 'zombie')).toEqual(fail('No one is able to cast that.'));
  });

  it('mends its own raised dead, which never heal otherwise', () => {
    const w = world();
    const m = necromancer(w, 5);
    leaveCorpses(w, data, [['thug-or-militia']]);
    w.rng = createRng('mend');
    raiseCorpse(w, data, m.id, 'zombie');
    const z = w.npcs[0] as World['npcs'][number];
    expect(mendCorpse(w, data, m.id, z.id)).toEqual(fail('Raised Zombie is whole.'));
    z.maxHp = 8;
    z.hp = 1;
    nightForNpcs(w, data, true);
    expect(z.hp).toBe(1);
    const lirael = member(w, 'Lirael');
    lirael.character = {
      ...lirael.character,
      inventory: [
        ...lirael.character.inventory,
        { id: 'healers-pouch', quantity: 1, location: 'readied' },
      ],
    };
    expect(firstAid(w, data, lirael.id, z.id)).toEqual(
      fail('Bandages do nothing for Raised Zombie.'),
    );
    expect(mendCorpse(w, data, m.id, z.id)).toEqual({ ok: true });
    expect(z.hp).toBe(8);
    expect(mendCorpse(w, data, m.id, 'npc-9')).toEqual(
      fail('That is not one of their raised dead.'),
    );
    expect(mendCorpse(w, data, member(w, 'Snag').id, z.id)).toEqual(
      fail("Snag hasn't prepared Raise Corpse."),
    );
    expect(dismiss(w, data, z.id)).toEqual({ ok: true });
    expect(w.log.at(-1)).toContain('Raised Zombie is released and falls still.');
  });
});

describe('Raise Grave Knight (4.6.0)', () => {
  it('needs a corpse of 4 hit dice, keeps one knight, and restores it at dusk', () => {
    const w = world();
    const m = necromancer(w, 7);
    w.rng = createRng('knight');
    leaveCorpses(w, data, [['thug-or-militia']]);
    expect(raiseGraveKnight(w, data, m.id)).toEqual(
      fail('There is no corpse of 4 hit dice or more here.'),
    );
    leaveCorpses(w, data, [['knight-or-minor-hero', 'knight-or-minor-hero']]);
    expect(raiseGraveKnight(w, data, m.id)).toEqual({ ok: true });
    expect(corpsesHere(w)).toEqual([1, 4]);
    expect(raiseGraveKnight(w, data, m.id)).toEqual(fail('Fizzwick already has a Grave Knight.'));
    const knight = w.npcs[0] as World['npcs'][number];
    knight.hp = 1;
    nightForNpcs(w, data, false);
    expect(knight.hp).toBe(knight.maxHp);
    // Another caster's knight takes the last slot.
    w.npcs.push({ ...knight, id: 'npc-1', master: 'someone' });
    knight.type = 'raised-zombie';
    expect(raiseGraveKnight(w, data, m.id)).toEqual(fail('There is no room in the party.'));
    expect(raiseGraveKnight(w, data, member(w, 'Snag').id)).toEqual(
      fail("Snag hasn't prepared Raise Grave Knight."),
    );
  });
});

describe('Command the Dead (4.6.0)', () => {
  it('binds undead within twice the caster level in hit dice that fail their saves', () => {
    const w = world();
    const m = necromancer(w, 1);
    expect(commandTheDead(w, data, m.id)).toEqual(fail('There are no undead here to command.'));
    expect(commandTheDead(w, data, member(w, 'Snag').id)).toEqual(
      fail("Snag hasn't prepared Command the Dead."),
    );
    w.encounter = encounter([['thug-or-militia']]);
    expect(commandTheDead(w, data, m.id)).toEqual(fail('There are no undead here to command.'));
    // Two zombies of 2 HD: the first fails its save (2) and is bound; the budget of 2 is spent,
    // so the second only stands dazed.
    w.encounter = encounter([['zombie', 'zombie'], ['thug-or-militia']]);
    w.rng = scriptedRng([2, 1, 1]);
    expect(commandTheDead(w, data, m.id)).toEqual({ ok: true });
    expect(w.encounter?.enemies).toEqual([['zombie'], ['thug-or-militia']]);
    expect(w.npcs.map((n) => [n.type, n.name, n.master])).toEqual([['zombie', 'Zombie', m.id]]);
    expect(w.log.at(-1)).toContain('Zombie bows to Fizzwick.');
    expect(m.spellsCast).toBe(1);
  });

  it('lays the undead to rest, binding none, for a Priest of the Lady (Phase 16)', () => {
    const w = world();
    const m = necromancer(w, 1);
    m.character = {
      ...m.character,
      classes: { current: 'healer-partial-mage', levels: { 'healer-partial-mage': 1 } },
    };
    // A servant held from before doesn't shrink the budget: twice level 1 is 2 hit dice.
    w.npcs.push({ ...npcBase(), id: 'npc-0', type: 'zombie', master: m.id });
    w.encounter = encounter([['zombie', 'zombie']]);
    w.rng = scriptedRng([2, 2]);
    expect(commandTheDead(w, data, m.id)).toEqual({ ok: true });
    expect(w.encounter?.enemies).toEqual([['zombie']]);
    expect(w.npcs).toHaveLength(1);
    expect(w.log.at(-1)).toContain("Zombie is laid to rest in the Lady's embrace.");
  });

  it('lets the strong resist, releases the bound without room, and ends an emptied encounter', () => {
    const w = world();
    const m = necromancer(w, 5);
    w.encounter = encounter([['zombie', 'zombie', 'zombie']]);
    w.npcs.push(
      { ...npcBase(), id: 'npc-0', type: 'zombie', master: m.id },
      { ...npcBase(), id: 'npc-1', type: 'raised-zombie', master: m.id },
    );
    // Budget 10 less the bound zombie's 2: the first saves (20), the next two fail.
    w.rng = scriptedRng([20, 2, 2]);
    commandTheDead(w, data, m.id);
    expect(w.encounter?.enemies).toEqual([['zombie']]);
    expect(w.log.at(-1)).toContain('A bound Zombie is released for want of room');
    w.rng = scriptedRng([2]);
    m.spellsCast = 0;
    // Without a Magic skill, no penalty.
    const skills = { ...m.character.skills };
    delete skills.magic;
    m.character = { ...m.character, skills };
    commandTheDead(w, data, m.id);
    expect(w.encounter).toBeNull();
    expect(w.log.at(-1)).toContain('No foe is left standing against the party.');
  });
});

function npcBase() {
  return {
    kind: 'undead' as const,
    name: 'Zombie',
    hp: 5,
    maxHp: 5,
    row: 1,
    column: 2,
    quitting: false,
    inventory: [],
    owed: 0,
    refund: 0,
  };
}

describe('undead servants in the party', () => {
  it('fight, and are no hireling of the morale or share rules', () => {
    const w = world();
    w.npcs.push({ ...npcBase(), id: 'npc-0', type: 'raised-skeleton', master: 'm-3' });
    expect(fights(data, w.npcs[0] as never)).toBe(true);
    expect(npcMonster(data, w.npcs[0] as never).ac).toBe(14);
  });
});
