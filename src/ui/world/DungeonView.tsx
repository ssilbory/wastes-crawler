import { darkness, type LightView } from '../../render/dungeon-light.ts';
import { VIEW_HEIGHT, VIEW_WIDTH, type Panel } from '../../render/dungeon-view.ts';

const DARK = '#050404';

/** The dark over one panel: flat on a face square to the view, a gradient on one running away. */
function Shadow(props: { panel: Panel; light: LightView }) {
  const { panel, light } = props;
  const near = darkness(light, panel.span.near);
  const far = darkness(light, panel.span.far);
  if (near === 0 && far === 0) return null;
  if (near === far)
    return <polygon class="shadow" points={panel.points} fill={DARK} fill-opacity={near} />;
  const id = `dv-shadow-${panel.key}`;
  const [x1, y1] = panel.span.from;
  const [x2, y2] = panel.span.to;
  return (
    <>
      <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
        <stop offset="0" stop-color={DARK} stop-opacity={near} />
        <stop offset="1" stop-color={DARK} stop-opacity={far} />
      </linearGradient>
      <polygon class="shadow" points={panel.points} fill={`url(#${id})`} />
    </>
  );
}

/**
 * The first-person view: the panels far to near with their stone and wood, then the light over
 * them, a falloff into the dark toward the vanishing point and the colour the light casts
 * (docs/presentation-plan.md, V1). With no light, the view is pitch dark.
 */
export function DungeonView(props: { panels: Panel[]; light: LightView | null; label: string }) {
  const { light } = props;
  return (
    <svg
      class={['dungeon-view', light ? '' : 'dark', light?.flicker ? 'flicker' : '']
        .filter(Boolean)
        .join(' ')}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      role="img"
      aria-label={props.label}
    >
      {light && (
        <defs>
          <radialGradient id="dv-glow" cx="0.5" cy="1" r="0.9">
            <stop offset="0" stop-color={light.tint} stop-opacity={light.tintOpacity} />
            <stop offset="1" stop-color={light.tint} stop-opacity="0" />
          </radialGradient>
        </defs>
      )}
      <rect class="ceiling" width={VIEW_WIDTH} height={VIEW_HEIGHT / 2} />
      <rect class="floor" y={VIEW_HEIGHT / 2} width={VIEW_WIDTH} height={VIEW_HEIGHT / 2} />
      {props.panels.map((p) => (
        <g key={p.key} class={`panel-${p.kind}`}>
          <polygon points={p.points} fill={p.fill} />
          {p.detail.patches && <path class="patches" d={p.detail.patches} />}
          {p.detail.lines && <path class="detail" d={p.detail.lines} />}
          {p.frame && p.leaf && (
            <>
              <polygon class="door-frame" points={p.frame} fill={p.leaf.fill} />
              <path class="detail" d={p.leaf.detail.lines} />
              <path class="iron" d={p.leaf.detail.patches} />
            </>
          )}
          {light && <Shadow panel={p} light={light} />}
        </g>
      ))}
      {light && <rect class="glow" width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="url(#dv-glow)" />}
      {!light && (
        <text class="pitch-dark" x={VIEW_WIDTH / 2} y={VIEW_HEIGHT / 2}>
          Pitch dark
        </text>
      )}
    </svg>
  );
}
