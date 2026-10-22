import type { ComponentChildren } from 'preact';
import { useId, useState } from 'preact/hooks';

/**
 * The bar's rarely used actions (export, abandon). On a computer they sit in the bar like any
 * other; on a phone they fold behind a More button so the map starts higher (src/ui/theme/mobile.css).
 */
export function BarMore(props: { children: ComponentChildren }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span class={open ? 'bar-more open' : 'bar-more'}>
      <button
        type="button"
        class="bar-more-toggle secondary"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        More
      </button>
      <span id={id} class="bar-more-items">
        {props.children}
      </span>
    </span>
  );
}
