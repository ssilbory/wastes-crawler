import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import { useDialog } from '../dialog.ts';

/**
 * A card that pops out over the view beneath it, which dims, for things that need an answer before
 * play goes on: an encounter, a raid on the town. It covers its positioned parent only, so the
 * party's panels beside it stay readable. Focus moves to the card when it opens and back when it
 * closes, and Tab stays inside it until it is answered (Sam's call).
 */
export function PopOut(props: { label: string; children: ComponentChildren }) {
  const card = useRef<HTMLDivElement>(null);
  useDialog({ box: card, trap: true });
  return (
    <div class="pop-out">
      <div ref={card} class="pop-out-card" role="dialog" aria-label={props.label} tabIndex={-1}>
        {props.children}
      </div>
    </div>
  );
}
