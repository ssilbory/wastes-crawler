// Read-only drawing data for the light in the first-person view (docs/presentation-plan.md, V1).
// The light itself is game state (src/game/dungeon/light.ts); this only says how it looks: its
// tint, how many cells deep it reaches, and whether it flickers. A light's reach follows its
// resource die, so a torch that has stepped down to d4 lights less of the corridor.
import { blind, faithLit, inDark } from '../game/dungeon/light.ts';
import type { GameData } from '../game/character/context.ts';
import type { World } from '../game/world/types.ts';

export type LightSource = 'torch' | 'lantern' | 'faith' | 'sight';

export interface LightView {
  source: LightSource;
  /** The colour the light casts. */
  tint: string;
  /** How strongly it tints, from 0 to 1. */
  tintOpacity: number;
  /** Cells ahead before the dark closes in; the view draws four. */
  reach: number;
  flicker: boolean;
}

const LOOKS: Record<LightSource, Pick<LightView, 'tint' | 'tintOpacity' | 'flicker'>> = {
  torch: { tint: '#ff8a2a', tintOpacity: 0.45, flicker: true },
  lantern: { tint: '#ffc066', tintOpacity: 0.35, flicker: false },
  faith: { tint: '#fff1b8', tintOpacity: 0.3, flicker: false },
  sight: { tint: '#7f93b0', tintOpacity: 0.55, flicker: false },
};

/** Cells a burning light reaches by its die: a fresh lantern four, a guttering torch two. */
export const dieReach = (die: number) => 1 + die / 4;

const look = (source: LightSource, reach: number): LightView => ({
  source,
  ...LOOKS[source],
  reach,
});

/** The most the dark hides: a wall just past the light is a shape, not nothing. */
export const MAX_DARK = 0.94;

/**
 * How dark a surface k view planes from the party is, from 0 (fully lit) to MAX_DARK: clear over
 * the nearer half of the light's reach, fading to the most a cell past it.
 */
export function darkness(light: LightView, k: number): number {
  const clear = light.reach / 2;
  const t = (k - clear) / (light.reach + 1 - clear);
  return MAX_DARK * Math.min(1, Math.max(0, t));
}

/** How the party's light looks, or null when there is nothing to see. */
export function lightView(w: World, data: GameData): LightView | null {
  if (!w.dungeon || blind(w, data)) return null;
  // Seeing without light (Phase 15 arts and Apprehending the Arcane Form): cold and short.
  if (inDark(w, data)) return look('sight', 2);
  if (faithLit(w, data)) return look('faith', 3.5);
  const lit = w.light.lit as 'torch' | 'lantern';
  return look(lit, dieReach(w.light[lit]));
}

/** The light for the level editor's test walk: a fresh torch. */
export const walkLight = (): LightView => look('torch', dieReach(6));
