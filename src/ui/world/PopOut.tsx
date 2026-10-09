import type { ComponentChildren } from 'preact';

/**
 * A card that pops out over the view beneath it, which dims, for things that need an answer before
 * play goes on: an encounter, a raid on the town. It covers its positioned parent only, so the
 * party's panels beside it stay readable.
 */
export function PopOut(props: { children: ComponentChildren }) {
  return (
    <div class="pop-out">
      <div class="pop-out-card">{props.children}</div>
    </div>
  );
}
