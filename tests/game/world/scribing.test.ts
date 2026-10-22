import { describe, expect, it } from 'vitest';
import { importCharacter, exportCharacter } from '../../../src/game/character/io.ts';
import {
  entryPrice,
  findItem,
  lineLabel,
  type CatalogItem,
} from '../../../src/game/character/items.ts';
import { putLine } from '../../../src/game/character/stacks.ts';
import { craftShift, workOn } from '../../../src/game/world/crafting.ts';
import { checkBonus } from '../../../src/game/world/members.ts';
import {
  canScribe,
  scribable,
  scribeDifficulty,
  scribesOf,
  scrollListed,
  startScroll,
} from '../../../src/game/world/scribing.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { projectText } from '../../../src/render/crafting-view.ts';
import { data, encounter, member, world } from './helpers.ts';

const COFFIN = 'the-coruscating-coffin';
const learn = (m: Member) => {
  m.character = { ...m.character, skills: { ...m.character.skills, scribing: 1 } };
};
const scrolls = (m: Member) => m.character.inventory.filter((e) => e.id === 'scroll');

function scribe(faces: number[] = []): { w: World; fizz: Member } {
  const w = world(faces);
  w.purse = 100;
  const fizz = member(w, 'Fizzwick');
  learn(fizz);
  return { w, fizz };
}

describe('writing scrolls (docs/rules-adaptation.md, Scrolls; SRD 4.9.1)', () => {
  it('fits only spells cast at a target in a fight, and only those the scribe knows', () => {
    const ids = scribable(data).map((s) => s.id);
    expect(ids).toContain(COFFIN);
    expect(ids).not.toContain('prudentially-transient-abnegation-of-life');
    expect(ids).not.toContain('the-excellent-transpicuous-transformation');
    const { w, fizz } = scribe();
    expect(canScribe(data, fizz)).toBe(true);
    expect(
      scribesOf(data, fizz)
        .map((s) => s.id)
        .sort(),
    ).toEqual(fizz.character.spells.known.filter((id) => ids.includes(id)).sort());
    expect(scribesOf(data, member(w, 'Snag'))).toEqual([]);
  });

  it('costs 20 crowns a spell level, against 7 plus half the level rounded up', () => {
    expect(scrollListed(data, COFFIN)).toBe(20);
    expect(scribeDifficulty(data, COFFIN)).toBe(8);
    expect(scrollListed(data, 'deluge-of-hell')).toBe(100);
    expect(scribeDifficulty(data, 'deluge-of-hell')).toBe(10);
    expect(() => scrollListed(data, 'the-excellent-transpicuous-transformation')).toThrow();
  });

  it('starts a week’s work, paid now, and refuses what can’t be done', () => {
    const { w, fizz } = scribe();
    const snag = member(w, 'Snag');
    expect(startScroll(w, data, snag.id, COFFIN)).toEqual({
      ok: false,
      reason: 'Snag has no Scribing skill.',
    });
    expect(startScroll(w, data, fizz.id, 'deluge-of-hell')).toEqual({
      ok: false,
      reason: "Fizzwick doesn't know Deluge of Hell.",
    });
    expect(startScroll(w, data, fizz.id, COFFIN)).toEqual({ ok: true });
    expect(w.purse).toBe(80);
    const p = w.projects[0] as World['projects'][number];
    expect(p).toEqual(expect.objectContaining({ kind: 'scribe', spell: COFFIN, daysLeft: 7 }));
    expect(projectText(w, data, p)).toBe(
      'Fizzwick: writing a scroll of The Coruscating Coffin, 7 days left',
    );
    expect(startScroll(w, data, fizz.id, COFFIN)).toEqual({
      ok: false,
      reason: 'Fizzwick is already making something.',
    });
    expect(() => startScroll(w, data, 'nobody', COFFIN)).toThrow();
    w.projects = [];
    w.purse = 0;
    expect(startScroll(w, data, fizz.id, COFFIN).ok).toBe(false);
    w.encounter = encounter([['thug-or-militia']]);
    expect(startScroll(w, data, fizz.id, COFFIN)).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
  });

  it('rolls Int/Scribing when done: a scroll at the scribe’s caster level, or the inks lost', () => {
    const { w, fizz } = scribe([6, 6, 1, 1]);
    startScroll(w, data, fizz.id, COFFIN);
    workOn(w, data, w.projects[0] as World['projects'][number], 7);
    expect(scrolls(fizz)).toEqual([
      { id: 'scroll', quantity: 1, location: 'stowed', spell: COFFIN, casterLevel: 1 },
    ]);
    expect(w.log.at(-1)).toContain('Fizzwick finishes a scroll of The Coruscating Coffin.');
    startScroll(w, data, fizz.id, COFFIN);
    workOn(w, data, w.projects[0] as World['projects'][number], 7);
    expect(scrolls(fizz)[0]?.quantity).toBe(1);
    expect(w.log.at(-1)).toContain('blots and burns');
  });

  it('gives +1 for another scribe in the party', () => {
    const { fizz } = scribe();
    const dice = scribeDifficulty(data, COFFIN) - 1 - checkBonus(data, fizz, 'scribing', ['int']);
    const faces = [Math.ceil(dice / 2), Math.floor(dice / 2)];
    const writes = (help: boolean) => {
      const { w, fizz: f } = scribe(faces);
      if (help) learn(member(w, 'Lirael'));
      startScroll(w, data, f.id, COFFIN);
      workOn(w, data, w.projects[0] as World['projects'][number], 7);
      return scrolls(f).length;
    };
    expect(writes(false)).toBe(0);
    expect(writes(true)).toBe(1);
  });

  it('goes on in camp shifts with crafting tools', () => {
    const { w, fizz } = scribe();
    startScroll(w, data, fizz.id, COFFIN);
    fizz.character = {
      ...fizz.character,
      inventory: [
        ...fizz.character.inventory,
        { id: data.content.craftingRules.tools.id, quantity: 1, location: 'stowed' },
      ],
    };
    w.position = { col: 3, row: 3 };
    craftShift(w, data, fizz);
    expect(w.log.at(-1)).toContain('Fizzwick works on a scroll of The Coruscating Coffin.');
  });
});

describe('scrolls as items', () => {
  const line = {
    id: 'scroll',
    quantity: 2,
    location: 'stowed' as const,
    spell: COFFIN,
    casterLevel: 3,
  };

  it('are named for their spell, worth 20 crowns a level, and kept apart by spell and level', () => {
    const item = findItem(data, 'scroll') as CatalogItem;
    expect(item.kind).toBe('scroll');
    expect(lineLabel(data, line)).toBe('Scroll of The Coruscating Coffin (caster level 3)');
    expect(entryPrice(data, item, line)).toBe(400);
    expect(entryPrice(data, item, { ...line, spell: 'deluge-of-hell', quantity: 1 })).toBe(1000);
    const one = putLine([line], { ...line, quantity: 1, casterLevel: 4 });
    expect(one).toHaveLength(2);
    expect(putLine([line], { ...line, quantity: 1 })).toEqual([{ ...line, quantity: 3 }]);
  });

  it('load only with a known spell and caster level, and nothing else holds a spell', () => {
    const { w } = scribe();
    const c = member(w, 'Snag').character;
    const load = (inventory: unknown[]) =>
      importCharacter(exportCharacter({ ...c, inventory } as typeof c), data);
    expect(load([line]).ok).toBe(true);
    const bad = load([
      { ...line, spell: 'nonsense' },
      { id: 'scroll', quantity: 1, location: 'stowed' },
      { id: 'dagger', quantity: 1, location: 'stowed', spell: COFFIN },
      { id: 'dagger', quantity: 1, location: 'stowed', casterLevel: 2 },
    ]);
    expect(bad.ok ? [] : bad.errors).toEqual([
      'inventory: a scroll needs one known spell and a caster level',
      'inventory: a scroll needs one known spell and a caster level',
      "inventory: dagger can't hold a spell",
      "inventory: dagger can't hold a spell",
    ]);
  });
});
