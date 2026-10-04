import type { RosterEntry } from '../../game/character/roster.ts';

/** The party formation: slot key "row-column" → roster id. */
export type Placement = Record<string, string>;

const ROWS = [
  { row: 0, name: 'Front row' },
  { row: 1, name: 'Rear row' },
];

/** Two rows of four slots, each filled from the roster. */
export function PartySetup(props: {
  entries: RosterEntry[];
  placement: Placement;
  /** Takes an update rather than a value, so quick picks in a row build on each other. */
  onChange: (update: (placement: Placement) => Placement) => void;
}) {
  const placed = new Set(Object.values(props.placement));
  const set = (key: string, id: string) =>
    props.onChange((placement) => {
      const rest = Object.entries(placement).filter(([k]) => k !== key);
      return Object.fromEntries(id ? [...rest, [key, id]] : rest);
    });
  return (
    <section class="panel party-setup" aria-label="Party formation">
      <h2>Party formation</h2>
      <p class="hint">
        Each rear slot is shielded by the slot ahead of it. Characters in front fight in melee.
      </p>
      {ROWS.map(({ row, name }) => (
        <div class="picker-row" key={row}>
          <span class="row-name">{name}</span>
          <div class="formation-slots">
            {[0, 1, 2, 3].map((column) => {
              const key = `${row}-${column}`;
              const value = props.placement[key] ?? '';
              return (
                <select
                  key={key}
                  aria-label={`${name}, slot ${column + 1}`}
                  value={value}
                  onChange={(e) => set(key, (e.target as HTMLSelectElement).value)}
                >
                  <option value="">Empty</option>
                  {props.entries
                    .filter((e) => e.id === value || !placed.has(e.id))
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.character.name}
                      </option>
                    ))}
                </select>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
