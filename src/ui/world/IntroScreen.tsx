import type { ContentData } from '../../data/schemas/index.ts';

/** The setting in brief, shown once when a new world starts (Phase 16). */
export function IntroScreen(props: {
  intro: ContentData['campaign']['intro'];
  onBegin: () => void;
}) {
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
