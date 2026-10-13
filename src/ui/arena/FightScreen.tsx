import { useEffect, useRef, useState } from 'preact/hooks';
import type { DefaultPreset } from '../../data/schemas/index.ts';
import { takeTurn, type BattleResult } from '../../game/combat/battle.ts';
import { commandsFor } from '../../game/combat/commands.ts';
import type { Action, Battle, Combatant } from '../../game/combat/types.ts';
import { outcomeText, roundsText, sideView } from '../../render/arena-view.ts';
import { turnOrder } from '../../render/fight-fx.ts';
import { oddsText } from '../../render/fight-odds.ts';
import { roundDelay } from '../../game/settings.ts';
import { data } from '../builder/data.ts';
import { getSettings } from '../settings-store.ts';
import { play } from '../sound.ts';
import { CommandMenu } from './CommandMenu.tsx';
import { RescuePanel } from './RescuePanel.tsx';
import { TurnStrip } from './TurnStrip.tsx';
import { BattleLog, Field } from './Field.tsx';
import {
  autoResolve,
  batch,
  nextCommand,
  presetAction,
  type Changes,
  type Presets,
} from './fight.ts';
import type { KnownFoe } from '../../render/bestiary-view.ts';
import { KnownFoes } from '../world/KnownFoes.tsx';

interface Session {
  battle: Battle;
  actor: Combatant | null;
  changes: Changes;
  result: BattleResult | null;
}

function begin(battle: Battle): Session {
  let actor: Combatant | null = null;
  const { changes, result } = batch(battle, () => (actor = nextCommand(battle)));
  return { battle, actor, changes: { ...changes, logFrom: 0 }, result };
}

/**
 * A party fight with the command menu: the arena's, and the overland map's encounters. The battle
 * is created once; PC `pc-N` uses `presets[N]` as its default action.
 */
export function FightScreen(props: {
  createBattle: () => Battle;
  presets: DefaultPreset[];
  onPreset?: (index: number, preset: DefaultPreset) => void;
  /** Whether the player may walk away mid-fight (the arena), or must see it through. */
  canLeave: boolean;
  doneLabel: string;
  /** Monsters the party has named with Know, shown with their statistics. */
  known?: KnownFoe[];
  /** The XP a win earns, added to the end of the log once the party wins. */
  xp?: Promise<string> | undefined;
  /** No fight, only the dying to tend: a trap's fallen (trap-falls.ts). */
  aftermath?: boolean;
  onDone: (result: BattleResult | null) => void;
}) {
  const [session, setSession] = useState<Session>(() => begin(props.createBattle()));
  const [selected, setSelected] = useState<string | null>(null);
  const [presets, setPresets] = useState<Record<string, DefaultPreset>>(() =>
    Object.fromEntries(props.presets.map((preset, i) => [`pc-${i}`, preset])),
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
  const tend = (step: () => void) =>
    run(() => {
      step();
      return null;
    });
  const choose = (action: Action) => run((a) => (a ? command(a, action) : null));
  const useDefault = () => run((a) => (a ? command(a, presetAction(b, a, p)) : null));
  const defaultsForRound = () =>
    run((a) => {
      const round = b.round;
      let next = a;
      while (next && b.round === round) next = command(next, presetAction(b, next, p));
      return next;
    });
  // Auto-resolve plays out at the speed in the settings: all at once, or a round at a time.
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [xpLine, setXpLine] = useState<string | null>(null);
  const auto = () => {
    if (roundDelay(data, getSettings()) > 0) {
      setAutoPlaying(true);
      return;
    }
    run(() => {
      autoResolve(b, p);
      return null;
    });
  };
  useEffect(() => {
    if (!autoPlaying || b.outcome) return;
    const timer = setTimeout(defaultsForRound, roundDelay(data, getSettings()));
    return () => clearTimeout(timer);
  });
  useEffect(() => {
    if (result) play(result.outcome === 'party' || result.battle.escaped ? 'win' : 'lose');
    if (result?.outcome !== 'party' || !props.xp) return;
    // The line lands only while this fight is on screen; a failed simulation just leaves it off.
    let live = true;
    props.xp
      .then((line) => {
        if (live) setXpLine(line);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [result]);

  const commands = actor && !result ? commandsFor(b, actor) : [];
  const current = commands.find((c) => c.key === selected);
  const targetIds = new Set(current?.choices.flatMap((c) => (c.targetId ? [c.targetId] : [])));
  const odds = (action: Action) => (actor ? oddsText(b, actor, action) : null);
  const notes = new Map(
    current?.choices.flatMap((c) => {
      const text = c.targetId ? odds(c.action) : null;
      return c.targetId && text ? [[c.targetId, text] as const] : [];
    }),
  );
  const pickTarget = (id: string) => {
    const ch = current?.choices.find((c) => c.targetId === id);
    if (ch) choose(ch.action);
  };
  const setPreset = (preset: DefaultPreset) => {
    if (!actor) return;
    setPresets({ ...presets, [actor.id]: preset });
    // A companion under Mind Call (1.5.4) keeps its preset for this fight only.
    if (actor.kind === 'pc') props.onPreset?.(Number(actor.id.slice('pc-'.length)), preset);
  };

  return (
    <div class="fight">
      <div class="fight-bar">
        <span class="round">Round {Math.min(b.round, 100)}</span>
        {!b.outcome && (
          <>
            <button type="button" onClick={defaultsForRound}>
              Defaults for the round
            </button>
            <button type="button" onClick={auto}>
              Auto-resolve
            </button>
          </>
        )}
        {(result || props.canLeave) && (
          <button
            type="button"
            class={result ? undefined : 'secondary'}
            onClick={() => props.onDone(result)}
          >
            {result ? props.doneLabel : 'Leave fight'}
          </button>
        )}
      </div>
      {result && (
        <p class="result" role="status">
          {props.aftermath
            ? `${result.deaths === 0 ? 'The fallen live' : `${result.deaths} dead`}.`
            : `${outcomeText(b, result.outcome)} ${roundsText(result.rounds)}; ${
                result.deaths === 0 ? 'no one died' : `${result.deaths} dead`
              }.`}
        </p>
      )}
      {!b.outcome && !props.aftermath && (
        <TurnStrip turns={turnOrder(b, actor?.id ?? null)} round={b.round} />
      )}
      <div class="fight-main">
        <Field
          far={sideView(b, 'enemy')}
          near={sideView(b, 'party')}
          activeId={actor?.id ?? null}
          targetIds={targetIds}
          changedIds={changes.ids}
          floats={changes.floats}
          batchKey={changes.logFrom}
          notes={notes}
          onPick={pickTarget}
          nearOnly={props.aftermath ?? false}
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
              odds={odds}
              onPreset={setPreset}
              onDefault={useDefault}
            />
          )}
          {b.outcome && !result && <RescuePanel battle={b} onTend={tend} />}
          <KnownFoes foes={props.known ?? []} />
          <BattleLog
            lines={[...(b.log ?? []), ...(xpLine ? [xpLine] : [])]}
            from={changes.logFrom}
          />
        </div>
      </div>
    </div>
  );
}
