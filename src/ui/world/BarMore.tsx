import type { ComponentChildren } from 'preact';
import { useId, useState } from 'preact/hooks';

/**
 * The bar's rarely used actions (export, abandon), folded behind a More button so the bar keeps to
 * one row on a computer and the map starts higher on a phone (layout.css).
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
