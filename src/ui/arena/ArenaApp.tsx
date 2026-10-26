import { useRef, useState } from 'preact/hooks';
import type { DefaultPreset } from '../../data/schemas/index.ts';
import { importCharacter } from '../../game/character/io.ts';
import {
  removeFromRoster,
  setDefaultAction,
  type RosterEntry,
} from '../../game/character/roster.ts';
import { importToRoster } from '../../game/character/roster-edit.ts';
import { data, freshRng } from '../builder/data.ts';
import { loadRoster, readText, saveRoster, unreadable } from '../storage.ts';
import { startBattle, type FightSetup, type PartySlot } from './fight.ts';
import { FightScreen } from './FightScreen.tsx';
import { MonsterPicker } from './MonsterPicker.tsx';
import { RivalPicker, rivalsFor, type Opponents } from './RivalPicker.tsx';
import { PartySetup, type Placement } from './PartySetup.tsx';
import { RosterPanel } from './RosterPanel.tsx';
import { SpectatorScreen } from './SpectatorScreen.tsx';
import { panelProps, Tabs } from '../tabs.tsx';

type Mode = 'party' | 'spectator';
const emptyRows = (): string[][] => [[], [], []];
const hasMonsters = (rows: string[][]) => rows.some((r) => r.length > 0);

export function ArenaApp() {
  const [initial] = useState(loadRoster);
  const [roster, setRosterState] = useState<RosterEntry[]>(initial.entries);
  const [errors, setErrors] = useState<string[]>(initial.errors);
  const [mode, setMode] = useState<Mode>('party');
  const [placement, setPlacement] = useState<Placement>({});
  const [enemies, setEnemies] = useState(emptyRows);
  const [opponents, setOpponents] = useState<Opponents>('monsters');
  const [left, setLeft] = useState(emptyRows);
  const [right, setRight] = useState(emptyRows);
  const [seed, setSeed] = useState('');
  const [fight, setFight] = useState<FightSetup | null>(null);

  // The roster as it is right now, for an import that finishes reading after other edits.
  const rosterNow = useRef(initial.entries);
  const setRoster = (next: RosterEntry[]) => {
    rosterNow.current = next;
    setRosterState(next);
    if (!saveRoster(next))
      setErrors(['Browser storage is unavailable, so the roster won’t be saved.']);
  };
  const onImport = async (files: FileList) => {
    const rng = freshRng();
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      const text = await readText(file);
      if (text === null) {
        problems.push(unreadable(file));
        continue;
      }
      const result = importCharacter(text, data);
      if (result.ok) setRoster(importToRoster(rosterNow.current, result.character, rng));
      else problems.push(...result.errors.map((e) => `${file.name}: ${e}`));
    }
    setErrors(problems);
  };
  const onRemove = (id: string) => {
    setRoster(removeFromRoster(roster, id));
    setPlacement(Object.fromEntries(Object.entries(placement).filter(([, v]) => v !== id)));
  };
  const onPreset = (id: string, preset: DefaultPreset) =>
    setRoster(setDefaultAction(roster, id, preset));

  const party: PartySlot[] = Object.entries(placement).flatMap(([key, id]) => {
    const entry = roster.find((e) => e.id === id);
    const [row, column] = key.split('-').map(Number) as [number, number];
    return entry ? [{ entry, row, column }] : [];
  });
  /** What the fight still needs, or null when it can start. */
  const missing =
    mode === 'party'
      ? party.length === 0
        ? 'Put a character in the formation to start.'
        : opponents === 'monsters' && !hasMonsters(enemies)
          ? 'Add a monster to the enemies to start.'
          : null
      : !hasMonsters(left) || !hasMonsters(right)
        ? 'Add a monster to each side to start.'
        : null;
  const ready = missing === null;
  const start = () =>
    setFight(
      mode === 'party'
        ? opponents === 'monsters'
          ? { kind: 'party', party, enemies, rivals: [], seed }
          : { kind: 'party', party, enemies: emptyRows(), rivals: rivalsFor(opponents), seed }
        : { kind: 'spectator', left, right, seed },
    );

  if (fight?.kind === 'party')
    return (
      <div class="arena">
        <FightScreen
          createBattle={() => startBattle(fight)}
          presets={fight.party.map((p) => p.entry.defaultAction)}
          onPreset={(i, preset) => {
            const entry = fight.party[i]?.entry;
            if (entry) onPreset(entry.id, preset);
          }}
          canLeave={true}
          doneLabel="New fight"
          onDone={() => setFight(null)}
        />
      </div>
    );
  if (fight?.kind === 'spectator')
    return (
      <div class="arena">
        <SpectatorScreen setup={fight} onLeave={() => setFight(null)} />
      </div>
    );

  return (
    <div class="arena">
      <header>
        <h1>Arena</h1>
        <Tabs
          id="arena-mode"
          label="Arena mode"
          tabs={[
            { key: 'party', label: 'Party fight' },
            { key: 'spectator', label: 'Monster vs monster' },
          ]}
          selected={mode}
          onSelect={setMode}
        />
      </header>
      {errors.length > 0 && (
        <ul class="errors" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <main class="arena-setup" {...panelProps('arena-mode', mode)}>
        {mode === 'party' ? (
          <>
            <RosterPanel
              entries={roster}
              onImport={(files) => void onImport(files)}
              onRemove={onRemove}
              onPreset={onPreset}
            />
            <PartySetup entries={roster} placement={placement} onChange={setPlacement} />
            {/* The opponents and the monsters among them share a column. */}
            <div class="arena-column">
              <RivalPicker value={opponents} onChange={setOpponents} />
              {opponents === 'monsters' && (
                <MonsterPicker title="Enemies" rows={enemies} onChange={setEnemies} />
              )}
            </div>
          </>
        ) : (
          <>
            <MonsterPicker title="Left side" rows={left} onChange={setLeft} />
            <MonsterPicker title="Right side" rows={right} onChange={setRight} />
          </>
        )}
      </main>
      <div class="start-row">
        {missing && <span class="hint">{missing}</span>}
        <label>
          Seed (optional){' '}
          <input value={seed} onInput={(e) => setSeed((e.target as HTMLInputElement).value)} />
        </label>
        <button type="button" class="create" disabled={!ready} onClick={start}>
          Start fight
        </button>
      </div>
    </div>
  );
}
