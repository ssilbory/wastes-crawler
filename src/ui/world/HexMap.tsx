import { useId } from 'preact/hooks';
import { scaleBar, type DayTint, type ScaleBar } from '../../render/hex-art.ts';
import { landSignature, type HexCell } from '../../render/hex-view.ts';
import { FogLayer, LandLayer } from './HexLand.tsx';
import { HexArtDefs } from './HexArt.tsx';
import { useMapKeys } from './map-keys.ts';
import { cursorText } from '../../render/map-cursor.ts';

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

/** The scale bar in the map's corner: alternating hex-long blocks and the distance they cover. */
function ScaleBarMark(props: { bar: ScaleBar }) {
  const { bar } = props;
  const end = bar.blocks.at(-1) as ScaleBar['blocks'][number];
  return (
    <g class="scale-bar">
      <rect
        class="backing"
        x={bar.x - 4}
        y={bar.y - 13}
        width={end.x + end.width - bar.x + 8}
        height={bar.height + 17}
      />
      {bar.blocks.map((b) => (
        <rect
          key={b.x}
          class={b.dark ? 'dark' : 'light'}
          x={b.x}
          y={bar.y}
          width={b.width}
          height={bar.height}
        />
      ))}
      <text x={bar.x} y={bar.y - 3}>
        0
      </text>
      <text x={end.x + end.width} y={bar.y - 3} text-anchor="end">
        {bar.label}
      </text>
    </g>
  );
}

/**
 * The overland map as an inked chart on parchment (docs/presentation-plan.md, V2), drawn in
 * layers: terrain and its glyphs, shores, rivers, roads and bridges, the light of the hour, the fog of the unknown
 * with soft edges about what the party knows, a scale bar and a compass rose, then one
 * group per hex with its icons, which takes the clicks; clicking a hex, even under fog, picks it as
 * the destination. With `onDrag`, moving over hexes with the button held picks them too, for
 * painting in the map editor. Each hex is a button for the keyboard and screen readers
 * (`useMapKeys`): Tab to the map, the arrow keys, then Enter.
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
  const layer = {
    cells,
    size: SIZE,
    width: props.width,
    height: props.height,
    signature: landSignature(cells),
  };
  const keys = useMapKeys(cells, props.onPick);
  const hint = useId();
  return (
    <>
      <svg
        ref={keys.svg}
        class="hex-map"
        viewBox={`0 0 ${props.width} ${props.height}`}
        role="group"
        aria-label={props.label ?? 'Overland map'}
        aria-describedby={hint}
        onKeyDown={keys.onKeyDown}
      >
        <HexArtDefs />
        <rect class="paper" width={props.width} height={props.height} fill="url(#hm-paper)" />
        <LandLayer {...layer} />
        {tint && tint.opacity > 0 && (
          <rect
            class="day-tint"
            width={props.width}
            height={props.height}
            fill={tint.color}
            fill-opacity={tint.opacity}
          />
        )}
        <FogLayer {...layer} />
        <ScaleBarMark bar={scaleBar(props.height, SIZE)} />
        <use
          class="compass"
          href="#hi-compass"
          x={props.width - SIZE * 3.2}
          y={SIZE * 0.6}
          width={SIZE * 2.6}
          height={SIZE * 2.6}
        />
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
            role="button"
            aria-label={cursorText(c)}
            tabindex={c.key === keys.tabStop ? 0 : -1}
            onFocus={() => keys.onFocus(c)}
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
            {c.lair && (
              <use
                class="lair"
                href="#hi-lair"
                x={c.cx - SIZE * 0.4}
                y={c.cy - SIZE * 0.4}
                width={SIZE * 0.8}
                height={SIZE * 0.8}
              >
                <title>{c.lair}</title>
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
      <p id={hint} class="sr-only">
        Arrow keys move across the map; Enter picks the hex.
      </p>
    </>
  );
}
