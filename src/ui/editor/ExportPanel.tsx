import type { ContentData, Dungeon } from '../../data/schemas/index.ts';
import { exportDungeons } from '../../game/dungeon/level-edit.ts';
import { download } from '../editor-store.ts';

/** Getting the work out as files: all dungeons for the content, or this one to share. */
export function ExportPanel(props: { dungeon: Dungeon; content: ContentData; rows: string[] }) {
  const { dungeon, content, rows } = props;
  return (
    <section class="panel" aria-label="Export">
      <h2>Export</h2>
      <p class="hint">
        Save over data/content/dungeons.json, then run pnpm validate:levels. It holds every saved
        dungeon too; one on a saved map needs that map in regions.json.
      </p>
      <div class="row">
        <button
          type="button"
          onClick={() => download('dungeons.json', exportDungeons(content, dungeon))}
        >
          Download dungeons.json
        </button>
        <button
          type="button"
          onClick={() => download(`${dungeon.id}.json`, `${JSON.stringify(dungeon, null, 2)}\n`)}
        >
          Download this dungeon
        </button>
      </div>
      <textarea readOnly rows={rows.length} aria-label="Map text" value={rows.join('\n')} />
    </section>
  );
}
