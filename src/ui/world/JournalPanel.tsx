import type { World } from '../../game/world/types.ts';

/**
 * The journey log, newest line first, so it reads from the top of its scrolling strip. A screen
 * reader hears each new line as it lands: lines are keyed by their place in the whole log, so the
 * ones already shown stay put as the window slides.
 */
export function JournalPanel(props: { world: World; lines?: number }) {
  const log = props.world.log;
  const first = Math.max(0, log.length - (props.lines ?? 60));
  return (
    <section class="panel log" aria-label="Journey log">
      <h3>Journal</h3>
      <ol role="log" aria-live="polite">
        {log
          .slice(first)
          .map((line, i) => <li key={first + i}>{line}</li>)
          .reverse()}
      </ol>
    </section>
  );
}
