import { useId } from 'preact/hooks';
import type { Part } from '../../render/figure-art.ts';
import { drawFigure, type Relief } from '../../render/figure-draw.ts';
import type { FigureView } from '../../render/figure-view.ts';

/**
 * A combatant's silhouette (docs/presentation-plan.md, V3), drawn in the side's colour; cut lines
 * take the slot's colour to carve details out of it.
 */
export function Figure(props: { figure: FigureView; down: boolean }) {
  return (
    <svg class="figure" viewBox="0 0 48 48" aria-hidden="true">
      <FigureParts figure={props.figure} down={props.down} />
    </svg>
  );
}

/**
 * Light and shade over a piece drawn from `parts` (docs/presentation-plan.md, V7): a lit band on
 * the edges facing away from `by` and a dark band on the edges facing toward it, each the body
 * less a copy of itself shifted the other way, as a small mask. Drawn over the piece, so its lines
 * and cuts keep their order.
 */
export function ReliefBands(props: { parts: Part[]; by: Relief }) {
  const id = useId();
  const [dx, dy] = props.by;
  const body = (sx: number, sy: number) =>
    props.parts.map((p, i) =>
      p.kind === 'fill' && !p.tone ? (
        <path key={i} d={p.d} transform={sx || sy ? `translate(${sx} ${sy})` : undefined} />
      ) : null,
    );
  const edge = (name: string, sx: number, sy: number) => (
    <mask id={`${id}-${name}`} maskUnits="userSpaceOnUse" x="-8" y="-8" width="64" height="64">
      <g fill="#fff">{body(0, 0)}</g>
      <g fill="#000">{body(sx, sy)}</g>
    </mask>
  );
  return (
    <>
      {edge('lit', dx, dy)}
      {edge('shade', -dx, -dy)}
      <g class="relief-lit" mask={`url(#${id}-lit)`}>
        {body(0, 0)}
      </g>
      <g class="relief-shade" mask={`url(#${id}-shade)`}>
        {body(0, 0)}
      </g>
    </>
  );
}

/**
 * A figure's paths in its 48 by 48 box, for drawing inside another SVG, shaded when it stands:
 * from the upper left in a fight, or by `light` where the party's light falls on it.
 */
export function FigureParts(props: {
  figure: FigureView;
  down: boolean;
  light?: Relief;
  /** Turns a beast to face right (figure-draw.ts). */
  mirror?: boolean;
}) {
  const { parts, transform, relief } = drawFigure(
    props.figure,
    props.down,
    props.light,
    props.mirror,
  );
  return (
    <g transform={transform}>
      {parts.map((p, i) =>
        p.kind === 'fill' ? (
          <path key={i} class="fill" d={p.d} />
        ) : (
          <path key={i} class={p.kind} d={p.d} stroke-width={p.width} />
        ),
      )}
      {relief && <ReliefBands parts={parts} by={relief} />}
    </g>
  );
}
