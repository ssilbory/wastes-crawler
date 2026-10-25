import { useRef, useState } from 'preact/hooks';
import { newWorld, type Recruit } from '../../game/world/new-world.ts';
import { settleBout } from '../../game/world/arena.ts';
import { coachQuarter } from '../../game/world/coach.ts';
import { difficultySeed } from '../../game/world/difficulty.ts';
import { encounterBattle, xpText } from '../../game/world/fight.ts';
import { passQuarter, settleByFighting, settleByLeaving } from '../../game/world/quarter.ts';
import { realmEnding, seeRealmEnd } from '../../game/world/realm-end.ts';
import { addStarterParty } from '../../game/character/roster.ts';
import { mergeRoster, parseSave, savedMap, serializeBundle } from '../../game/world/bundle.ts';
import { serializeWorld } from '../../game/world/save.ts';
import { slotSummary } from '../../render/save-view.ts';
import type { World } from '../../game/world/types.ts';
import { createRng } from '../../rules/rng.ts';
import { data, freshRng } from '../builder/data.ts';
import { loadPlayable } from '../playable-store.ts';
import { isCampaign } from '../../game/world/region.ts';
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
import { EndingScreen } from './EndingScreen.tsx';
import { IntroScreen } from './IntroScreen.tsx';
import type { PartyScreen } from './PartyButtons.tsx';
import { PartyScreens } from './PartyScreens.tsx';
import { recruits, StartScreen } from './StartScreen.tsx';
import { download, useLaunch } from './launch.ts';
import { CAMPAIGN, type WorldChoice } from './WorldPicker.tsx';
import { crossOver } from '../../game/world/crossing.ts';
import { Toasts, useAlerts } from './Toasts.tsx';
import { trapFallen } from '../../game/dungeon/trap-falls.ts';
import { tending, type Fight } from './tending.ts';
import { WorldFight } from './WorldFight.tsx';

export function WorldApp() {
  // Before any screen reads the content, so saved dungeons are in it.
  useState(loadPlayable);
  const alerts = useAlerts();
  // Storage that fills up or is blocked mid-game would otherwise leave an old save behind unseen.
  const [unsaved, setUnsaved] = useState(false);
  return (
    <>
      {unsaved && (
        <p class="errors unsaved" role="alert">
          Browser storage is full or blocked, so progress isn’t being saved. Export a save to keep
          it.
        </p>
      )}
      <WorldScreens track={alerts.track} onSaved={(ok) => setUnsaved(!ok)} />
      <Toasts shown={alerts.shown} onDismiss={alerts.dismiss} />
    </>
  );
}

/**
 * `track` hears of every change to the world, for the notices beside the screen; `onSaved` hears
 * whether each save to browser storage went through.
 */
function WorldScreens(props: {
  track: (w: World, fresh?: boolean) => void;
  onSaved: (ok: boolean) => void;
}) {
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
      props.onSaved(saveWorldText(serializeWorld(now)));
      props.track(now, fresh === true);
      // A trap's fallen are tended at once, as after a won fight (trap-falls.ts).
      if (trapFallen(now).length > 0) setFight((f) => f ?? tending(now));
      // A fallen party is lost (town.ts, wipe): the town's tavern is where a new one is gathered,
      // and the town stays open while it is.
      if (now.members.length === 0) {
        setScreen('town');
        setTownTab('tavern');
      }
    }
    setVersion((v) => v + 1);
  };
  /** Opens a slot's save, a plain world save, or a full save, whose roster joins this one. */
  const open = (text: string | null) => {
    // A world on a custom map brings its map, and the dungeons saved on it, into the content.
    if (text !== null) loadPlayable(savedMap(text));
    const loaded = text === null ? null : parseSave(text, data);
    if (!loaded?.ok) {
      setErrors(loaded ? loaded.errors : ['There is no saved world.']);
      return;
    }
    if (loaded.roster) {
      const merged = mergeRoster(roster, loaded.roster);
      if (!saveRoster(merged)) props.onSaved(false);
      setRoster(merged);
    }
    world.current = loaded.world;
    setErrors([]);
    setScreen('map');
    changed(true);
  };
  const start = (party: Recruit[], seed: string, { map, realm }: WorldChoice) => {
    loadPlayable(map);
    const rng = seed.trim() ? createRng(seed.trim()) : freshRng();
    world.current = newWorld(data, rng, party, undefined, map, realm);
    setErrors([]);
    // The campaign's introduction names its own lands; a custom map or a realm starts on the map.
    setScreen(isCampaign(world.current) ? 'intro' : 'map');
    changed(true);
  };

  const addStarters = () => {
    const added = addStarterParty(roster, data);
    if (!saveRoster(added.entries)) props.onSaved(false);
    setRoster(added.entries);
    return added;
  };
  useLaunch((launch) => {
    if (launch === 'continue') return open(loadWorldText());
    const added = addStarters();
    start(recruits(added.entries, added.placement), '', CAMPAIGN);
  });

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
        onStarters={() => addStarters().placement}
        onImport={(file) => void file.text().then(open)}
      />
    );
  if (screen === 'intro')
    return <IntroScreen intro={data.content.campaign.intro} onBegin={() => setScreen('map')} />;
  if (fight)
    return (
      <WorldFight
        world={w}
        fight={fight}
        settled={settled.current}
        onChange={changed}
        onDone={() => {
          setFight(null);
          setScreen(fight.back);
          changed();
        }}
      />
    );
  const ending = w.realmEnd === 'reached' ? realmEnding(w, data) : null;
  if (ending)
    return (
      <EndingScreen
        ending={ending}
        onTitle={() => {
          seeRealmEnd(w);
          changed();
          location.hash = '';
        }}
        onContinue={() => {
          seeRealmEnd(w);
          setScreen('map');
          changed();
        }}
      />
    );
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
  if (screen === 'town' || w.members.length === 0)
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
        saveWorldText(null);
        setSaves((n) => n + 1);
        world.current = null;
        setScreen('start');
      }}
    />
  );
}
