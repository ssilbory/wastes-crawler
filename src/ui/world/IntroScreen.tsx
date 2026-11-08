import type { Intro } from '../../data/schemas/index.ts';

/** The setting in brief, shown once when a new world starts (Phase 16), the campaign's or a realm's. */
export function IntroScreen(props: { intro: Intro; onBegin: () => void }) {
  return (
    <div class="arena intro">
      <section class="intro-text" aria-label="Introduction">
        <h1>{props.intro.title}</h1>
        {props.intro.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <button type="button" class="create" onClick={props.onBegin}>
          Begin the journey
        </button>
      </section>
    </div>
  );
}
