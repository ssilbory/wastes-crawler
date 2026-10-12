import type { HexCell } from '../../render/hex-view.ts';

const SIZE = 18;

export const HEX_SIZE = SIZE;

/**
 * The overland map as SVG; clicking a hex, even under fog, picks it as the destination. With
 * `onDrag`, moving over hexes with the button held picks them too, for painting in the map editor.
 */
export function HexMap(props: {
  cells: HexCell[];
  width: number;
  height: number;
  onPick: (col: number, row: number) => void;
  onDrag?: (col: number, row: number) => void;
  label?: string;
}) {
  const { onDrag } = props;
  return (
    <svg
      class="hex-map"
      viewBox={`0 0 ${props.width} ${props.height}`}
      role="img"
      aria-label={props.label ?? 'Overland map'}
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
            c.quest ? 'quest' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          data-hex={c.key}
          onClick={() => props.onPick(c.col, c.row)}
          onPointerEnter={
            onDrag ? (e: PointerEvent) => e.buttons === 1 && onDrag(c.col, c.row) : undefined
          }
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
          {c.dungeon && (
            <polygon
              class="dungeon"
              points={`${c.cx - SIZE * 0.4},${c.cy - SIZE * 0.3} ${c.cx + SIZE * 0.4},${c.cy - SIZE * 0.3} ${c.cx},${c.cy + SIZE * 0.4}`}
            >
              <title>{c.dungeon}</title>
            </polygon>
          )}
          {c.grove && (
            <circle class="grove" cx={c.cx} cy={c.cy + SIZE * 0.2} r={SIZE * 0.3}>
              <title>{c.grove}</title>
            </circle>
          )}
          {c.exit && (
            <polygon
              class="exit"
              points={`${c.cx + SIZE * 0.5},${c.cy} ${c.cx - SIZE * 0.2},${c.cy - SIZE * 0.4} ${c.cx - SIZE * 0.2},${c.cy + SIZE * 0.4}`}
            >
              <title>{c.exit}</title>
            </polygon>
          )}
          {c.party && <circle class="party" cx={c.cx} cy={c.cy} r={SIZE * 0.45} />}
        </g>
      ))}
    </svg>
  );
}
