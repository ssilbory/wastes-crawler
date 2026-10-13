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

/** A figure's paths in its 48 by 48 box, for drawing inside another SVG. */
export function FigureParts(props: { figure: FigureView; down: boolean }) {
  const { parts, transform } = drawFigure(props.figure, props.down);
  return (
    <g transform={transform}>
      {parts.map((p, i) =>
        p.kind === 'fill' ? (
          <path key={i} class="fill" d={p.d} />
        ) : (
          <path key={i} class={p.kind} d={p.d} stroke-width={p.width} />
        ),
      )}
    </g>
  );
}
