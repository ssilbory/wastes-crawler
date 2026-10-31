// What a Necromancer in the party can do with the dead (Phase 14b), as data for the panel. Pure.
import type { GameData } from '../game/character/context.ts';
import { characterSheet } from '../game/character/derived.ts';
import { BONESHAPER } from '../game/world/boneshaper.ts';
import { castLevel, spellReady } from '../game/world/casting.ts';
import { corpsesHere, RAISED } from '../game/world/necromancy.ts';
import {
  cannotQuery,
  QUERY_THE_SKULL,
  skullQuestions,
  type SkullQuestion,
} from '../game/world/skull.ts';
import type { World } from '../game/world/types.ts';
import { castsLeftFor } from './casting-view.ts';

export interface CasterView {
  id: string;
  name: string;
  /** "3 spells left today", or with spell points. */
  left: string;
  raise: boolean;
  knight: boolean;
  command: boolean;
  /** Their hurt raised dead, which Raise Corpse makes whole. */
  mend: { id: string; name: string }[];
  /** Query the Skull: the questions open here and how many they may ask, or why not. */
  query: { questions: SkullQuestion[]; ask: number; bar: string | null } | null;
  /** Boneshaper is prepared. */
  shape: boolean;
  /** Members they have shaped, which they can lift. */
  shaped: { id: string; name: string; changes: string }[];
}

const SPELLS = [
  'raise-corpse',
  'raise-grave-knight',
  'command-the-dead',
  QUERY_THE_SKULL,
  BONESHAPER,
];

/** "+1 STR, −1 CHA". */
const changeText = (changes: Record<string, number>) =>
  Object.entries(changes)
    .map(([a, n]) => `${n > 0 ? '+' : '−'}${Math.abs(n)} ${a.toUpperCase()}`)
    .join(', ');

/** The party's living casters with a necromantic spell prepared, and the corpses here. */
export function necromancyView(
  w: World,
  data: GameData,
): { corpses: number; casters: CasterView[] } | null {
  const casters = w.members.flatMap((m): CasterView[] => {
    const magic = characterSheet(m.character, data).magic;
    const ready = (spell: string) => spellReady(m, spell);
    const shaped = w.members.flatMap((t) =>
      t.character.shaped?.by === m.character.id
        ? [{ id: t.id, name: t.character.name, changes: changeText(t.character.shaped.changes) }]
        : [],
    );
    // A spell read from a scroll is a member's to cast without magic of their own (Phase 21).
    if (m.dead || (!magic && !m.unrolled)) return [];
    if (!SPELLS.some(ready) && shaped.length === 0) return [];
    const raise = ready('raise-corpse');
    return [
      {
        id: m.id,
        name: m.character.name,
        left: castsLeftFor(m, magic),
        raise,
        knight: ready('raise-grave-knight'),
        command: ready('command-the-dead'),
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
        query: ready(QUERY_THE_SKULL)
          ? {
              questions: skullQuestions(w),
              ask: castLevel(m, QUERY_THE_SKULL),
              bar: cannotQuery(w, m),
            }
          : null,
        shape: ready(BONESHAPER),
        shaped,
      },
    ];
  });
  return casters.length > 0 ? { corpses: corpsesHere(w).length, casters } : null;
}
