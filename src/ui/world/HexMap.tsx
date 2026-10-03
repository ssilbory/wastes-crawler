import type { HexCell } from '../../render/hex-view.ts';

const SIZE = 18;

export const HEX_SIZE = SIZE;

/** The overland map as SVG; clicking a known hex picks it as the destination. */
export function HexMap(props: {
  cells: HexCell[];
  width: number;
  height: number;
  onPick: (col: number, row: number) => void;
}) {
  return (
    <svg
      class="hex-map"
      viewBox={`0 0 ${props.width} ${props.height}`}
      role="img"
      aria-label="Overland map"
    >
      {props.cells.map((c) => (
        <g
          key={c.key}
          class={[
            'hex',
            c.terrain ? `t-${c.terrain}` : 'fog',
            c.visited ? 'visited' : '',
            c.route ? 'route' : '',
            c.destination ? 'destination' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          data-hex={c.key}
          onClick={() => c.terrain && props.onPick(c.col, c.row)}
        >
          <title>{c.label}</title>
          <polygon points={c.points} />
          {c.road && <circle class="road" cx={c.cx} cy={c.cy} r={SIZE * 0.18} />}
          {c.site && (
            <>
              <rect
                class="site"
                x={c.cx - SIZE * 0.35}
                y={c.cy - SIZE * 0.35}
                width={SIZE * 0.7}
                height={SIZE * 0.7}
              />
              <text class="site-name" x={c.cx} y={c.cy - SIZE * 0.55}>
                {c.site}
              </text>
            </>
          )}
          {c.party && <circle class="party" cx={c.cx} cy={c.cy} r={SIZE * 0.45} />}
        </g>
      ))}
    </svg>
  );
}
