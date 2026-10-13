import {
  automapLegend,
  LEGEND_HEIGHT,
  MAP_CELL,
  type Automap as AutomapData,
  type AutomapLegend,
} from '../../render/automap-view.ts';

/**
 * The dungeon automap: the cells seen on this level, their walls and doors, magic sensed, and the
 * party's arrow, with a scale and a compass under it (docs/presentation-plan.md, V4).
 */
export function Automap(props: { map: AutomapData; label: string }) {
  const { map } = props;
  const legend = automapLegend(map);
  const end = legend.blocks.at(-1) as AutomapLegend['blocks'][number];
  return (
    <svg
      class="automap"
      viewBox={`-2 -2 ${map.width + 4} ${map.height + LEGEND_HEIGHT + 4}`}
      role="img"
      aria-label={props.label}
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
      <polygon class="party" points={map.party} />
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
    </svg>
  );
}
