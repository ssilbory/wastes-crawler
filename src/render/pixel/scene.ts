// The pixel view's scene (docs/presentation-plan.md, V8): the same panels the vector view draws,
// laid into one frame far to near, surfaces textured and what stands among them as sprites, then a
// pending encounter's foes in front of all. shade.ts lights it.
import type { Panel } from '../dungeon-panel.ts';
import type { PortraitFigure } from '../encounter-portrait.ts';
import { drawSurface, newFrame, type Frame } from './frame.ts';
import {
  drawSprite,
  foeSprite,
  furnitureSprite,
  occupantSprites,
  trapSprite,
  type Rasterize,
} from './sprites.ts';

export function renderScene(
  panels: readonly Panel[],
  foes: readonly PortraitFigure[],
  raster: Rasterize,
): Frame {
  const f = newFrame();
  for (const p of panels) {
    if (p.furniture) drawSprite(f, furnitureSprite(p, f), raster);
    else if (p.occupant) for (const s of occupantSprites(p, f)) drawSprite(f, s, raster);
    else {
      drawSurface(f, p);
      if (p.trap) drawSprite(f, trapSprite(p, f), raster);
    }
  }
  for (const foe of foes) drawSprite(f, foeSprite(foe, f), raster);
  return f;
}
