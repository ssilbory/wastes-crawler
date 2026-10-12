import { useRef, useState } from 'preact/hooks';
import { newWorld, type Recruit } from '../../game/world/new-world.ts';
import { settleBout } from '../../game/world/arena.ts';
import { coachQuarter } from '../../game/world/coach.ts';
import { difficultySeed } from '../../game/world/difficulty.ts';
import { encounterBattle, xpText } from '../../game/world/fight.ts';
import { passQuarter, settleByFighting, settleByLeaving } from '../../game/world/quarter.ts';
import { addStarterParty, removeFromRoster } from '../../game/character/roster.ts';
import { mergeRoster, parseSave, serializeBundle } from '../../game/world/bundle.ts';
import { serializeWorld } from '../../game/world/save.ts';
import { setDefaultAction } from '../../game/world/members.ts';
import { slotSummary } from '../../render/save-view.ts';
import type { World } from '../../game/world/types.ts';
import { createRng } from '../../rules/rng.ts';
import { FightScreen } from '../arena/FightScreen.tsx';
import { data, freshRng } from '../builder/data.ts';
import { loadPlayable } from '../playable-store.ts';
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
import { TownScreen, type Tab } from '../town/TownScreen.tsx';
import { assess } from './assess.ts';
import { MapScreen } from './MapScreen.tsx';
import { DungeonScreen } from './DungeonScreen.tsx';
import { enterDungeon } from '../../game/dungeon/explore.ts';
import { IntroScreen } from './IntroScreen.tsx';
import type { PartyScreen } from './PartyButtons.tsx';
import { PartyScreens } from './PartyScreens.tsx';
import { StartScreen } from './StartScreen.tsx';
import { crossOver } from '../../game/world/crossing.ts';
import { Toasts, useAlerts } from './Toasts.tsx';
import { trapFallen } from '../../game/dungeon/trap-falls.ts';
import { tending, type Fight } from './tending.ts';
import { knownFoes } from '../../render/bestiary-view.ts';

function download(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wastes-crawler-save.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function WorldApp() {
  // Before any screen reads the content, so saved dungeons are in it.
  useState(loadPlayable);
  const alerts = useAlerts();
  return (
    <>
      <WorldScreens track={alerts.track} />
      <Toasts shown={alerts.shown} onDismiss={alerts.dismiss} />
    </>
  );
}

/** `track` hears of every change to the world, for the notices beside the screen. */
function WorldScreens(props: { track: (w: World, fresh?: boolean) => void }) {
  const [roster, setRoster] = useState(() => loadRoster().entries);
  const [slot, setSlot] = useState<Slot>(activeSlot);
  const world = useRef<World | null>(null);
  // Fights already settled, so a second click on "Back" can't settle the same one again.
  const settled = useRef(new WeakSet<object>());
  const [version, setVersion] = useState(0);
  const [screen, setScreen] = useState<'start' | 'intro' | 'map' | 'town' | PartyScreen>('start');
  /** Where a party screen returns to, and the member the inventory opens on. */
  const [from, setFrom] = useState<'map' | 'town'>('map');
  const [member, setMember] = useState<string | undefined>(undefined);
  const [townTab, setTownTab] = useState<Tab>('quests');
  const openFrom = (back: 'map' | 'town') => (next: PartyScreen) => {
    setFrom(back);
    setMember(undefined);
    setScreen(next);
  };
  const [fight, setFight] = useState<Fight | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [, setSaves] = useState(0);
  const hasSave = loadWorldText(slot) !== null;

  const changed = (fresh = false) => {
    const now = world.current;
    if (now) {
      saveWorldText(serializeWorld(now));
      props.track(now, fresh === true);
      // A trap's fallen are tended at once, as after a won fight (trap-falls.ts).
      if (trapFallen(now).length > 0) setFight((f) => f ?? tending(now));
    }
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
    changed(true);
  };
  const start = (party: Recruit[], seed: string) => {
    world.current = newWorld(data, seed.trim() ? createRng(seed.trim()) : freshRng(), party);
    setErrors([]);
    setScreen('intro');
    changed(true);
  };

  const w = world.current;
  const exportSave = () => {
    if (w) download(serializeBundle(w, roster));
  };
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
      // Only a win shows it; a failed simulation just leaves it off.
      xp: verdict.then((d) => xpText(data, d)).catch(() => ''),
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
        onDelete={(id) => {
          const next = removeFromRoster(roster, id);
          saveRoster(next);
          setRoster(next);
        }}
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
            const id = fight.battle.memberIds[i];
            if (!id) return;
            setDefaultAction(w, id, preset);
            changed();
          }}
          canLeave={false}
          xp={fight.xp}
          aftermath={fight.aftermath ?? false}
          known={knownFoes(w, data, fight.battle.enemies)}
          doneLabel={
            fight.back === 'town'
              ? 'Back to town'
              : w.dungeon
                ? 'Back to the dungeon'
                : 'Back to the map'
          }
          onDone={(result) => {
            if (!result) return done();
            if (settled.current.has(fight)) return;
            settled.current.add(fight);
            void Promise.resolve(fight.settle(result)).then(done);
          }}
        />
      </div>
    );
  }
  if (screen === 'character' || screen === 'formation' || screen === 'inventory')
    return (
      <PartyScreens
        world={w}
        screen={screen}
        from={from}
        member={member}
        onChange={changed}
        onScreen={setScreen}
        onMember={setMember}
      />
    );
  if (w.dungeon)
    return (
      <DungeonScreen
        world={w}
        version={version}
        onChange={changed}
        onFight={startFight}
        onLeave={leave}
        onOpen={openFrom('map')}
        onExport={exportSave}
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
        onOpen={openFrom('town')}
        onExport={exportSave}
        tab={townTab}
        onTab={setTownTab}
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
      onOpen={openFrom('map')}
      onLeave={leave}
      onExport={exportSave}
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
