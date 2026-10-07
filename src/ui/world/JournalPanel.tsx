import type { World } from '../../game/world/types.ts';

/** The journey log, newest line first, capped so it never stretches the page. */
export function JournalPanel(props: { world: World; lines?: number }) {
  return (
    <section class="panel log" aria-label="Journey log">
      <h3>Journal</h3>
      <ol>
        {props.world.log.slice(-(props.lines ?? 60)).map((line, i) => (
          <li key={`${i}-${line}`}>{line}</li>
        ))}
      </ol>
    </section>
  );
}
