import { useMemo } from 'preact/hooks';
import type { DayTint } from '../../render/hex-art.ts';
import type { HexCell } from '../../render/hex-view.ts';
import { UNIT } from '../../render/pixel/hexgrid.ts';
import { landFrame } from '../../render/pixel/overland.ts';
import { marksFrame, overlandLight, overlandRGBA } from '../../render/pixel/overland-marks.ts';
import type { Frame } from '../../render/pixel/frame.ts';
import { rasterize } from './pixel-raster.ts';

/** A lit layer as an image the SVG can scale with the map's zoom. */
function toURL(f: Frame, light: ReturnType<typeof overlandLight>): string {
  const canvas = document.createElement('canvas');
  canvas.width = f.width;
  canvas.height = f.height;
  canvas
    .getContext('2d')
    ?.putImageData(new ImageData(overlandRGBA(f, light), f.width, f.height), 0, 0);
  return canvas.toDataURL('image/png');
}

/** What the icon layer draws from: each place's icons and where the party stands. */
const marksSignature = (cells: readonly HexCell[]) =>
  cells
    .filter((c) => c.site || c.dungeon || c.grove || c.lair || c.camp || c.exit || c.party)
    .map((c) => [c.key, c.site, c.dungeon, c.grove, c.lair, c.camp, c.exit, c.party].join(':'))
    .join('|');

/**
 * The overland's land and icons as pixel art (docs/presentation-plan.md, V8), two images scaled
 * up whole pixels inside the map's SVG, under its clickable hexes. The land is drawn again only
 * when the land changes, the icons when a place or the party does, and either is relit when the
 * hour changes.
 */
export function PixelLand(props: {
  cells: HexCell[];
  size: number;
  width: number;
  height: number;
  /** From `landSignature` (src/render/hex-view.ts). */
  signature: string;
  tint?: DayTint | undefined;
}) {
  const { cells, size, width, height, tint } = props;
  const marks = marksSignature(cells);
  const land = useMemo(
    () => landFrame(cells, size, width, height, rasterize),
    [props.signature, size, width, height],
  );
  const icons = useMemo(() => marksFrame(cells, size, width, height), [marks, size, width, height]);
  const light = overlandLight(tint);
  const lightKey = `${light.tint}:${light.bright}`;
  const landURL = useMemo(() => toURL(land, light), [land, lightKey]);
  const iconsURL = useMemo(() => toURL(icons, light), [icons, lightKey]);
  const box = { width: land.width * UNIT, height: land.height * UNIT };
  return (
    <>
      <image class="pixel-land" href={landURL} {...box} preserveAspectRatio="none" />
      <image class="pixel-marks" href={iconsURL} {...box} preserveAspectRatio="none" />
    </>
  );
}
