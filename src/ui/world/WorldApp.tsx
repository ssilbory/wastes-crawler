import { useRef, useState } from 'preact/hooks';
import { newWorld, type Recruit } from '../../game/world/new-world.ts';
import { encounterBattle, type WorldBattle } from '../../game/world/fight.ts';
import { passQuarter, settleByFighting, settleByLeaving } from '../../game/world/quarter.ts';
import { parseWorld, serializeWorld } from '../../game/world/save.ts';
import type { World } from '../../game/world/types.ts';
import { createRng } from '../../rules/rng.ts';
import { FightScreen } from '../arena/FightScreen.tsx';
import { data, freshRng } from '../builder/data.ts';
import { loadRoster, loadWorldText, saveWorldText } from '../storage.ts';
import { MapScreen } from './MapScreen.tsx';
import { StartScreen } from './StartScreen.tsx';

function download(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'world-save.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function WorldApp() {
  const [roster] = useState(() => loadRoster().entries);
  const world = useRef<World | null>(null);
  const [version, setVersion] = useState(0);
  const [screen, setScreen] = useState<'start' | 'map'>('start');
  const [fight, setFight] = useState<WorldBattle | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [hasSave, setHasSave] = useState(() => loadWorldText() !== null);

  const changed = () => {
    if (world.current) saveWorldText(serializeWorld(world.current));
    setVersion((v) => v + 1);
  };
  const open = (text: string | null) => {
    const loaded = text === null ? null : parseWorld(text, data);
    if (!loaded?.ok) {
      setErrors(loaded ? loaded.errors : ['There is no saved world.']);
      return;
    }
    world.current = loaded.world;
    setErrors([]);
    setScreen('map');
    changed();
  };
  const start = (party: Recruit[], seed: string) => {
    world.current = newWorld(data, seed.trim() ? createRng(seed.trim()) : freshRng(), party);
    setErrors([]);
    setScreen('map');
    changed();
  };

  const w = world.current;
  if (screen === 'start' || !w)
    return (
      <StartScreen
        roster={roster}
        hasSave={hasSave}
        errors={errors}
        onContinue={() => open(loadWorldText())}
        onNew={start}
        onImport={(file) => void file.text().then(open)}
      />
    );
  if (fight)
    return (
      <div class="arena">
        <FightScreen
          createBattle={() => fight.battle}
          presets={fight.memberIds.map(
            (id) => w.members.find((m) => m.id === id)?.defaultAction ?? 'auto',
          )}
          onPreset={(i, preset) => {
            const m = w.members.find((x) => x.id === fight.memberIds[i]);
            if (m) m.defaultAction = preset;
          }}
          canLeave={false}
          doneLabel="Back to the map"
          onDone={(result) => {
            if (result) settleByFighting(w, data, fight, result);
            setFight(null);
            changed();
          }}
        />
      </div>
    );
  return (
    <MapScreen
      world={w}
      version={version}
      onChange={changed}
      onPass={(plan) => {
        passQuarter(w, data, plan);
        changed();
      }}
      onFight={() => {
        setFight(encounterBattle(w, data));
        changed();
      }}
      onLeave={() => {
        settleByLeaving(w, data);
        changed();
      }}
      onExport={() => download(serializeWorld(w))}
      onAbandon={() => {
        if (!confirm('Abandon this world? The save is deleted.')) return;
        saveWorldText(null);
        setHasSave(false);
        world.current = null;
        setScreen('start');
      }}
    />
  );
}
