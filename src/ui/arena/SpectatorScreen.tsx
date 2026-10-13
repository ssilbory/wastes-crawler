import { useEffect, useState } from 'preact/hooks';
import { runRound, type BattleResult } from '../../game/combat/battle.ts';
import type { Battle } from '../../game/combat/types.ts';
import { outcomeText, roundsText, sideTitles, sideView } from '../../render/arena-view.ts';
import { BattleLog, Field } from './Field.tsx';
import { batch, startBattle, type Changes, type FightSetup } from './fight.ts';

interface Session {
  battle: Battle;
  changes: Changes;
  result: BattleResult | null;
}

const SPEEDS = [
  { label: 'Slow', ms: 1500 },
  { label: 'Normal', ms: 700 },
  { label: 'Fast', ms: 250 },
];

export function SpectatorScreen(props: {
  setup: FightSetup & { kind: 'spectator' };
  onLeave: () => void;
}) {
  const [session, setSession] = useState<Session>(() => ({
    battle: startBattle(props.setup),
    changes: { logFrom: 0, ids: new Set(), floats: new Map() },
    result: null,
  }));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);
  const { battle: b, changes, result } = session;

  const run = (fn: () => void) => setSession({ battle: b, ...batch(b, fn) });
  const step = () => run(() => runRound(b));
  const toEnd = () =>
    run(() => {
      while (!b.outcome) runRound(b);
    });

  useEffect(() => {
    if (!playing || result) return;
    const timer = setInterval(() => {
      if (!b.outcome) setSession({ battle: b, ...batch(b, () => runRound(b)) });
    }, speed);
    return () => clearInterval(timer);
  }, [playing, speed, result, b]);

  return (
    <div class="fight">
      <div class="fight-bar">
        <span class="round">Round {Math.min(b.round, 100)}</span>
        {!result && (
          <>
            <button type="button" onClick={() => setPlaying(!playing)}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <button type="button" disabled={playing} onClick={step}>
              Step round
            </button>
            <button type="button" onClick={toEnd}>
              Run to the end
            </button>
            <label>
              Speed{' '}
              <select
                value={speed}
                onChange={(e) => setSpeed(Number((e.target as HTMLSelectElement).value))}
              >
                {SPEEDS.map((s) => (
                  <option key={s.ms} value={s.ms}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <button type="button" class="secondary" onClick={props.onLeave}>
          {result ? 'New fight' : 'Leave fight'}
        </button>
      </div>
      {result && (
        <p class="result" role="status">
          {outcomeText(b, result.outcome)} {roundsText(result.rounds)}.
        </p>
      )}
      <div class="fight-main">
        <Field
          far={sideView(b, 'enemy')}
          near={sideView(b, 'party')}
          changedIds={changes.ids}
          floats={changes.floats}
          batchKey={changes.logFrom}
        />
        <div class="fight-side">
          <BattleLog
            lines={b.log ?? []}
            from={changes.logFrom}
            sides={b.logSides}
            names={sideTitles(b)}
          />
        </div>
      </div>
    </div>
  );
}
