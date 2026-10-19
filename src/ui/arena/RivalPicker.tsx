import type { Character } from '../../data/schemas/index.ts';
import { data } from '../builder/data.ts';

export type Opponents = 'monsters' | 'starter' | 'test';

export interface Rival {
  character: Character;
  row: number;
  column: number;
}

const NAMES: Record<Opponents, string> = {
  monsters: 'Monsters',
  starter: 'Starter party',
  test: 'Test party',
};

/** The party a choice pits the player's characters against, in its own formation. */
export function rivalsFor(opponents: Opponents): Rival[] {
  if (opponents === 'monsters') return [];
  return opponents === 'starter' ? data.content.starterParty : data.content.testParty;
}

const ROWS = ['Front row', 'Rear row'];

/** Whether the enemy side is monsters or one of the content's ready-made parties. */
export function RivalPicker(props: { value: Opponents; onChange: (value: Opponents) => void }) {
  const rivals = rivalsFor(props.value);
  return (
    <section class="panel rival-picker" aria-label="Opponents">
      <h2>Opponents</h2>
      <div class="choice" role="radiogroup" aria-label="Opponents">
        {(Object.keys(NAMES) as Opponents[]).map((o) => (
          <label key={o}>
            <input
              type="radio"
              name="opponents"
              checked={props.value === o}
              onChange={() => props.onChange(o)}
            />{' '}
            {NAMES[o]}
          </label>
        ))}
      </div>
      {rivals.length > 0 && (
        <>
          {ROWS.map((name, row) => {
            const here = rivals.filter((r) => r.row === row).sort((a, b) => a.column - b.column);
            return (
              here.length > 0 && (
                <p key={name}>
                  {name}: {here.map((r) => r.character.name).join(', ')}
                </p>
              )
            );
          })}
          <p class="hint">They choose their own actions and fight to the end.</p>
        </>
      )}
    </section>
  );
}
