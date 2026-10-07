import { cannotImpute, impute, IMPUTATION, mimesis, MIMESIS } from '../../game/world/illusions.ts';
import type { TownResult } from '../../game/world/services.ts';
import { cannotTopple, topple, TREMORS } from '../../game/world/tremors.ts';
import type { World } from '../../game/world/types.ts';
import { castersOf } from '../../game/world/waygates.ts';
import { data } from '../builder/data.ts';

/**
 * Spells for a group met: The Inexorable Imputation and Phantasmal Mimesis, and Tremors of the
 * Depths for a garrison's post.
 */
export function EncounterSorcery(props: { world: World; run: (action: () => TownResult) => void }) {
  const w = props.world;
  const e = w.encounter;
  if (!e) return null;
  const tellers = cannotImpute(w, data) ? [] : castersOf(w, IMPUTATION);
  const fooling = e.hostile && !e.spotted ? castersOf(w, MIMESIS) : [];
  const shakers = cannotTopple(w) ? [] : castersOf(w, TREMORS);
  if (tellers.length + fooling.length + shakers.length === 0) return null;
  return (
    <div class="parley" role="group" aria-label="Sorcery">
      {tellers.map((m) => (
        <button key={m.id} type="button" onClick={() => props.run(() => impute(w, data, m.id))}>
          {m.character.name}: speak the Inexorable Imputation
        </button>
      ))}
      {fooling.map((m) => (
        <button key={m.id} type="button" onClick={() => props.run(() => mimesis(w, data, m.id))}>
          {m.character.name}: cast an illusion and slip away
        </button>
      ))}
      {shakers.map((m) => (
        <button key={m.id} type="button" onClick={() => props.run(() => topple(w, data, m.id))}>
          {m.character.name}: bring the post down with Tremors of the Depths
        </button>
      ))}
    </div>
  );
}
