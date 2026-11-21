import { useLayoutEffect, useRef } from 'preact/hooks';
import { VIEW_HEIGHT, VIEW_WIDTH, type Panel } from '../../render/dungeon-view.ts';
import { renderScene } from '../../render/pixel/scene.ts';
import { flickers, lightFrame } from '../../render/pixel/shade.ts';
import type { DungeonViewProps } from './DungeonView.tsx';
import { rasterize } from './pixel-raster.ts';

/**
 * What stands in the view, as invisible boxes over the canvas: each carries its name on hover and
 * its kind as a class, as the vector view's shapes do.
 */
function Marks(props: { panels: Panel[] }) {
  return (
    <svg class="marks" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} aria-hidden="true">
      {props.panels.map((p) => {
        if (p.furniture) {
          const a = p.furniture;
          return (
            <svg
              key={p.key}
              class={`furniture ${a.kind}`}
              x={a.x}
              y={a.y}
              width={a.size}
              height={a.size}
            >
              <title>{a.kind}</title>
              <rect width="100%" height="100%" />
            </svg>
          );
        }
        if (!p.occupant) return null;
        const o = p.occupant;
        return (
          <g key={p.key} class={`occupant ${o.kind}`}>
            <title>{o.title}</title>
            {o.pieces.map((piece, i) => (
              <svg
                key={i}
                class={piece.figure ? (piece.foe ? 'foe' : 'captive') : 'furniture'}
                x={piece.x}
                y={piece.y}
                width={piece.size}
                height={piece.size}
              >
                <rect width="100%" height="100%" />
              </svg>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * The first-person view as pixel art (docs/presentation-plan.md, V8): the panels laid into a 320
 * by 240 frame with procedural textures, lit and dithered to each material's ramp, and scaled up
 * whole pixels at a time. A torch's view is drawn three times, a little dimmer each, and CSS steps
 * between them; screenshots and reduced motion hold the brightest.
 */
export function PixelDungeonView(props: DungeonViewProps) {
  const { light } = props;
  const scene = useRef<HTMLDivElement>(null);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  // The screen draws the view afresh on every change to the game; the frame is only painted when
  // what it shows has changed.
  const drawn = useRef('');
  const levels = light ? flickers(light) : [];
  useLayoutEffect(() => {
    const key = JSON.stringify([props.panels, props.foes ?? [], light]);
    if (key === drawn.current) return;
    drawn.current = key;
    if (!light) return;
    const frame = renderScene(props.panels, props.foes ?? [], rasterize);
    levels.forEach((level, i) => {
      const ctx = canvases.current[i]?.getContext('2d');
      ctx?.putImageData(
        new ImageData(lightFrame(frame, light, level), VIEW_WIDTH, VIEW_HEIGHT),
        0,
        0,
      );
    });
  });
  useLayoutEffect(() => {
    const g = scene.current;
    if (!g || !props.moves) return;
    g.style.animation = 'none';
    // Reading layout makes the browser drop the old animation before the next one starts.
    void g.getBoundingClientRect();
    g.style.animation = '';
  }, [props.moves]);
  return (
    <div
      class={[
        'dungeon-view',
        'pixel',
        light ? '' : 'dark',
        light?.flicker ? 'flicker' : '',
        props.motion ? `move-${props.motion}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="img"
      aria-label={props.label}
    >
      <div class="scene" ref={scene}>
        {levels.map((_, i) => (
          <canvas
            key={`${levels.length}-${i}`}
            class={`frame frame-${i}`}
            width={VIEW_WIDTH}
            height={VIEW_HEIGHT}
            ref={(c) => {
              canvases.current[i] = c;
            }}
          />
        ))}
        {light && <Marks panels={props.panels} />}
      </div>
      {!light && <span class="pitch-dark">Pitch dark</span>}
    </div>
  );
}
