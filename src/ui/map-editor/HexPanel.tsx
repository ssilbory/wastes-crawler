import { useState } from 'preact/hooks';
import {
  DANGER_GLYPHS,
  TownSizeSchema,
  type ContentData,
  type Dungeon,
  type Region,
  type TownSize,
} from '../../data/schemas/index.ts';
import {
  paintDanger,
  paintTerrain,
  placeSite,
  removeSite,
  setStart,
  siteAt,
  updateSite,
} from '../../game/editor/map-edit.ts';
import type { Hex } from '../../rules/hex.ts';
import { data, freshRng } from '../builder/data.ts';

const value = (e: Event) => (e.target as HTMLInputElement | HTMLSelectElement).value;

/** One hex: its terrain and danger, its settlement, and the dungeons there or to put there. */
export function HexPanel(props: {
  region: Region;
  hex: Hex;
  content: ContentData;
  dungeons: Dungeon[];
  onChange: (r: Region) => void;
  onPlace: (d: Dungeon) => void;
}) {
  const { region: r, hex, content, onChange } = props;
  const glyph = r.terrain[hex.row]?.[hex.col] ?? '';
  const danger = r.overlay[hex.row]?.[hex.col] ?? '.';
  const site = siteAt(r, hex);
  const here = props.dungeons.filter(
    (d) => d.region === r.id && d.entrance.col === hex.col && d.entrance.row === hex.row,
  );
  const [pick, setPick] = useState(props.dungeons[0]?.id ?? '');
  const chosen = props.dungeons.find((d) => d.id === pick);
  return (
    <section class="panel" aria-label="Hex details">
      <h2>
        Hex {hex.col},{hex.row}
      </h2>
      <div class="row">
        <label>
          Terrain{' '}
          <select value={glyph} onChange={(e) => onChange(paintTerrain(r, hex, value(e)))}>
            {content.terrains.map((t) => (
              <option key={t.id} value={t.glyph}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Danger{' '}
          <select value={danger} onChange={(e) => onChange(paintDanger(r, hex, value(e)))}>
            {Object.entries(DANGER_GLYPHS).map(([g, name]) => (
              <option key={g} value={g}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {site ? (
        <fieldset>
          <legend>Settlement</legend>
          <label class="field">
            <span>Settlement name</span>
            <input
              value={site.name}
              onChange={(e) => onChange(updateSite(r, site.id, { name: value(e) }))}
            />
          </label>
          <div class="row">
            <label>
              Size{' '}
              <select
                value={site.size}
                onChange={(e) => onChange(updateSite(r, site.id, { size: value(e) as TownSize }))}
              >
                {TownSizeSchema.options.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label class="check">
              <input
                type="checkbox"
                checked={r.start === site.id}
                disabled={r.start === site.id}
                onChange={() => onChange(setStart(r, site.id))}
              />{' '}
              A new party starts here
            </label>
          </div>
          <button
            type="button"
            disabled={r.sites.length <= 1}
            onClick={() => onChange(removeSite(r, site.id))}
          >
            Remove settlement
          </button>
        </fieldset>
      ) : (
        <p>
          <button
            type="button"
            onClick={() => onChange(placeSite(data.content, freshRng(), r, hex, 'village'))}
          >
            Add a village here
          </button>
        </p>
      )}
      <fieldset>
        <legend>Dungeons</legend>
        {here.length > 0 ? (
          <ul>
            {here.map((d) => (
              <li key={d.id}>{d.name}</li>
            ))}
          </ul>
        ) : (
          <p class="hint">No dungeon here.</p>
        )}
        <div class="row">
          <select aria-label="Dungeon to place" value={pick} onChange={(e) => setPick(value(e))}>
            {props.dungeons.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button type="button" disabled={!chosen} onClick={() => chosen && props.onPlace(chosen)}>
            Put it here
          </button>
        </div>
        <p class="hint">Moving a dungeon here takes it off its old map once this map is saved.</p>
      </fieldset>
    </section>
  );
}
