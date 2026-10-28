import { useId } from 'preact/hooks';
import { drawFigure } from '../../render/figure-draw.ts';
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
 * A figure's paths in its 48 by 48 box, for drawing inside another SVG. A standing figure is
 * shaded over that (docs/presentation-plan.md, V7): light on its upper-left rim and dark on its
 * lower-right edge, each the body less a copy of itself shifted toward the other side.
 */
export function FigureParts(props: { figure: FigureView; down: boolean }) {
  const { parts, transform, relief } = drawFigure(props.figure, props.down);
  const id = useId();
  const body = (by: number) =>
    parts.map((p, i) =>
      p.kind === 'fill' ? (
        <path key={i} d={p.d} transform={by ? `translate(${by} ${by})` : undefined} />
      ) : null,
    );
  // The body less the body moved by `by`: the edge facing away from that move.
  const edge = (name: string, by: number) => (
    <mask id={`${id}-${name}`} maskUnits="userSpaceOnUse" x="-8" y="-8" width="64" height="64">
      <g fill="#fff">{body(0)}</g>
      <g fill="#000">{body(by)}</g>
    </mask>
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
      {relief !== null && (
        <>
          {edge('lit', relief)}
          {edge('shade', -relief)}
          <g class="relief-lit" mask={`url(#${id}-lit)`}>
            {body(0)}
          </g>
          <g class="relief-shade" mask={`url(#${id}-shade)`}>
            {body(0)}
          </g>
        </>
      )}
    </g>
  );
}
