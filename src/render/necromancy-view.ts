// What a Necromancer in the party can do with the dead (Phase 14b), as data for the panel. Pure.
import type { GameData } from '../game/character/context.ts';
import { characterSheet } from '../game/character/derived.ts';
import { corpsesHere, RAISED } from '../game/world/necromancy.ts';
import type { World } from '../game/world/types.ts';

export interface CasterView {
  id: string;
  name: string;
  spellsLeft: number;
  raise: boolean;
  knight: boolean;
  command: boolean;
  /** Their hurt raised dead, which Raise Corpse makes whole. */
  mend: { id: string; name: string }[];
}

const SPELLS = ['raise-corpse', 'raise-grave-knight', 'command-the-dead'];

/** The party's living casters with a necromantic spell prepared, and the corpses here. */
export function necromancyView(
  w: World,
  data: GameData,
): { corpses: number; casters: CasterView[] } | null {
  const casters = w.members.flatMap((m): CasterView[] => {
    const magic = characterSheet(m.character, data).magic;
    const prepared = m.character.spells.prepared;
    if (m.dead || !magic || !SPELLS.some((s) => prepared.includes(s))) return [];
    const raise = prepared.includes('raise-corpse');
    return [
      {
        id: m.id,
        name: m.character.name,
        spellsLeft: Math.max(0, magic.slots.spellsCast - m.spellsCast),
        raise,
        knight: prepared.includes('raise-grave-knight'),
        command: prepared.includes('command-the-dead'),
        mend: raise
          ? w.npcs
              .filter(
                (n) =>
                  n.master === m.id &&
                  Object.values<string>(RAISED).includes(n.type) &&
                  n.hp < n.maxHp,
              )
              .map((n) => ({ id: n.id, name: n.name }))
          : [],
      },
    ];
  });
  return casters.length > 0 ? { corpses: corpsesHere(w).length, casters } : null;
}
