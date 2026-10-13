import { darkness, type LightView } from '../../render/dungeon-light.ts';
import { VIEW_HEIGHT, VIEW_WIDTH, type Panel } from '../../render/dungeon-view.ts';
import type { TrapArt } from '../../render/trap-art.ts';

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

/** A known trap's stain, holes, wire, wedge, and the party's chalk ring over all. */
function TrapMarks(props: { art: TrapArt }) {
  const { art } = props;
  return (
    <>
      {art.stain && <path class={`stain ${art.stainKind ?? ''}`} d={art.stain} />}
      {art.holes && <path class="holes" d={art.holes} />}
      {art.wire && <path class="wire" d={art.wire} />}
      {art.wedge && <path class="wedge" d={art.wedge} />}
      <path class="chalk" d={art.chalk} />
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
        <g
          key={p.key}
          class={`panel-${p.kind}`}
          // A trap fades into the floor it lies on, which carries its own shadow.
          opacity={p.trap && light ? 1 - darkness(light, p.span.near) : undefined}
        >
          {p.breach && (
            <clipPath id={`dv-breach-${p.key}`}>
              <path d={p.breach.clip} clip-rule="evenodd" />
            </clipPath>
          )}
          <g clip-path={p.breach ? `url(#dv-breach-${p.key})` : undefined}>
            {(!p.trap || p.trap.plate) && <polygon points={p.points} fill={p.fill} />}
            {p.trap && <TrapMarks art={p.trap} />}
            {p.detail.patches && <path class="patches" d={p.detail.patches} />}
            {p.detail.lines && <path class="detail" d={p.detail.lines} />}
            {p.frame && p.leaf && (
              <>
                <polygon class="door-frame" points={p.frame} fill={p.leaf.fill} />
                <path class="detail" d={p.leaf.detail.lines} />
                <path class="iron" d={p.leaf.detail.patches} />
              </>
            )}
            {light && !p.trap && <Shadow panel={p} light={light} />}
          </g>
          {p.breach && (
            // The broken rim and the rubble at its foot, dimmed with the wall they came from.
            <g opacity={light ? 1 - darkness(light, p.span.near) : undefined}>
              <path class="rim" d={p.breach.rim} />
              <path class="rubble" d={p.breach.rubble} />
            </g>
          )}
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
