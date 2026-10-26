import { Component } from 'preact';
import { glyphsFor, riverPath, roadPath } from '../../render/hex-art.ts';
import type { HexCell } from '../../render/hex-view.ts';
import { bridges, shores } from '../../render/hex-water.ts';

interface LayerProps {
  cells: HexCell[];
  size: number;
  width: number;
  height: number;
  /** From `landSignature` (src/render/hex-view.ts): the layer redraws only when this changes. */
  signature: string;
}

/** A layer that redraws only when the land under it changes, not on every game action. */
abstract class Layer extends Component<LayerProps> {
  override shouldComponentUpdate(next: LayerProps): boolean {
    const p = this.props;
    return (
      next.signature !== p.signature ||
      next.size !== p.size ||
      next.width !== p.width ||
      next.height !== p.height
    );
  }
}

/** Terrain and its glyphs, shores, rivers, roads and bridges. */
export class LandLayer extends Layer {
  override render() {
    const { cells, size } = this.props;
    const known = cells.filter((c) => c.terrain);
    const shore = shores(cells, size);
    return (
      <>
        <g class="ground">
          {known.map((c) => (
            <g key={c.key} class={`t-${c.terrain}${c.visited ? '' : ' unvisited'}`}>
              <polygon points={c.points} />
              {glyphsFor(c, size).map((g, i) => (
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
        <path class="shallows" d={shore.shallows} />
        <path class="shore" d={shore.line} />
        <path class="river" d={riverPath(cells)} />
        <path class="road" d={roadPath(cells)} />
        {bridges(cells).map((b) => (
          <use
            key={b.key}
            class="bridge"
            href="#hi-bridge"
            x={-size * 0.6}
            y={-size * 0.6}
            width={size * 1.2}
            height={size * 1.2}
            transform={`translate(${b.x} ${b.y}) rotate(${b.angle})`}
          />
        ))}
      </>
    );
  }
}

/** The fog of the unknown, with soft edges about what the party knows; none once all is known. */
export class FogLayer extends Layer {
  override render() {
    const { cells, width, height } = this.props;
    const known = cells.filter((c) => c.terrain);
    if (known.length === cells.length) return null;
    return (
      <>
        <mask id="hm-fog-mask">
          <rect width={width} height={height} fill="#fff" />
          <g filter="url(#hm-fog)">
            {known.map((c) => (
              <polygon key={c.key} points={c.points} fill="#000" />
            ))}
          </g>
        </mask>
        <rect class="fog-layer" width={width} height={height} mask="url(#hm-fog-mask)" />
      </>
    );
  }
}
