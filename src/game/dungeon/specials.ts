// Special squares (docs/rules-adaptation.md, Dungeon exploration): messages, teleporters,
// spinners, anti-map, darkness, and anti-magic, keyed by cell in the level's content.
import type { Special } from '../../data/schemas/index.ts';
import { FACINGS, type Facing } from '../../rules/grid.ts';
import type { GameData } from '../character/context.ts';
import { note } from '../world/members.ts';
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
  for (const sp of specialsHere(w, data)) {
    if (sp.kind === 'message') {
      const key = `${s.at.x},${s.at.y}`;
      const read = s.read[s.level] ?? [];
      if (read.includes(key)) continue;
      s.read[s.level] = [...read, key];
      note(w, sp.text);
    } else if (sp.kind === 'spinner') {
      s.facing = FACINGS[w.rng.int(0, 3)] as Facing;
    } else if (sp.kind === 'teleporter') {
      note(w, 'The air twists, and the party stands somewhere else.');
      Object.assign(s, { level: sp.to.level, at: { ...sp.to.at }, facing: sp.to.facing });
      return;
    }
  }
}
