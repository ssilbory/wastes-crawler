import type { World } from '../../game/world/types.ts';
import { regionMap } from '../../game/world/region.ts';
import { data } from '../builder/data.ts';

/** Aboard a coach: the party rides on a quarter at a time (docs/rules-adaptation.md). */
export function CoachPanel(props: { world: World; onRide: () => void }) {
  const w = props.world;
  const trip = w.coach;
  if (!trip) return null;
  const to = regionMap(data, w.region).sites.find((s) => s.id === trip.to)?.name ?? trip.to;
  const rolling = data.content.coachRules.travelQuarters.includes(w.quarter);
  return (
    <section class="panel" aria-label="Coach">
      <h2>On the coach to {to}</h2>
      <p>
        {trip.path.length} road hexes to go.{' '}
        {rolling ? 'The coach is on the road.' : 'Night at a waystation.'}
      </p>
      <button type="button" class="create" onClick={props.onRide}>
        Ride on
      </button>
    </section>
  );
}
