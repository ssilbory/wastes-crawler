import { useRef, useState } from 'preact/hooks';
import { newWorld, type Recruit } from '../../game/world/new-world.ts';
import type { BattleResult } from '../../game/combat/battle.ts';
import { settleBout } from '../../game/world/arena.ts';
import { coachQuarter } from '../../game/world/coach.ts';
import { difficultySeed } from '../../game/world/difficulty.ts';
import { encounterBattle, type WorldBattle } from '../../game/world/fight.ts';
import { passQuarter, settleByFighting, settleByLeaving } from '../../game/world/quarter.ts';
import { addStarterParty } from '../../game/character/roster.ts';
import { mergeRoster, parseSave, serializeBundle } from '../../game/world/bundle.ts';
import { serializeWorld } from '../../game/world/save.ts';
import { slotSummary } from '../../render/save-view.ts';
import type { World } from '../../game/world/types.ts';
import { createRng } from '../../rules/rng.ts';
import { FightScreen } from '../arena/FightScreen.tsx';
import { data, freshRng } from '../builder/data.ts';
import {
  SLOTS,
  activeSlot,
  loadRoster,
  loadWorldText,
  saveRoster,
  saveWorldText,
  setActiveSlot,
  type Slot,
} from '../storage.ts';
import { TownScreen } from '../town/TownScreen.tsx';
import { assess } from './assess.ts';
import { MapScreen } from './MapScreen.tsx';
import { DungeonScreen } from './DungeonScreen.tsx';
import { enterDungeon } from '../../game/dungeon/explore.ts';
import { IntroScreen } from './IntroScreen.tsx';
import { CharacterScreen } from './CharacterScreen.tsx';
import { StartScreen } from './StartScreen.tsx';
import { crossOver } from '../../game/world/crossing.ts';

function download(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wastes-crawler-save.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function WorldApp() {
  const [roster, setRoster] = useState(() => loadRoster().entries);
  const [slot, setSlot] = useState<Slot>(activeSlot);
  const world = useRef<World | null>(null);
  const [version, setVersion] = useState(0);
  const [screen, setScreen] = useState<'start' | 'intro' | 'map' | 'town' | 'character'>('start');
  /** The fight on screen, what settles it, and where the party goes after. */
  const [fight, setFight] = useState<{
    battle: WorldBattle;
    settle: (result: BattleResult) => void | Promise<void>;
    back: 'map' | 'town';
  } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [, setSaves] = useState(0);
  const hasSave = loadWorldText(slot) !== null;

  const changed = () => {
    if (world.current) saveWorldText(serializeWorld(world.current));
    setVersion((v) => v + 1);
  };
  /** Opens a slot's save, a plain world save, or a full save, whose roster joins this one. */
  const open = (text: string | null) => {
    const loaded = text === null ? null : parseSave(text, data);
    if (!loaded?.ok) {
      setErrors(loaded ? loaded.errors : ['There is no saved world.']);
      return;
    }
    if (loaded.roster) {
      const merged = mergeRoster(roster, loaded.roster);
      saveRoster(merged);
      setRoster(merged);
    }
    world.current = loaded.world;
    setErrors([]);
    setScreen('map');
    changed();
  };
  const start = (party: Recruit[], seed: string) => {
    world.current = newWorld(data, seed.trim() ? createRng(seed.trim()) : freshRng(), party);
    setErrors([]);
    setScreen('intro');
    changed();
  };

  const w = world.current;
  /** Starts the pending encounter's fight, with the XP simulation running alongside. */
  const startFight = () => {
    if (!w) return;
    const battle = encounterBattle(w, data);
    const verdict = assess({
      setup: battle.setup,
      seed: difficultySeed(w),
      fights: data.content.townRules.xp.simFights,
    });
    setFight({
      battle,
      settle: (result) => verdict.then((d) => settleByFighting(w, data, battle, result, d)),
      back: 'map',
    });
    changed();
  };
  const leave = () => {
    if (!w) return;
    settleByLeaving(w, data);
    changed();
  };
  if (screen === 'start' || !w)
    return (
      <StartScreen
        roster={roster}
        slots={
          Object.fromEntries(SLOTS.map((n) => [n, slotSummary(loadWorldText(n), data)])) as Record<
            Slot,
            string
          >
        }
        slot={slot}
        onSlot={(n) => {
          setActiveSlot(n);
          setSlot(n);
        }}
        hasSave={hasSave}
        errors={errors}
        onContinue={() => open(loadWorldText())}
        onNew={start}
        onStarters={() => {
          const added = addStarterParty(roster, data);
          saveRoster(added.entries);
          setRoster(added.entries);
          return added.placement;
        }}
        onImport={(file) => void file.text().then(open)}
      />
    );
  if (screen === 'intro')
    return <IntroScreen intro={data.content.campaign.intro} onBegin={() => setScreen('map')} />;
  if (fight) {
    const done = () => {
      setFight(null);
      setScreen(fight.back);
      changed();
    };
    return (
      <div class="arena">
        <FightScreen
          createBattle={() => fight.battle.battle}
          presets={fight.battle.memberIds.map(
            (id) => w.members.find((m) => m.id === id)?.defaultAction ?? 'auto',
          )}
          onPreset={(i, preset) => {
            const m = w.members.find((x) => x.id === fight.battle.memberIds[i]);
            if (m) m.defaultAction = preset;
          }}
          canLeave={false}
          doneLabel={
            fight.back === 'town'
              ? 'Back to town'
              : w.dungeon
                ? 'Back to the dungeon'
                : 'Back to the map'
          }
          onDone={(result) => {
            if (!result) return done();
            void Promise.resolve(fight.settle(result)).then(done);
          }}
        />
      </div>
    );
  }
  if (screen === 'character')
    return <CharacterScreen world={w} onChange={changed} onBack={() => setScreen('map')} />;
  if (w.dungeon)
    return (
      <DungeonScreen
        world={w}
        version={version}
        onChange={changed}
        onFight={startFight}
        onLeave={leave}
        onCharacters={() => setScreen('character')}
      />
    );
  if (screen === 'town')
    return (
      <TownScreen
        world={w}
        roster={roster}
        version={version}
        onChange={changed}
        onLeave={() => setScreen('map')}
        onBout={(start) =>
          setFight({
            battle: start.fight,
            settle: (result) => settleBout(w, data, start.fight, start.bout, result),
            back: 'town',
          })
        }
      />
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
      onFight={startFight}
      onRide={() => {
        coachQuarter(w, data);
        changed();
      }}
      onCross={() => {
        crossOver(w, data);
        changed();
      }}
      onEnter={() => {
        enterDungeon(w, data);
        changed();
      }}
      onTown={() => setScreen('town')}
      onCharacters={() => setScreen('character')}
      onLeave={leave}
      onExport={() => download(serializeBundle(w, roster))}
      onAbandon={() => {
        if (!confirm('Abandon this world? The save is deleted.')) return;
        saveWorldText(null);
        setSaves((n) => n + 1);
        world.current = null;
        setScreen('start');
      }}
    />
  );
}
