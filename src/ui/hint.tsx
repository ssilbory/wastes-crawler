// Descriptions for touch screens. On a computer, spell, art, focus, and form names show their
// description on hover (a title attribute). Phones have no hover, so beside each such name an ⓘ
// button opens the same text in a sheet at the foot of the screen. The button shows only on
// devices that can't hover (src/ui/theme/mobile.css), which also draws its ⓘ, so the glyph never
// joins the text of the page around it.
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

interface Shown {
  title: string;
  text: string;
}

let shown: Shown | null = null;
const listeners = new Set<() => void>();
const show = (next: Shown | null) => {
  shown = next;
  listeners.forEach((l) => l());
};

/** An ⓘ button that opens `text` under the heading `name`. */
export function HintButton(props: { name: string; text: string | undefined }) {
  if (!props.text) return null;
  const { name, text } = props;
  return (
    <button
      type="button"
      class="hint-button"
      aria-label={`About ${name}`}
      onClick={(e) => {
        // The tap opens the description and does nothing else on the screen beneath.
        e.stopPropagation();
        show({ title: name, text });
      }}
    />
  );
}

/** A name with a description: on hover with a mouse, through its ⓘ button on a touch screen. */
export function Hint(props: {
  name: string;
  text: string | undefined;
  children: ComponentChildren;
}) {
  return (
    <>
      <span class="has-hint" title={props.text}>
        {props.children}
      </span>
      <HintButton name={props.name} text={props.text} />
    </>
  );
}

/** The sheet itself, mounted once by the Shell. */
export function HintSheet() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && show(null);
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });
  if (!shown) return null;
  return (
    <div class="hint-sheet-backdrop" onClick={() => show(null)}>
      <section
        class="hint-sheet panel"
        role="dialog"
        aria-label={shown.title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{shown.title}</h3>
        <p>{shown.text}</p>
        <button type="button" onClick={() => show(null)}>
          Close
        </button>
      </section>
    </div>
  );
}
