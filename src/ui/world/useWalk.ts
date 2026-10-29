import { useEffect, useState } from 'preact/hooks';
import { walkStep, type WalkResult } from '../../game/dungeon/walk.ts';
import type { World } from '../../game/world/types.ts';
import type { Cell } from '../../rules/grid.ts';
import { data } from '../builder/data.ts';

/** Time between steps of a walk: a turn and a step's motion play out (dungeon-view.css). */
const STEP_MS = 260;

/**
 * Walking to a square (src/game/dungeon/walk.ts), a step at a time so the view keeps up. Any key or
 * press stops it, and so does whatever the step meets; `onStep` hears every step.
 */
export function useWalk(w: World, onStep: (r: WalkResult) => void) {
  const [walk, setWalk] = useState<{ to: Cell; n: number } | null>(null);
  useEffect(() => {
    if (!walk) return;
    const stop = () => setWalk(null);
    const timer = setTimeout(() => {
      const r = walkStep(w, data, walk.to);
      onStep(r);
      setWalk(r.kind === 'moved' ? { to: walk.to, n: walk.n + 1 } : null);
    }, STEP_MS);
    addEventListener('keydown', stop);
    addEventListener('pointerdown', stop);
    return () => {
      clearTimeout(timer);
      removeEventListener('keydown', stop);
      removeEventListener('pointerdown', stop);
    };
  }, [walk]);
  return {
    walking: walk !== null,
    // After the press that asked for it, so that press doesn't stop it.
    walkTo: (to: Cell) => setTimeout(() => setWalk({ to, n: 0 })),
  };
}
