import type { ComponentChildren } from 'preact';
import type { PartyMove as Move } from '../../render/dungeon-motion.ts';

/** The pad's six moves, in the order of the keys under the left hand (Q W E over A S D). */
const PAD: { move: Move; label: string; icon: 'arrow' | 'turn'; turn: number; flip?: true }[] = [
  { move: { step: 'left' }, label: 'Step left', icon: 'arrow', turn: 270 },
  { move: { step: 'forward' }, label: 'Forward', icon: 'arrow', turn: 0 },
  { move: { step: 'right' }, label: 'Step right', icon: 'arrow', turn: 90 },
  { move: { turn: 'left' }, label: 'Turn left', icon: 'turn', turn: 0, flip: true },
  { move: { step: 'back' }, label: 'Back', icon: 'arrow', turn: 180 },
  { move: { turn: 'right' }, label: 'Turn right', icon: 'turn', turn: 0 },
];

const ICONS = {
  // A straight arrow pointing up, turned to face its way.
  arrow: 'M12 3 5 10h4.5v11h5V10H19Z',
  // An arrow bending round to the right.
  turn: 'M6 21V12a6 6 0 0 1 6-6h3V2l6 6.5-6 6.5v-4h-3a1.5 1.5 0 0 0-1.5 1.5V21Z',
};

/**
 * The movement pad under the dungeon view: an arrow for each move, with its word beside it where
 * there is room for one (on a phone the arrows stand alone; mobile.css). Each button is named by
 * its word, so a screen reader and the keys' help say the same thing.
 */
export function MovePad(props: { onMove: (m: Move) => void }) {
  return (
    <div class="moves" role="group" aria-label="Move">
      {PAD.map((p) => (
        <button
          key={p.label}
          type="button"
          aria-label={p.label}
          title={p.label}
          onClick={() => props.onMove(p.move)}
        >
          <svg class="move-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d={ICONS[p.icon]}
              transform={`rotate(${p.turn} 12 12)${p.flip ? ' translate(24 0) scale(-1 1)' : ''}`}
            />
          </svg>
          <span class="move-word">{p.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * The controls beside the dungeon view: why the last move was refused, the pad, and whatever else
 * the party can do here (search, dig, disarm, the stairs), passed in as `children`.
 */
export function DungeonControls(props: {
  bump: string | null;
  onMove: (m: Move) => void;
  children: ComponentChildren;
}) {
  return (
    <div class="dungeon-controls">
      <p class="bump" aria-live="polite">
        {props.bump ?? ' '}
      </p>
      <MovePad onMove={props.onMove} />
      <div class="actions" role="group" aria-label="Explore">
        {props.children}
      </div>
    </div>
  );
}
