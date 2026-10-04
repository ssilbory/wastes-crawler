// Captives held in dungeons (docs/rules-adaptation.md, Dungeon exploration in Phase 8c): a captive
// on an `N` cell is kept by a fixed group of guards, met when the party steps onto the cell. Beat
// them or parley them away and the captive joins as on the overland map (src/game/world/rescue.ts).
// Each rescue happens once per world.
import type { HeldCaptive } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import type { WorldEvent } from '../world/bus.ts';
import { meetGroup } from '../world/encounters.ts';
import type { World } from '../world/types.ts';
import { levelOf } from './explore.ts';

/** The world-wide key of a held captive's cell. */
const keyOf = (w: World, c: HeldCaptive) => {
  const s = w.dungeon as NonNullable<World['dungeon']>;
  return `${s.dungeon}/${s.level}/${c.at.x},${c.at.y}`;
};

/** The captive still held on the party's cell, if any. */
export function heldHere(w: World, data: GameData): HeldCaptive | undefined {
  const s = w.dungeon;
  if (!s) return undefined;
  const held = levelOf(data, s.dungeon, s.level).level.captives.find(
    (c) => c.at.x === s.at.x && c.at.y === s.at.y,
  );
  return held && !w.rescues.includes(keyOf(w, held)) ? held : undefined;
}

/** The bus listener: guards are met on their cell, and a freed captive is crossed off. */
export function rescueListener(w: World, data: GameData, e: WorldEvent): void {
  const held = heldHere(w, data);
  if (!held) return;
  if (e.kind === 'cell-entered' && !w.encounter) {
    const s = w.dungeon as NonNullable<World['dungeon']>;
    const where = `${levelOf(data, s.dungeon, s.level).level.name} ${s.at.x},${s.at.y}`;
    meetGroup(w, data, held.guards, 'hostile', held.captive, null, held.text, where);
  } else if (e.kind === 'captive-freed' && e.captive === held.captive)
    w.rescues.push(keyOf(w, held));
}
