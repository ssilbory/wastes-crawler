// Fire that lights the dungeon by itself (Sam's ask; docs/presentation-plan.md, V8): a brazier, or
// an altar's candles, lights its own square and fades out over the squares around it, whatever
// the party carries. Seen from afar it shows dimly: its light ignores the reach of the party's
// torch but fades with distance from the party. Presentation only: no rule reads it, and a party
// without light of its own still sees nothing (docs/rules-adaptation.md, Dungeon exploration).
import { VIEW_HEIGHT, VIEW_WIDTH } from './dungeon-geometry.ts';
import type { Panel } from './dungeon-panel.ts';

/** A piece of furniture that burns, in the cell it stands in. */
export interface Lamp {
  depth: number;
  lateral: number;
  /** How strongly it lights its square, from 0 to 1. */
  strength: number;
}

/** A brazier's fire, and a pair of candles. */
const STRENGTH: Partial<Record<string, number>> = { brazier: 1, altar: 0.65 };

/** Squares from the lamp's middle that it lights fully, and where its light ends. */
const FULL = 0.5;
const REACH = 1.5;
/** How fast a lamp's light dims with its distance from the party, in view planes. */
const DIM = 0.22;

/** The lamps among the view's panels: furniture with a flame in it. */
export const lampsOf = (panels: readonly Panel[]): Lamp[] =>
  panels.flatMap((p) => {
    const f = p.furniture;
    if (!f || !f.parts.some((part) => part.tone === 'flame')) return [];
    return [{ depth: f.depth, lateral: f.lateral, strength: STRENGTH[f.kind] ?? 0.5 }];
  });

/**
 * How brightly the lamps light the point `k` view planes ahead and `lateral` cells across, from
 * 0 to 1: full in a lamp's own square, gone a square and a half from its middle, and dimmer the
 * further the lamp is from the party.
 */
export function lampLight(lamps: readonly Lamp[], k: number, lateral: number): number {
  let sum = 0;
  for (const l of lamps) {
    const d = Math.hypot(k - (l.depth + 0.5), lateral - l.lateral);
    const t = Math.min(1, Math.max(0, (REACH - d) / (REACH - FULL)));
    sum += (l.strength * t ** 1.5) / (1 + DIM * (l.depth + 0.5));
  }
  return Math.min(1, sum);
}

/** How many cells across from the middle a pixel at `x` lies, on the plane `k` ahead. */
export const lateralAt = (x: number, k: number): number =>
  ((x - VIEW_WIDTH / 2) * (k + 1)) / VIEW_WIDTH;

/** A lamp's glow for the vector view: an oval of light on the floor about it. */
export interface Glow {
  key: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  opacity: number;
}

/** The glow about each lamp in view, in view pixels. */
export function lampGlows(panels: readonly Panel[]): Glow[] {
  return panels.flatMap((p) => {
    const [lamp] = lampsOf([p]);
    const f = p.furniture;
    if (!lamp || !f) return [];
    const k = lamp.depth + 0.5;
    // A cell is as wide as the piece's box; the glow reaches a square and a half about it.
    return [
      {
        key: `glow-${p.key}`,
        cx: f.x + f.size / 2,
        cy: Math.min(VIEW_HEIGHT, f.y + f.size * 0.8),
        rx: f.size * REACH,
        ry: f.size * REACH * 0.6,
        opacity: lamp.strength / (1 + DIM * k),
      },
    ];
  });
}
