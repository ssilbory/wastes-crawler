import { useState } from 'preact/hooks';
import { ConfirmButton } from '../confirm.tsx';
import type { ContentData, Dungeon } from '../../data/schemas/index.ts';
import {
  addLevel,
  canRemoveLevel,
  copyDungeon,
  moveLevel,
  removeLevel,
  renameDungeon,
  renameLevel,
  setWander,
} from '../../game/dungeon/dungeon-edit.ts';
import { freeHex } from '../../game/editor/map-edit.ts';
import type { Saving } from './EditorApp.tsx';

const value = (e: Event) => (e.target as HTMLInputElement | HTMLSelectElement).value;

/** The dungeon as a whole: its name, where it is, its levels, and saving it. */
export function DungeonPanel(props: {
  dungeon: Dungeon;
  level: string;
  content: ContentData;
  saving: Saving;
  newId: (name: string) => string;
  onChange: (d: Dungeon) => void;
  onLevel: (id: string) => void;
}) {
  const { dungeon: d, level: levelId, content, saving, onChange } = props;
  const level = d.levels.find((l) => l.id === levelId);
  const [copyName, setCopyName] = useState(`${d.name} copy`);
  const region = content.regions.find((r) => r.id === d.region);
  const width = (region?.terrain[0] ?? '').length;
  const height = region?.terrain.length ?? 0;
  const moveTo = (regionId: string) => {
    const r = content.regions.find((x) => x.id === regionId);
    const taken = content.dungeons
      .filter((x) => x.region === regionId && x.id !== d.id)
      .map((x) => x.entrance);
    const at = r && freeHex(content.terrains, r, taken);
    if (r && at) onChange({ ...d, region: r.id, entrance: at });
  };
  return (
    <section class="panel" aria-label="Dungeon">
      <h2>Dungeon</h2>
      <label class="field">
        <span>Name</span>
        <input value={d.name} onChange={(e) => onChange(renameDungeon(d, value(e)))} />
      </label>
      <div class="row">
        <label>
          Map{' '}
          <select value={d.region} onChange={(e) => moveTo(value(e))}>
            {content.regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Column{' '}
          <input
            type="number"
            min="0"
            max={width - 1}
            value={d.entrance.col}
            onChange={(e) => onChange({ ...d, entrance: { ...d.entrance, col: Number(value(e)) } })}
          />
        </label>
        <label>
          Row{' '}
          <input
            type="number"
            min="0"
            max={height - 1}
            value={d.entrance.row}
            onChange={(e) => onChange({ ...d, entrance: { ...d.entrance, row: Number(value(e)) } })}
          />
        </label>
      </div>
      <p class="hint">Place it by hex in the map editor, too.</p>
      {level && (
        <fieldset>
          <legend>This level</legend>
          <label class="field">
            <span>Level name</span>
            <input
              value={level.name}
              onChange={(e) => onChange(renameLevel(d, level.id, value(e)))}
            />
          </label>
          <div class="row">
            <label>
              Wanderers{' '}
              <select
                aria-label="Wandering table"
                value={level.wander?.table ?? ''}
                onChange={(e) =>
                  onChange(
                    setWander(
                      d,
                      level.id,
                      value(e) ? { every: level.wander?.every ?? 2, table: value(e) } : null,
                    ),
                  )
                }
              >
                <option value="">None</option>
                {content.encounterTables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id}
                  </option>
                ))}
              </select>
            </label>
            {level.wander && (
              <label>
                every{' '}
                <input
                  type="number"
                  min="1"
                  max="6"
                  aria-label="Turns between checks"
                  value={level.wander.every}
                  onChange={(e) =>
                    level.wander &&
                    onChange(
                      setWander(d, level.id, {
                        ...level.wander,
                        every: Math.min(6, Math.max(1, Math.floor(Number(value(e))) || 1)),
                      }),
                    )
                  }
                />{' '}
                turns
              </label>
            )}
          </div>
          <div class="row">
            <button type="button" onClick={() => onChange(moveLevel(d, level.id, -1))}>
              Move up
            </button>
            <button type="button" onClick={() => onChange(moveLevel(d, level.id, 1))}>
              Move down
            </button>
            <ConfirmButton
              confirm="Remove for good"
              disabled={!canRemoveLevel(d, level.id)}
              title={canRemoveLevel(d, level.id) ? undefined : 'The entry level stays'}
              onConfirm={() => {
                const next = removeLevel(d, level.id);
                onChange(next);
                props.onLevel(next.entry.level);
              }}
            >
              Remove level
            </ConfirmButton>
          </div>
        </fieldset>
      )}
      <div class="row">
        <button
          type="button"
          onClick={() => {
            const next = addLevel(d);
            onChange(next);
            props.onLevel((next.levels[next.levels.length - 1] as { id: string }).id);
          }}
        >
          Add level
        </button>
      </div>
      <fieldset>
        <legend>Saving</legend>
        <p class="hint">
          {saving.saved
            ? 'Saved in this browser.'
            : saving.shipped
              ? 'Shipped with the game; saving keeps your copy in this browser.'
              : 'Not saved yet.'}
        </p>
        {saving.saved && (
          <p class={saving.notPlayable ? 'error' : 'hint'} role="note">
            {saving.notPlayable
              ? `Not in the game: ${saving.notPlayable}`
              : 'In the game: open the Overland screen to play it.'}
          </p>
        )}
        <div class="row">
          <button type="button" onClick={() => saving.save(d)}>
            Save
          </button>
          {saving.saved && (
            <ConfirmButton
              confirm={saving.shipped ? 'Discard it for good' : 'Delete it for good'}
              onConfirm={saving.discard}
            >
              {saving.shipped ? 'Discard saved copy' : 'Delete saved dungeon'}
            </ConfirmButton>
          )}
        </div>
        <div class="row">
          <input aria-label="Copy name" value={copyName} onInput={(e) => setCopyName(value(e))} />
          <button
            type="button"
            disabled={!copyName.trim()}
            onClick={() => {
              const copy = copyDungeon(d, props.newId(copyName), copyName.trim());
              // A copy can't share the original's hex.
              const taken = content.dungeons
                .filter((x) => x.region === copy.region)
                .map((x) => x.entrance);
              const r = content.regions.find((x) => x.id === copy.region);
              const at = r && freeHex(content.terrains, r, taken);
              saving.saveAs(at ? { ...copy, entrance: at } : copy);
            }}
          >
            Save as copy
          </button>
        </div>
      </fieldset>
    </section>
  );
}
