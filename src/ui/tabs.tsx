import type { ComponentChildren } from 'preact';

/** Ids for a tab list and the one panel it shows: the panel takes `panelProps(id, selected)`. */
const tabId = (id: string, key: string) => `${id}-tab-${key}`;
const panelId = (id: string) => `${id}-panel`;

/**
 * A row of tabs over one panel. Only the selected tab is in the Tab order; the arrow keys, Home,
 * and End move along the row and select as they go, so a keyboard reaches every tab in one stop.
 */
export function Tabs<K extends string>(props: {
  /** Unique on the page: the tabs' and the panel's ids are built from it. */
  id: string;
  label: string;
  tabs: readonly { key: K; label: ComponentChildren }[];
  selected: K;
  onSelect: (key: K) => void;
  class?: string;
}) {
  const keys = props.tabs.map((t) => t.key);
  const onKeyDown = (e: KeyboardEvent) => {
    const at = keys.indexOf(props.selected);
    const to =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? (at + 1) % keys.length
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? (at - 1 + keys.length) % keys.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? keys.length - 1
              : null;
    const key = to === null ? undefined : keys[to];
    if (key === undefined) return;
    e.preventDefault();
    props.onSelect(key);
    document.getElementById(tabId(props.id, key))?.focus();
  };
  return (
    <div
      class={props.class ? `tabs ${props.class}` : 'tabs'}
      role="tablist"
      aria-label={props.label}
      onKeyDown={onKeyDown}
    >
      {props.tabs.map((t) => (
        <button
          key={t.key}
          id={tabId(props.id, t.key)}
          type="button"
          role="tab"
          aria-selected={t.key === props.selected}
          aria-controls={panelId(props.id)}
          tabIndex={t.key === props.selected ? 0 : -1}
          onClick={() => props.onSelect(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** The attributes for the panel under a `Tabs` with the same `id`. */
export function panelProps(id: string, selected: string) {
  return {
    id: panelId(id),
    role: 'tabpanel',
    'aria-labelledby': tabId(id, selected),
  } as const;
}
