import type { Realm } from '../../data/schemas/index.ts';

/** A realm's ending, shown once when the party reaches it (Sam's call): done, or keep going. */
export function EndingScreen(props: {
  ending: NonNullable<Realm['ending']>;
  onTitle: () => void;
  onContinue: () => void;
}) {
  return (
    <div class="arena intro">
      <section class="intro-text" aria-label="Journey's end">
        <h1>{props.ending.title}</h1>
        {props.ending.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <nav class="title-actions" aria-label="After the journey">
          <button type="button" class="create" onClick={props.onTitle}>
            Return to the title screen
          </button>
          <button type="button" onClick={props.onContinue}>
            Keep adventuring
          </button>
        </nav>
      </section>
    </div>
  );
}
