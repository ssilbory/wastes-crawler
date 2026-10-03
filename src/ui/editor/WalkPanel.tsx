import { useEffect, useState } from 'preact/hooks';
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
import { sandboxView, VIEW_HEIGHT, VIEW_WIDTH } from '../../render/dungeon-view.ts';
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
  const { walk, onWalk: setWalk } = props;
  const edited = props.dungeon;
  const [bump, setBump] = useState<string | null>(null);
  const map = walk ? walkMap(edited, walk.level) : null;
  const move = (dir: WalkStep) => {
    if (!walk || !map) return;
    const next = walkStep(map, walk, dir);
    setBump(next ? null : 'A wall blocks the way.');
    if (next) setWalk(next);
  };
  useEffect(() => {
    if (!walk) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, select, textarea')) return;
      const action = actionForKey(getSettings(), e.key);
      if (!action || action === 'search') return;
      e.preventDefault();
      if (action === 'turn-left') setWalk(walkTurn(walk, 'left'));
      else if (action === 'turn-right') setWalk(walkTurn(walk, 'right'));
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
          <svg
            class="dungeon-view"
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            role="img"
            aria-label="Test walk view"
          >
            <rect class="ceiling" width={VIEW_WIDTH} height={VIEW_HEIGHT / 2} />
            <rect class="floor" y={VIEW_HEIGHT / 2} width={VIEW_WIDTH} height={VIEW_HEIGHT / 2} />
            {map &&
              sandboxView(map, walk.at, walk.facing).map((p) => (
                <g key={p.key} class={`panel-${p.kind}`}>
                  <polygon points={p.points} fill={p.fill} />
                  {p.frame && <polygon class="door-frame" points={p.frame} />}
                </g>
              ))}
          </svg>
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
