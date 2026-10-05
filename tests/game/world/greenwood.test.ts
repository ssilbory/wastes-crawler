import { describe, expect, it } from 'vitest';
import { contentReferenceErrors } from '../../../src/data/content.ts';
import { gameSpells } from '../../../src/data/spells.ts';
import { learnableSpells } from '../../../src/game/character/magic.ts';
import { classOption } from '../../../src/game/character/class-step.ts';
import { endOfDay } from '../../../src/game/world/day.ts';
import { firstAid, healers, HEALERS_KIT } from '../../../src/game/world/first-aid.ts';
import { mendTree, treesOf, wakeTree } from '../../../src/game/world/greenwood.ts';
import { dismiss } from '../../../src/game/world/hire.ts';
import { addNpc, fights, npcMonster } from '../../../src/game/world/npcs.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { greenwoodView } from '../../../src/render/greenwood-view.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, member, world } from './helpers.ts';

const TREE_SPELLS = ['rouse-the-sapling', 'call-the-elder-tree'];

/** Fizzwick as an Elementalist of `level` with both tree spells prepared. */
function druid(w: World, level = 7): Member {
  const f = member(w, 'Fizzwick');
  f.character = {
    ...f.character,
    classes: { current: 'full-elementalist', levels: { 'full-elementalist': level } },
    spells: { known: TREE_SPELLS, prepared: TREE_SPELLS },
  };
  return f;
}

describe('the Elementalist tree spells (Sam’s calls)', () => {
  it('are added spells an Elementalist can learn, and nobody else', () => {
    const names = gameSpells(data.srd, data.content).filter((s) => TREE_SPELLS.includes(s.id));
    expect(names.map((s) => [s.name, s.level])).toEqual([
      ['Rouse the Sapling', 2],
      ['Call the Elder Tree', 4],
    ]);
    const elementalist = classOption(data, 'full-elementalist')?.mage;
    const highMage = classOption(data, 'full-high-mage')?.mage;
    const ids = (m: typeof elementalist) =>
      learnableSpells(data, m as NonNullable<typeof m>, 5).map((s) => s.id);
    expect(ids(elementalist)).toEqual(expect.arrayContaining(TREE_SPELLS));
    expect(ids(highMage)).not.toContain('rouse-the-sapling');
    const clash = {
      ...data.content,
      spellRules: {
        ...data.content.spellRules,
        added: [
          ...data.content.spellRules.added,
          { ...(names[0] as (typeof names)[number]), id: 'phobic-storm' },
        ],
      },
    };
    expect(contentReferenceErrors(data.srd, clash)).toContain(
      'spellRules/added/phobic-storm: clashes with an SRD spell',
    );
  });

  it('wake saplings to the caster’s level and one elder tree, anywhere', () => {
    const w = world();
    const f = druid(w, 1);
    expect(wakeTree(w, data, f.id, 'rouse-the-sapling')).toEqual({
      ok: false,
      reason: "Fizzwick can't cast level-2 spells yet.",
    });
    druid(w, 3);
    expect(wakeTree(w, data, f.id, 'rouse-the-sapling')).toEqual({ ok: true });
    expect(w.npcs[0]).toMatchObject({ kind: 'tree', type: 'walking-sapling', master: f.id });
    expect(w.log.at(-1)).toContain('Fizzwick wakes a tree; Walking Sapling pulls its roots free.');
    expect(fights(data, w.npcs[0] as never)).toBe(true);
    expect(npcMonster(data, w.npcs[0] as never).id).toBe('walking-sapling');
    druid(w, 7);
    f.spellsCast = 0;
    expect(wakeTree(w, data, f.id, 'call-the-elder-tree')).toEqual({ ok: true });
    expect(treesOf(w, f, 'call-the-elder-tree')).toHaveLength(1);
    f.spellsCast = 0;
    expect(wakeTree(w, data, f.id, 'call-the-elder-tree')).toEqual({
      ok: false,
      reason: 'Fizzwick can wake no more of them.',
    });
    // Both NPC slots are full.
    expect(wakeTree(w, data, f.id, 'rouse-the-sapling')).toEqual({
      ok: false,
      reason: 'There is no room in the party.',
    });
    expect(wakeTree(w, data, 'nobody', 'rouse-the-sapling')).toEqual({
      ok: false,
      reason: 'No one is able to cast that.',
    });
  });

  it('mend the caster’s own hurt trees, which also root overnight', () => {
    const w = world();
    const f = druid(w, 7);
    wakeTree(w, data, f.id, 'rouse-the-sapling');
    const tree = w.npcs[0] as World['npcs'][number];
    expect(mendTree(w, data, f.id, 'rouse-the-sapling', tree.id)).toEqual({
      ok: false,
      reason: 'Walking Sapling is whole.',
    });
    tree.hp = 1;
    expect(mendTree(w, data, f.id, 'call-the-elder-tree', tree.id)).toEqual({
      ok: false,
      reason: 'That is not one of their trees.',
    });
    expect(mendTree(w, data, f.id, 'rouse-the-sapling', tree.id)).toEqual({ ok: true });
    expect(tree.hp).toBe(tree.maxHp);
    f.spellsCast = 99;
    expect(mendTree(w, data, f.id, 'rouse-the-sapling', tree.id).ok).toBe(false);
    // A night at the inn heals it by its hit dice.
    tree.hp = 1;
    w.rng = createRng('root');
    endOfDay(w, data);
    expect(tree.hp).toBe(3);
  });

  it('show in the panel, refuse bandages, and root where they are let go', () => {
    const w = world();
    expect(greenwoodView(w, data)).toEqual([]);
    const f = druid(w, 7);
    wakeTree(w, data, f.id, 'rouse-the-sapling');
    const tree = w.npcs[0] as World['npcs'][number];
    tree.hp = 2;
    expect(greenwoodView(w, data)).toEqual([
      {
        id: f.id,
        name: 'Fizzwick',
        // A 7th-level Elementalist casts four a day; one went on the sapling.
        spellsLeft: 3,
        spells: [
          { spell: 'rouse-the-sapling', mend: [{ id: tree.id, name: 'Walking Sapling' }] },
          { spell: 'call-the-elder-tree', mend: [] },
        ],
      },
    ]);
    const lirael = member(w, 'Lirael');
    lirael.character = {
      ...lirael.character,
      inventory: [
        ...lirael.character.inventory,
        { id: HEALERS_KIT, quantity: 1, location: 'stowed' },
      ],
    };
    expect(firstAid(w, data, healers(w, data)[0]?.id ?? '', tree.id)).toEqual({
      ok: false,
      reason: 'Bandages do nothing for Walking Sapling.',
    });
    expect(dismiss(w, data, tree.id)).toEqual({ ok: true });
    expect(w.log.at(-1)).toContain('Walking Sapling is let go and roots where it stands.');
    addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', null, true);
    f.dead = true;
    expect(greenwoodView(w, data)).toEqual([]);
  });
});
