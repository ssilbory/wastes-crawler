// Special squares (docs/rules-adaptation.md, Dungeon exploration): messages, teleporters,
// spinners, anti-map, darkness, and anti-magic, keyed by cell in the level's content; and clues that
// teach a standing order's countersign (Phase 12b).
import type { Special } from '../../data/schemas/index.ts';
import { FACINGS, type Facing } from '../../rules/grid.ts';
import type { GameData } from '../character/context.ts';
import { alive, note } from '../world/members.ts';
import { learnCountersign } from '../world/orders.ts';
import type { World } from '../world/types.ts';
import { levelOf } from './explore.ts';

/** The special squares where the party stands. */
export function specialsHere(w: World, data: GameData): Special[] {
  const s = w.dungeon;
  if (!s) return [];
  return levelOf(data, s.dungeon, s.level).level.specials.filter(
    (x) => x.at.x === s.at.x && x.at.y === s.at.y,
  );
}

export const onSpecial = (w: World, data: GameData, kind: Special['kind']) =>
  specialsHere(w, data).some((x) => x.kind === kind);

/** What the square does as the party steps onto it. A teleporter's far end does nothing. */
export function arriveOn(w: World, data: GameData): void {
  const s = w.dungeon as NonNullable<World['dungeon']>;
  // Every message on a square shows together, the first time only.
  const key = `${s.at.x},${s.at.y}`;
  const read = s.read[s.level] ?? [];
  if (!read.includes(key) && specialsHere(w, data).some((x) => x.kind === 'message'))
    s.read[s.level] = [...read, key];
  for (const sp of specialsHere(w, data)) {
    if (sp.kind === 'message') {
      if (read.includes(key)) continue;
      const reader = sp.people
        ? alive(w).find((m) => sp.people?.includes(m.character.people))
        : null;
      if (reader === undefined) continue;
      note(w, sp.text.replaceAll('{pc}', reader?.character.name ?? ''));
    } else if (sp.kind === 'countersign') {
      if (w.countersigns.includes(sp.order)) continue;
      note(w, sp.text);
      learnCountersign(w, data, sp.order);
    } else if (sp.kind === 'spinner') {
      s.facing = FACINGS[w.rng.int(0, 3)] as Facing;
    } else if (sp.kind === 'teleporter') {
      note(w, 'The air twists, and the party stands somewhere else.');
      Object.assign(s, { level: sp.to.level, at: { ...sp.to.at }, facing: sp.to.facing });
      return;
    }
  }
}
