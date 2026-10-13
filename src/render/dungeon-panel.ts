// One surface of the first-person view as drawing data, and how it is shaded (docs/plan.md, Phase
// 7; docs/presentation-plan.md, V1). The view builds these in dungeon-view.ts.
import type { Breach, Detail } from './dungeon-detail.ts';
import type { Span } from './dungeon-geometry.ts';
import type { FurnitureArt } from './furniture-art.ts';
import type { TrapArt } from './trap-art.ts';

export interface Panel {
  key: string;
  kind: 'wall' | 'door' | 'dug' | 'up' | 'down' | 'trap' | 'floor' | 'ceiling' | 'furniture';
  /** SVG polygon points. */
  points: string;
  /** A door's leaf inside the panel, or null. */
  frame: string | null;
  fill: string;
  /** Stone, flagstones, or treads drawn over the panel. */
  detail: Detail;
  /** The hole torn through a dug wall, for a wall opened by magic. */
  breach: Breach | null;
  /** A known trap's plate, chalk, and marks, for a trap. */
  trap: TrapArt | null;
  /** The door leaf's fill and planks, for a door. */
  leaf: { fill: string; detail: Detail } | null;
  /** What stands on a floor cell, for furniture (furniture-art.ts). */
  furniture?: FurnitureArt;
  /**
   * How far the panel runs from the party, in view planes (0 is the party's own cell edge), and
   * the midpoints of its near and far edges, so the light can fade along it.
   */
  span: Span;
}

/**
 * Surface shading: side walls darker than walls faced head on, and a gentle step darker with
 * distance. The light's falloff (dungeon-light.ts) does the rest, so this never reaches black.
 */
export function shade(kind: Panel['kind'], depth: number, side: boolean): string {
  const light = Math.max(20, (side ? 48 : 58) - depth * 5);
  if (kind === 'trap') return `hsl(34 12% ${light - 16}%)`;
  if (kind === 'door') return `hsl(26 38% ${light - 18}%)`;
  if (kind === 'wall') return `hsl(32 10% ${light}%)`;
  if (kind === 'floor') return `hsl(30 14% ${light - 20}%)`;
  if (kind === 'ceiling') return `hsl(220 6% ${light - 32}%)`;
  return `hsl(42 30% ${light - 14}%)`;
}
