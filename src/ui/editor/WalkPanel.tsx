import { useEffect, useRef, useState } from 'preact/hooks';
import type { Dungeon } from '../../data/schemas/index.ts';
import {
  startWalk,
  walkMap,
  walkStairs,
  walkStep,
  walkTurn,
  type Walk,
  type WalkStep,
} from '../../game/dungeon/sandbox.ts';
import { actionForKey } from '../../game/settings.ts';
import { sandboxView } from '../../render/dungeon-view.ts';
import { walkLight } from '../../render/dungeon-light.ts';
import { DungeonView } from '../world/DungeonView.tsx';
import { isShortcut } from '../keys.ts';
import { getSettings } from '../settings-store.ts';

/** The editor's test walk: the edited geometry in first person, with the dungeon keys. */
export function WalkPanel(props: {
  dungeon: Dungeon;
  level: string;
  ready: boolean;
  walk: Walk | null;
  onWalk: (w: Walk | null) => void;
  onLevel: (id: string) => void;
}) {
  const { walk } = props;
  // Keys can come faster than renders, so moves read and write the latest walk.
  const latest = useRef(walk);
  latest.current = walk;
  const setWalk = (next: Walk | null) => {
    latest.current = next;
    props.onWalk(next);
  };
  const edited = props.dungeon;
  const [bump, setBump] = useState<string | null>(null);
  const map = walk ? walkMap(edited, walk.level) : null;
  const move = (dir: WalkStep) => {
    const now = latest.current;
    const here = now ? walkMap(edited, now.level) : null;
    if (!now || !here) return;
    const next = walkStep(here, now, dir);
    setBump(next ? null : 'A wall blocks the way.');
    if (next) setWalk(next);
  };
  useEffect(() => {
    if (!walk) return;
    const onKey = (e: KeyboardEvent) => {
      const action = isShortcut(e) ? actionForKey(getSettings(), e.key) : null;
      if (!action || action === 'search' || action === 'stairs') return;
      e.preventDefault();
      const now = latest.current as Walk;
      if (action === 'turn-left') setWalk(walkTurn(now, 'left'));
      else if (action === 'turn-right') setWalk(walkTurn(now, 'right'));
      else move(action === 'step-left' ? 'left' : action === 'step-right' ? 'right' : action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <section class="panel" aria-label="Test walk">
      <h2>Test walk</h2>
      {!walk ? (
        <button
          type="button"
          disabled={!props.ready}
          onClick={() => setWalk(startWalk(edited, props.level))}
        >
          Walk this level
        </button>
      ) : (
        <>
          <DungeonView
            panels={
              map
                ? sandboxView(
                    map,
                    walk.at,
                    walk.facing,
                    edited.levels.find((l) => l.id === walk.level)?.traps,
                    edited.levels.find((l) => l.id === walk.level)?.furniture,
                  )
                : []
            }
            light={walkLight()}
            label="Test walk view"
          />
          <p class="bump" aria-live="polite">
            {bump ?? ' '}
          </p>
          <div class="walk-buttons">
            <button type="button" onClick={() => setWalk(walkTurn(walk, 'left'))}>
              Turn left
            </button>
            <button type="button" onClick={() => move('forward')}>
              Forward
            </button>
            <button type="button" onClick={() => setWalk(walkTurn(walk, 'right'))}>
              Turn right
            </button>
            <button type="button" onClick={() => move('back')}>
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                const next = walkStairs(edited, walk);
                setBump(next ? null : 'No stairs to another level here.');
                if (next) {
                  setWalk(next);
                  props.onLevel(next.level);
                }
              }}
            >
              Take the stairs
            </button>
            <button type="button" class="secondary" onClick={() => setWalk(null)}>
              Stop walking
            </button>
          </div>
        </>
      )}
    </section>
  );
}
