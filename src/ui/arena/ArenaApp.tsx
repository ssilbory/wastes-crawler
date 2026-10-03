import { useState } from 'preact/hooks';
import type { DefaultPreset } from '../../data/schemas/index.ts';
import { importCharacter } from '../../game/character/io.ts';
import {
  addToRoster,
  removeFromRoster,
  setDefaultAction,
  type RosterEntry,
} from '../../game/character/roster.ts';
import { data } from '../builder/data.ts';
import { loadRoster, saveRoster } from '../storage.ts';
import type { FightSetup, PartySlot } from './fight.ts';
import { FightScreen } from './FightScreen.tsx';
import { MonsterPicker } from './MonsterPicker.tsx';
import { PartySetup, type Placement } from './PartySetup.tsx';
import { RosterPanel } from './RosterPanel.tsx';
import { SpectatorScreen } from './SpectatorScreen.tsx';

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
  const [left, setLeft] = useState(emptyRows);
  const [right, setRight] = useState(emptyRows);
  const [seed, setSeed] = useState('');
  const [fight, setFight] = useState<FightSetup | null>(null);

  const setRoster = (next: RosterEntry[]) => {
    setRosterState(next);
    if (!saveRoster(next))
      setErrors(['Browser storage is unavailable, so the roster won’t be saved.']);
  };
  const onImport = async (files: FileList) => {
    let next = roster;
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      const result = importCharacter(await file.text(), data);
      if (result.ok) next = addToRoster(next, result.character);
      else problems.push(...result.errors.map((e) => `${file.name}: ${e}`));
    }
    setRoster(next);
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
  const ready =
    mode === 'party'
      ? party.length > 0 && hasMonsters(enemies)
      : hasMonsters(left) && hasMonsters(right);
  const start = () =>
    setFight(
      mode === 'party'
        ? { kind: 'party', party, enemies, seed }
        : { kind: 'spectator', left, right, seed },
    );

  if (fight?.kind === 'party')
    return (
      <div class="arena">
        <FightScreen setup={fight} onPreset={onPreset} onLeave={() => setFight(null)} />
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
        <div class="tabs" role="tablist">
          {(['party', 'spectator'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
            >
              {m === 'party' ? 'Party fight' : 'Monster vs monster'}
            </button>
          ))}
        </div>
      </header>
      {errors.length > 0 && (
        <ul class="errors" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <main class="arena-setup">
        {mode === 'party' ? (
          <>
            <RosterPanel
              entries={roster}
              onImport={(files) => void onImport(files)}
              onRemove={onRemove}
              onPreset={onPreset}
            />
            <PartySetup entries={roster} placement={placement} onChange={setPlacement} />
            <MonsterPicker title="Enemies" rows={enemies} onChange={setEnemies} />
          </>
        ) : (
          <>
            <MonsterPicker title="Left side" rows={left} onChange={setLeft} />
            <MonsterPicker title="Right side" rows={right} onChange={setRight} />
          </>
        )}
      </main>
      <div class="start-row">
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
