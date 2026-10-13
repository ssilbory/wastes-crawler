import { drawFigure } from '../../render/figure-draw.ts';
import type { FigureView } from '../../render/figure-view.ts';

/**
 * A combatant's silhouette (docs/presentation-plan.md, V3), drawn in the side's colour; cut lines
 * take the slot's colour to carve details out of it.
 */
export function Figure(props: { figure: FigureView; down: boolean }) {
  const { parts, transform } = drawFigure(props.figure, props.down);
  return (
    <svg class="figure" viewBox="0 0 48 48" aria-hidden="true">
      <g transform={transform}>
        {parts.map((p, i) =>
          p.kind === 'fill' ? (
            <path key={i} class="fill" d={p.d} />
          ) : (
            <path key={i} class={p.kind} d={p.d} stroke-width={p.width} />
          ),
        )}
      </g>
    </svg>
  );
}
