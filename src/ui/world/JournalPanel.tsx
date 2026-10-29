import { useState } from 'preact/hooks';
import type { World } from '../../game/world/types.ts';
import { filterLog, LOG_FILTERS, type LogFilter } from '../../render/log-view.ts';
import { SheetDialog } from './SheetDialog.tsx';

/**
 * The journey log, newest line first, so it reads from the top of its scrolling strip. A screen
 * reader hears each new line as it lands: lines are keyed by their place in the whole log, so the
 * ones already shown stay put as the window slides. Full log opens the whole of it, to search.
 */
export function JournalPanel(props: { world: World; lines?: number }) {
  const log = props.world.log;
  const first = Math.max(0, log.length - (props.lines ?? 60));
  const [full, setFull] = useState(false);
  return (
    <>
      <section class="panel log" aria-label="Journey log">
        <div class="log-head">
          <h3>Journal</h3>
          <button type="button" class="secondary" onClick={() => setFull(true)}>
            Full log
          </button>
        </div>
        <ol role="log" aria-live="polite">
          {log
            .slice(first)
            .map((line, i) => <li key={first + i}>{line}</li>)
            .reverse()}
        </ol>
      </section>
      {/* Beside the strip, not in it, so the strip's styles stay its own. */}
      {full && <FullLog log={log} onClose={() => setFull(false)} />}
    </>
  );
}

/** The whole journey log, newest first, narrowed by a filter and a search. */
function FullLog(props: { log: readonly string[]; onClose: () => void }) {
  const [filter, setFilter] = useState<LogFilter>('all');
  const [text, setText] = useState('');
  const lines = filterLog(props.log, filter, text);
  return (
    <SheetDialog title="Journey log" onClose={props.onClose}>
      <div class="log-tools">
        <label>
          Search{' '}
          <input
            type="search"
            value={text}
            onInput={(e) => setText((e.target as HTMLInputElement).value)}
          />
        </label>
        <div class="tabs" role="radiogroup" aria-label="Show">
          {(Object.keys(LOG_FILTERS) as LogFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={filter === f}
              onClick={() => setFilter(f)}
            >
              {LOG_FILTERS[f].label}
            </button>
          ))}
        </div>
        <p class="hint">
          {lines.length} of {props.log.length} lines
        </p>
      </div>
      <ol class="full-log">
        {lines.map((l) => (
          <li key={l.key}>{l.line}</li>
        ))}
      </ol>
    </SheetDialog>
  );
}
