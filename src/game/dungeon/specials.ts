// Special squares (docs/rules-adaptation.md, Dungeon exploration): messages, teleporters,
// spinners, anti-map, darkness, and anti-magic, keyed by cell in the level's content; and clues that
// teach a standing order's countersign (Phase 12b), whole or in pieces (Sam's call: the Warden's).
import type { Special } from '../../data/schemas/index.ts';
import { FACINGS, type Facing } from '../../rules/grid.ts';
import type { GameData } from '../character/context.ts';
import { alive, note } from '../world/members.ts';
import { findNotes } from '../world/notes.ts';
import { gainAuthority, learnCountersign } from '../world/orders.ts';
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
  // Every plain message on a square shows together, the first time only. A people-gated message
  // keeps a read record of its own, and waits, unread, until someone of that people is in the party.
  const key = `${s.at.x},${s.at.y}`;
  const read = s.read[s.level] ?? [];
  const markRead = (id: string) => {
    const now = s.read[s.level] ?? [];
    if (!now.includes(id)) s.read[s.level] = [...now, id];
  };
  for (const sp of specialsHere(w, data)) {
    if (sp.kind === 'message') {
      const id = sp.people ? `${key}:${sp.people.join('+')}` : key;
      if (read.includes(id)) continue;
      const reader = sp.people
        ? alive(w).find((m) => sp.people?.includes(m.character.people))
        : null;
      if (reader === undefined) continue;
      note(w, sp.text.replaceAll('{pc}', reader?.character.name ?? ''));
      markRead(id);
    } else if (sp.kind === 'notes') {
      findNotes(w, data, sp.set, sp.text);
    } else if (sp.kind === 'token') {
      if (w.authority.includes(sp.authority)) continue;
      note(w, sp.text);
      gainAuthority(w, data, sp.authority);
    } else if (sp.kind === 'countersign') {
      if (w.countersigns.includes(sp.order)) continue;
      if (sp.pieces) {
        const piece = `${sp.order}:${s.dungeon}/${s.level}/${key}`;
        if (w.pieces.includes(piece)) continue;
        w.pieces.push(piece);
        note(w, sp.text);
        const found = w.pieces.filter((p) => p.startsWith(`${sp.order}:`)).length;
        if (found < sp.pieces) {
          note(w, `The party has ${found} of ${sp.pieces} pieces of a countersign.`);
          continue;
        }
      } else note(w, sp.text);
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
