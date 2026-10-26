// The world's listeners, in order (docs/plan.md, Quest: driven by an event bus from the game layer).
// This composition module is the only one that imports them all; the table travels in GameData so
// that bus.ts, and every module that emits, imports none of them.
import type { Listener, WorldListeners } from './bus.ts';
import { clockListener } from './clock.ts';
import { craftingListener } from './crafting.ts';
import { grovesListener } from './groves.ts';
import { factionsListener } from '../factions/turn.ts';
import { maintenanceListener } from './maintenance.ts';
import { notesListener } from './notes.ts';
import { sharesListener } from './shares.ts';
import { ordersListener } from './orders.ts';
import { questListener } from './quests.ts';
import { raidsListener } from './raids.ts';
import { raisingListener } from './raising.ts';
import { rescueListener } from '../dungeon/rescues.ts';
import { ruinsListener } from '../dungeon/ruins.ts';
import { realmEndListener } from './realm-end.ts';
import { sitesListener } from './hidden-sites.ts';
import { waterListener } from './water.ts';
import { warlordsListener } from './warlords.ts';

const ALL: readonly Listener[] = [
  questListener,
  grovesListener,
  rescueListener,
  raisingListener,
  craftingListener,
  maintenanceListener,
  ordersListener,
  raidsListener,
  factionsListener,
  clockListener,
  notesListener,
  sharesListener,
  ruinsListener,
  sitesListener,
  waterListener,
  warlordsListener,
  // Last, so the fight's garrison is recorded before the ending checks the hex.
  realmEndListener,
];

/**
 * The campaign's own story: its raids, factions, warlord's clock, and crafter's notes, all tied to
 * the campaign's towns. A world on a custom map or a realm has none of it (Sam's call). Standing
 * orders run everywhere: the Sealed Vale's posts hold its pass and tower, and the same listener
 * records every won post and hoard fight (docs/rules-adaptation.md, Shipped worlds).
 */
const CAMPAIGN: ReadonlySet<Listener> = new Set([
  raidsListener,
  factionsListener,
  clockListener,
  notesListener,
]);

export const WORLD_LISTENERS: WorldListeners = { all: ALL, campaign: CAMPAIGN };
