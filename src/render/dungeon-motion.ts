// How the first-person view moves after the party does (docs/presentation-plan.md, V4): it grows
// on a step forward, shrinks on a step back, slides on a sidestep, swings on a turn, and shakes when
// a wall stops the party. Presentation only; the view itself is redrawn from the new place.
export type Motion =
  'forward' | 'back' | 'left' | 'right' | 'turn-left' | 'turn-right' | 'turn-around' | 'bump';

export type PartyMove =
  { step: 'forward' | 'back' | 'left' | 'right' } | { turn: 'left' | 'right' | 'around' };

/** The motion for a move, or a bump when it was refused. */
export function motionOf(m: PartyMove, ok: boolean): Motion {
  if (!ok) return 'bump';
  return 'step' in m ? m.step : `turn-${m.turn}`;
}
