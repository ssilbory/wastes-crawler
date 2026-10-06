import { describe, expect, it } from 'vitest';
import type { Character } from '../../src/data/schemas/index.ts';
import { gameSpells } from '../../src/data/spells.ts';
import { levelSummary } from '../../src/render/level-view.ts';
import { data, starter } from '../game/combat/helpers.ts';

/** The character one level on in their current class, with these other changes. */
function levelled(c: Character, more: Partial<Character>): Character {
  const id = c.classes.current;
  return {
    ...c,
    classes: {
      ...c.classes,
      levels: { ...c.classes.levels, [id]: (c.classes.levels[id] ?? 0) + 1 },
    },
    hp: { max: c.hp.max + 4, current: c.hp.current + 4 },
    ...more,
  };
}

describe('the level-up summary', () => {
  it('lists what the level brought', () => {
    const fizz = starter('fizzwick');
    const art = data.srd.arts.find((a) => a.tradition === 'high-mage' && !fizz.arts.includes(a.id));
    const spell = gameSpells(data.srd, data.content).find(
      (s) => s.tradition === 'high-magic' && !fizz.spells.known.includes(s.id),
    );
    if (!art || !spell) throw new Error('nothing new to learn');
    const after = levelled(fizz, {
      skills: { ...fizz.skills, magic: 1 },
      foci: [...fizz.foci, { id: 'alert', level: 1 }],
      arts: [...fizz.arts, art.id],
      spells: { ...fizz.spells, known: [...fizz.spells.known, spell.id] },
      advancement: { ...fizz.advancement, skillPoints: fizz.advancement.skillPoints + 3 },
    });
    const lines = levelSummary(data, fizz, after);
    expect(lines.slice(0, 2)).toEqual([
      'Fizzwick reaches level 2 (High Mage 2).',
      `Hit points ${fizz.hp.max} → ${fizz.hp.max + 4} (+4).`,
    ]);
    expect(lines).toContain('3 skill points to spend.');
    expect(lines).toContain('Skills: Magic-1.');
    expect(lines).toContain('Foci: Alert 1.');
    expect(lines).toContain(`Arts: ${art.name}.`);
    expect(lines).toContain(`Spells: ${spell.name}.`);
    expect(lines.some((l) => l.startsWith('Saves: '))).toBe(true);
    // A warrior's attack bonus climbs too.
    const snag = starter('snag');
    expect(levelSummary(data, snag, levelled(snag, {}))).toContain('Attack bonus +1 → +2.');
    // With nothing changed there is only the headline.
    expect(levelSummary(data, snag, snag)).toHaveLength(2);
  });
});
