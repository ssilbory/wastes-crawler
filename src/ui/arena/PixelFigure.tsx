import { useLayoutEffect, useRef } from 'preact/hooks';
import type { FigureView } from '../../render/figure-view.ts';
import {
  PORTRAIT,
  portraitFrame,
  portraitRGBA,
  type FieldSide,
} from '../../render/pixel/portrait.ts';
import { rasterize } from '../world/pixel-raster.ts';

/** Portraits already drawn, by figure, pose, and side: a fight redraws its field on every turn. */
const drawn = new Map<string, Uint8ClampedArray<ArrayBuffer>>();

function pixelsOf(figure: FigureView, down: boolean, side: FieldSide) {
  const key = JSON.stringify([figure, down, side]);
  let px = drawn.get(key);
  if (!px) {
    px = portraitRGBA(portraitFrame(figure, down, side, rasterize));
    if (drawn.size > 500) drawn.clear();
    drawn.set(key, px);
  }
  return px;
}

/**
 * A combatant's silhouette as pixel art (docs/presentation-plan.md, V8): a 32 by 32 canvas scaled
 * up whole pixels, the party pale and its foes rust red.
 */
export function PixelFigure(props: { figure: FigureView; down: boolean; far: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const side: FieldSide = props.far ? 'far' : 'near';
  useLayoutEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    ctx?.putImageData(
      new ImageData(pixelsOf(props.figure, props.down, side), PORTRAIT, PORTRAIT),
      0,
      0,
    );
  }, [JSON.stringify(props.figure), props.down, side]);
  return (
    <canvas
      class="figure pixel"
      width={PORTRAIT}
      height={PORTRAIT}
      aria-hidden="true"
      ref={canvas}
    />
  );
}
