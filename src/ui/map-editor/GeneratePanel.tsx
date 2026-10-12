import { useState } from 'preact/hooks';
import type { Region } from '../../data/schemas/index.ts';
import { slug, uniqueId } from '../../game/editor/library.ts';
import { generateRegion } from '../../game/editor/map-gen.ts';
import { createRng } from '../../rules/rng.ts';
import { data, freshRng } from '../builder/data.ts';

const newSeed = () => String(freshRng().int(1, 999_999));

/** Rolling a random map with settlements; the same seed and sizes roll the same map. */
export function GeneratePanel(props: { taken: string[]; onRegion: (r: Region) => void }) {
  const d = data.content.mapGen.defaults;
  const [name, setName] = useState('New lands');
  const [width, setWidth] = useState(d.width);
  const [height, setHeight] = useState(d.height);
  const [settlements, setSettlements] = useState(d.settlements);
  const [seed, setSeed] = useState(newSeed);
  const num = (set: (n: number) => void) => (e: Event) =>
    set(Number((e.target as HTMLInputElement).value));
  const roll = () => {
    const title = name.trim() || 'New lands';
    const id = uniqueId(slug(title, 'map'), props.taken);
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
    <section class="panel" aria-label="Random map">
      <h2>Random map</h2>
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
        <label>
          Settlements{' '}
          <input type="number" min="1" max="30" value={settlements} onInput={num(setSettlements)} />
        </label>
      </div>
      <label class="field">
        <span>Seed</span>
        <input value={seed} onInput={(e) => setSeed((e.target as HTMLInputElement).value)} />
      </label>
      <button type="button" onClick={roll}>
        Roll a new map
      </button>
    </section>
  );
}
