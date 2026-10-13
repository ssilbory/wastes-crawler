import { glyphsFor, riverPath, roadPath, type DayTint } from '../../render/hex-art.ts';
import type { HexCell } from '../../render/hex-view.ts';
import { HexArtDefs } from './HexArt.tsx';

const SIZE = 18;

export const HEX_SIZE = SIZE;

/** An icon symbol centred on a hex, `scale` hex radii across. */
function Icon(props: {
  cell: HexCell;
  symbol: string;
  class: string;
  scale: number;
  dx?: number;
  dy?: number;
}) {
  const s = SIZE * props.scale;
  return (
    <use
      class={props.class}
      href={`#${props.symbol}`}
      x={props.cell.cx - s / 2 + (props.dx ?? 0) * SIZE}
      y={props.cell.cy - s / 2 + (props.dy ?? 0) * SIZE}
      width={s}
      height={s}
    />
  );
}

/**
 * The overland map as an inked chart on parchment (docs/presentation-plan.md, V2), drawn in
 * layers: terrain and its glyphs, rivers and roads, the light of the hour, the fog of the unknown
 * with soft edges about what the party knows, then one
 * group per hex with its icons, which takes the clicks; clicking a hex, even under fog, picks it as
 * the destination. With `onDrag`, moving over hexes with the button held picks them too, for
 * painting in the map editor.
 */
export function HexMap(props: {
  cells: HexCell[];
  width: number;
  height: number;
  onPick: (col: number, row: number) => void;
  onDrag?: (col: number, row: number) => void;
  label?: string;
  /** The light of the quarter of the day, over the land but under the icons. */
  tint?: DayTint;
}) {
  const { onDrag, cells, tint } = props;
  const known = cells.filter((c) => c.terrain);
  return (
    <svg
      class="hex-map"
      viewBox={`0 0 ${props.width} ${props.height}`}
      role="img"
      aria-label={props.label ?? 'Overland map'}
    >
      <HexArtDefs />
      <rect class="paper" width={props.width} height={props.height} fill="url(#hm-paper)" />
      <g class="ground">
        {known.map((c) => (
          <g key={c.key} class={`t-${c.terrain}${c.visited ? '' : ' unvisited'}`}>
            <polygon points={c.points} />
            {glyphsFor(c, SIZE).map((g, i) => (
              <use
                key={i}
                href={`#${g.symbol}`}
                x={g.x - g.size / 2}
                y={g.y - g.size / 2}
                width={g.size}
                height={g.size}
              />
            ))}
            {!c.visited && <polygon class="wash" points={c.points} />}
          </g>
        ))}
      </g>
      <path class="river" d={riverPath(cells)} />
      <path class="road" d={roadPath(cells)} />
      {tint && tint.opacity > 0 && (
        <rect
          class="day-tint"
          width={props.width}
          height={props.height}
          fill={tint.color}
          fill-opacity={tint.opacity}
        />
      )}
      {known.length < cells.length && (
        <>
          <mask id="hm-fog-mask">
            <rect width={props.width} height={props.height} fill="#fff" />
            <g filter="url(#hm-fog)">
              {known.map((c) => (
                <polygon key={c.key} points={c.points} fill="#000" />
              ))}
            </g>
          </mask>
          <rect
            class="fog-layer"
            width={props.width}
            height={props.height}
            mask="url(#hm-fog-mask)"
          />
        </>
      )}
      {cells.map((c) => (
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
          <polygon class="hit" points={c.points} />
          {c.site && (
            <>
              <Icon cell={c} symbol="hi-town" class="site" scale={0.95} />
              <text class="site-name" x={c.cx} y={c.cy - SIZE * 0.62}>
                {c.site}
              </text>
            </>
          )}
          {c.dungeon && (
            <use
              class="dungeon"
              href="#hi-dungeon"
              x={c.cx - SIZE * 0.4}
              y={c.cy - SIZE * 0.4}
              width={SIZE * 0.8}
              height={SIZE * 0.8}
            >
              <title>{c.dungeon}</title>
            </use>
          )}
          {c.grove && (
            <use
              class="grove"
              href="#hi-grove"
              x={c.cx - SIZE * 0.4}
              y={c.cy - SIZE * 0.2}
              width={SIZE * 0.8}
              height={SIZE * 0.8}
            >
              <title>{c.grove}</title>
            </use>
          )}
          {c.exit && (
            <use
              class="exit"
              href="#hi-exit"
              x={c.cx - SIZE * 0.35}
              y={c.cy - SIZE * 0.45}
              width={SIZE * 0.8}
              height={SIZE * 0.8}
            >
              <title>{c.exit}</title>
            </use>
          )}
          {c.party && (
            <Icon cell={c} symbol="hi-party" class="party" scale={1.05} dx={0.45} dy={-0.1} />
          )}
        </g>
      ))}
    </svg>
  );
}
