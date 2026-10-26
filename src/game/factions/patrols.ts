// Faction patrols (Phase 13b; docs/rules-adaptation.md, Factions: Patrols). An overland
// encounter within the content's radius of an asset that sends patrols is that asset's patrol one
// time in `chance`. Beating a patrol costs its asset half its hit points, rounded up.
import { rollDie } from '../../rules/dice.ts';
import { distance } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import { note } from '../world/members.ts';
import type { World } from '../world/types.ts';
import { hurtAsset } from './combat.ts';
import { assetName, factionOf, isActive, locationOf, srdAsset } from './state.ts';

export interface Patrol {
  rows: string[][];
  /** faction:uid, kept on the encounter so a won fight can find the asset. */
  key: string;
  /** Who they march for, for the journey log. */
  name: string;
}

/** The patrol group an asset of this kind sends out for faction `id`, if any. */
export const patrolOf = (data: GameData, id: string, asset: string) =>
  factionOf(data, id).patrols.find((p) => p.asset === asset);

/** Patrols whose assets stand within reach of the party. */
export function nearbyPatrols(w: World, data: GameData): Patrol[] {
  const { radius } = data.content.factions.patrol;
  return Object.entries(w.factions).flatMap(([id, s]) =>
    isActive(s)
      ? s.assets.flatMap((held) => {
          const patrol = patrolOf(data, id, held.asset);
          const at = locationOf(data, held.at);
          if (!patrol || at.region !== w.region || distance(at, w.position) > radius) return [];
          const name = `${factionOf(data, id).name}'s ${assetName(data, id, held.asset)}`;
          return [{ rows: patrol.enemies, key: `${id}:${held.uid}`, name }];
        })
      : [],
  );
}

/** One time in `chance`, a patrol in reach stands in for the wandering encounter. */
export function rollPatrol(w: World, data: GameData): Patrol | null {
  const near = nearbyPatrols(w, data);
  if (near.length === 0 || rollDie(w.rng, data.content.factions.patrol.chance) !== 1) return null;
  return near[rollDie(w.rng, near.length) - 1] as Patrol;
}

/** The party beat a patrol: its asset loses half its hit points, rounded up. */
export function patrolBeaten(w: World, data: GameData, key: string): void {
  const [id = '', uid] = key.split(':');
  const held = w.factions[id]?.assets.find((a) => a.uid === uid);
  if (!held) return;
  note(
    w,
    `The defeat costs ${factionOf(data, id).name}'s ${assetName(data, id, held.asset)} dearly.`,
  );
  hurtAsset(w, data, id, held, Math.ceil(srdAsset(data, held.asset).hp / 2));
}
