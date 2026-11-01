import {
  automapLegend,
  LEGEND_HEIGHT,
  LOCATED_ART,
  MAP_CELL,
  type Automap as AutomapData,
  type AutomapLegend,
} from '../../render/automap-view.ts';
import { furnitureParts } from '../../render/furniture-art.ts';
import type { MapWindow } from '../../render/automap-window.ts';

/**
 * The dungeon automap: the cells seen on this level, their walls and doors, magic sensed, what the
 * dead have located, and the party's arrow, with a scale and a compass under it (docs/presentation-plan.md, V4).
 */
export function Automap(props: {
  map: AutomapData;
  label: string;
  /** A square clicked, to walk to (useWalk.ts). */
  onPick?: ((cell: { x: number; y: number }) => void) | undefined;
  /** Only this part of the map, with no legend, as a phone shows it (automap-window.ts). */
  window?: MapWindow | undefined;
}) {
  const { map, onPick, window: part } = props;
  const legend = automapLegend(map);
  const end = legend.blocks.at(-1) as AutomapLegend['blocks'][number];
  const box = part
    ? `${part.x - 2} ${part.y - 2} ${part.width + 4} ${part.height + 4}`
    : `-2 -2 ${map.width + 4} ${map.height + LEGEND_HEIGHT + 4}`;
  return (
    <svg
      viewBox={box}
      role="img"
      aria-label={props.label}
      class={['automap', onPick && 'pickable', part && 'windowed'].filter(Boolean).join(' ')}
      onClick={
        onPick &&
        ((e) => {
          // From the click to the map's own units, however the map is scaled or letterboxed to
          // fit its box (a phone caps its height; mobile.css).
          const svg = e.currentTarget as SVGSVGElement;
          const ctm = svg.getScreenCTM();
          if (!ctm) return;
          const at = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
          const x = Math.floor(at.x / MAP_CELL);
          const y = Math.floor(at.y / MAP_CELL);
          if (x >= 0 && y >= 0 && x * MAP_CELL < map.width && y * MAP_CELL < map.height)
            onPick({ x, y });
        })
      }
    >
      {map.cells.map((c) => (
        <rect
          key={c.key}
          class={`seen ${c.kind}`}
          x={c.x * MAP_CELL}
          y={c.y * MAP_CELL}
          width={MAP_CELL}
          height={MAP_CELL}
        />
      ))}
      {map.lines.map((l) => (
        <line key={l.key} class={l.kind} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
      ))}
      {map.sensed.map((c) => (
        <circle
          key={c.key}
          class="sensed"
          cx={(c.x + 0.5) * MAP_CELL}
          cy={(c.y + 0.5) * MAP_CELL}
          r={MAP_CELL * 0.25}
        >
          <title>A working of magic</title>
        </circle>
      ))}
      {map.located.map((m) => (
        <svg
          key={m.key}
          class={`located ${m.what}`}
          x={m.x * MAP_CELL + 2}
          y={m.y * MAP_CELL + 2}
          width={MAP_CELL - 4}
          height={MAP_CELL - 4}
          viewBox="0 0 12 12"
        >
          <title>{LOCATED_ART[m.what].title}</title>
          <path d={LOCATED_ART[m.what].d} fill-rule="evenodd" />
        </svg>
      ))}
      {map.furniture.map((f) => (
        <svg
          key={f.key}
          class={`furniture ${f.kind}`}
          x={f.x * MAP_CELL + 2}
          y={f.y * MAP_CELL + 2}
          width={MAP_CELL - 4}
          height={MAP_CELL - 4}
          viewBox="0 0 48 48"
        >
          <title>{f.kind}</title>
          {furnitureParts(f.kind).map((p, i) => (
            <path
              key={i}
              class={p.kind}
              d={p.d}
              stroke-width={p.kind === 'fill' ? undefined : p.width}
            />
          ))}
        </svg>
      ))}
      <polygon class="party" points={map.party} />
      {!part && (
        <g class="legend">
          {legend.blocks.map((b) => (
            <rect
              key={b.x}
              class={b.dark ? 'dark' : 'light'}
              x={b.x}
              y={legend.y}
              width={b.width}
              height={4}
            />
          ))}
          <text x={0} y={legend.y - 2}>
            0
          </text>
          <text x={end.x + end.width} y={legend.y - 2} text-anchor="end">
            {legend.label}
          </text>
          <g class="compass" transform={`translate(${legend.compass.x} ${legend.compass.y})`}>
            <title>North is up</title>
            <path class="needle" d="M0,-8L2.6,0H-2.6Z" />
            <path class="tail" d="M0,8L2.6,0H-2.6Z" />
            <text x={-8} y={3} text-anchor="end">
              N
            </text>
          </g>
        </g>
      )}
    </svg>
  );
}
