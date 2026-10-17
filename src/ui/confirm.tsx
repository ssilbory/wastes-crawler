import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

/**
 * A button for something that can't be undone: the first press asks, the second does it. With
 * `ask` false it acts on the first press, for when there is nothing to lose.
 */
export function ConfirmButton(props: {
  children: ComponentChildren;
  /** The label of the button that does it. */
  confirm: string;
  onConfirm: () => void;
  ask?: boolean;
  class?: string | undefined;
  disabled?: boolean;
  title?: string | undefined;
}) {
  const [asking, setAsking] = useState(false);
  if (asking)
    return (
      <span class="confirm" role="group" aria-label="Are you sure?">
        <button
          type="button"
          class="danger"
          onClick={() => {
            setAsking(false);
            props.onConfirm();
          }}
        >
          {props.confirm}
        </button>
        <button type="button" onClick={() => setAsking(false)}>
          Keep
        </button>
      </span>
    );
  return (
    <button
      type="button"
      class={props.class}
      disabled={props.disabled}
      title={props.title}
      onClick={() => (props.ask === false ? props.onConfirm() : setAsking(true))}
    >
      {props.children}
    </button>
  );
}
