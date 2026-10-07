import { cannotImpute, impute, IMPUTATION, mimesis, MIMESIS } from '../../game/world/illusions.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import { castersOf } from '../../game/world/waygates.ts';
import { data } from '../builder/data.ts';

/** High Magic for a group met: The Inexorable Imputation and Phantasmal Mimesis. */
export function EncounterSorcery(props: { world: World; run: (action: () => TownResult) => void }) {
  const w = props.world;
  const e = w.encounter;
  if (!e) return null;
  const tellers = cannotImpute(w, data) ? [] : castersOf(w, IMPUTATION);
  const fooling = e.hostile && !e.spotted ? castersOf(w, MIMESIS) : [];
  if (tellers.length === 0 && fooling.length === 0) return null;
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
    </div>
  );
}
