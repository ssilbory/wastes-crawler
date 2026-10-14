// How a focus reads where a player picks one, on level up or as an owed pick: its name and the
// level the character already has in it, so a second pick is plain to see (vendor/wwn-srd/1.0
// Character Creation/1.6.0 Foci.md: taking a focus again raises it to level 2).
import type { Attribute, Character } from '../data/schemas/index.ts';
import type { FocusInfo } from '../game/character/foci.ts';

/**
 * "Die Hard", "Die Hard (level 1 now)", or "Die Hard (level 2, the most)". A focus taken once per
 * attribute, like Developed Attribute, names the attributes it already has.
 */
export function focusLabel(
  c: Character,
  f: Pick<FocusInfo, 'id' | 'name' | 'levels' | 'attributeChoice'>,
  attributeNames: Record<Attribute, string>,
): string {
  const held = c.foci.filter((h) => h.id === f.id);
  if (held.length === 0) return f.name;
  if (f.attributeChoice) {
    const on = held.map((h) => (h.attribute ? attributeNames[h.attribute] : '?')).join(', ');
    return `${f.name} (has ${on})`;
  }
  const level = Math.max(...held.map((h) => h.level));
  return level >= f.levels.length
    ? `${f.name} (level ${level}, the most)`
    : `${f.name} (level ${level} now)`;
}
