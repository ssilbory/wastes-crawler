import { useState } from 'preact/hooks';
import type { Region } from '../../data/schemas/index.ts';
import { slug, uniqueId } from '../../game/editor/library.ts';
import { blankRegion } from '../../game/editor/map-edit.ts';
import { generateRegion } from '../../game/editor/map-gen.ts';
import { createRng } from '../../rules/rng.ts';
import { data, freshRng } from '../builder/data.ts';

const newSeed = () => String(freshRng().int(1, 999_999));

/**
 * Starting a new region: blank, one terrain with a starting village to paint on, or rolled at
 * random with settlements, where the same seed and sizes roll the same map.
 */
export function GeneratePanel(props: { taken: string[]; onRegion: (r: Region) => void }) {
  const d = data.content.mapGen.defaults;
  const [name, setName] = useState('New lands');
  const [width, setWidth] = useState(d.width);
  const [height, setHeight] = useState(d.height);
  const [settlements, setSettlements] = useState(d.settlements);
  const [seed, setSeed] = useState(newSeed);
  const passable = data.content.terrains.filter((t) => t.movement !== 'impassable');
  const [fill, setFill] = useState(passable[0]?.glyph ?? 'p');
  const num = (set: (n: number) => void) => (e: Event) =>
    set(Number((e.target as HTMLInputElement).value));
  const named = () => {
    const title = name.trim() || 'New lands';
    return { title, id: uniqueId(slug(title, 'map'), props.taken) };
  };
  const blank = () => {
    const { title, id } = named();
    props.onRegion(blankRegion(data.content, freshRng(), { id, name: title, width, height, fill }));
  };
  const roll = () => {
    const { title, id } = named();
    props.onRegion(
      generateRegion(data.content, createRng(seed), {
        id,
        name: title,
        width,
        height,
        settlements,
      }),
    );
    setSeed(newSeed());
  };
  return (
    <section class="panel" aria-label="New map">
      <h2>New map</h2>
      <label class="field">
        <span>Name</span>
        <input value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </label>
      <div class="row">
        <label>
          Width <input type="number" min="4" max="60" value={width} onInput={num(setWidth)} />
        </label>
        <label>
          Height <input type="number" min="4" max="60" value={height} onInput={num(setHeight)} />
        </label>
      </div>
      <fieldset>
        <legend>Blank</legend>
        <div class="row">
          <label>
            Fill{' '}
            <select value={fill} onChange={(e) => setFill((e.target as HTMLSelectElement).value)}>
              {passable.map((t) => (
                <option key={t.id} value={t.glyph}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={blank}>
            Create blank map
          </button>
        </div>
      </fieldset>
      <fieldset>
        <legend>Random</legend>
        <label>
          Settlements{' '}
          <input type="number" min="1" max="30" value={settlements} onInput={num(setSettlements)} />
        </label>
        <label class="field">
          <span>Seed</span>
          <input value={seed} onInput={(e) => setSeed((e.target as HTMLInputElement).value)} />
        </label>
        <button type="button" onClick={roll}>
          Roll a new map
        </button>
      </fieldset>
    </section>
  );
}
