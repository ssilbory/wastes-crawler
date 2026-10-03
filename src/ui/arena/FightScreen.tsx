import { useRef, useState } from 'preact/hooks';
import type { DefaultPreset } from '../../data/schemas/index.ts';
import { takeTurn, type BattleResult } from '../../game/combat/battle.ts';
import { commandsFor } from '../../game/combat/commands.ts';
import type { Action, Battle, Combatant } from '../../game/combat/types.ts';
import { outcomeText, roundsText, sideView } from '../../render/arena-view.ts';
import { CommandMenu } from './CommandMenu.tsx';
import { BattleLog, Field } from './Field.tsx';
import {
  autoResolve,
  batch,
  nextCommand,
  presetAction,
  startBattle,
  type Changes,
  type FightSetup,
  type Presets,
} from './fight.ts';

interface Session {
  battle: Battle;
  actor: Combatant | null;
  changes: Changes;
  result: BattleResult | null;
}

function begin(setup: FightSetup & { kind: 'party' }): Session {
  const battle = startBattle(setup);
  let actor: Combatant | null = null;
  const { changes, result } = batch(battle, () => (actor = nextCommand(battle)));
  return { battle, actor, changes: { ...changes, logFrom: 0 }, result };
}

export function FightScreen(props: {
  setup: FightSetup & { kind: 'party' };
  onPreset: (rosterId: string, preset: DefaultPreset) => void;
  onLeave: () => void;
}) {
  const [session, setSession] = useState<Session>(() => begin(props.setup));
  const [selected, setSelected] = useState<string | null>(null);
  const [presets, setPresets] = useState<Record<string, DefaultPreset>>(() =>
    Object.fromEntries(props.setup.party.map((p, i) => [`pc-${i}`, p.entry.defaultAction])),
  );
  const last = useRef(new Map<string, Action>());
  const p: Presets = { preset: (id) => presets[id] ?? 'auto', last: last.current };
  const { battle: b, actor, changes, result } = session;

  const run = (fn: (actor: Combatant | null) => Combatant | null) => {
    let next: Combatant | null = null;
    const out = batch(b, () => (next = fn(actor)));
    setSelected(null);
    setSession({ battle: b, actor: next, ...out });
  };
  const command = (a: Combatant, action: Action) => {
    last.current.set(a.id, action);
    takeTurn(b, a, () => action);
    return nextCommand(b);
  };
  const choose = (action: Action) => run((a) => (a ? command(a, action) : null));
  const useDefault = () => run((a) => (a ? command(a, presetAction(b, a, p)) : null));
  const defaultsForRound = () =>
    run((a) => {
      const round = b.round;
      let next = a;
      while (next && b.round === round) next = command(next, presetAction(b, next, p));
      return next;
    });
  const auto = () =>
    run(() => {
      autoResolve(b, p);
      return null;
    });

  const commands = actor && !result ? commandsFor(b, actor) : [];
  const current = commands.find((c) => c.key === selected);
  const targetIds = new Set(current?.choices.flatMap((c) => (c.targetId ? [c.targetId] : [])));
  const pickTarget = (id: string) => {
    const ch = current?.choices.find((c) => c.targetId === id);
    if (ch) choose(ch.action);
  };
  const setPreset = (preset: DefaultPreset) => {
    if (!actor) return;
    setPresets({ ...presets, [actor.id]: preset });
    const index = Number(actor.id.slice('pc-'.length));
    const entry = props.setup.party[index]?.entry;
    if (entry) props.onPreset(entry.id, preset);
  };

  return (
    <div class="fight">
      <div class="fight-bar">
        <span class="round">Round {Math.min(b.round, 100)}</span>
        {!result && (
          <>
            <button type="button" onClick={defaultsForRound}>
              Defaults for the round
            </button>
            <button type="button" onClick={auto}>
              Auto-resolve
            </button>
          </>
        )}
        <button type="button" class="secondary" onClick={props.onLeave}>
          {result ? 'New fight' : 'Leave fight'}
        </button>
      </div>
      {result && (
        <p class="result" role="status">
          {outcomeText(b, result.outcome)} {roundsText(result.rounds)};{' '}
          {result.deaths === 0 ? 'no one died' : `${result.deaths} dead`}.
        </p>
      )}
      <div class="fight-main">
        <Field
          far={sideView(b, 'enemy')}
          near={sideView(b, 'party')}
          activeId={actor?.id ?? null}
          targetIds={targetIds}
          changedIds={changes.ids}
          onPick={pickTarget}
        />
        <div class="fight-side">
          {actor && !result && (
            <CommandMenu
              actorName={actor.name}
              commands={commands}
              selected={selected}
              preset={p.preset(actor.id)}
              onSelect={setSelected}
              onChoose={choose}
              onPreset={setPreset}
              onDefault={useDefault}
            />
          )}
          <BattleLog lines={b.log ?? []} from={changes.logFrom} />
        </div>
      </div>
    </div>
  );
}
