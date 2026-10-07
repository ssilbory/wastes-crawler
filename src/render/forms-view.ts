// What each Skinshifter in the party can change into outside a fight (1.5.15), for the panel. Pure.
import type { GameData } from '../game/character/context.ts';
import { shifters } from '../game/world/forms.ts';
import type { World } from '../game/world/types.ts';
import { formDetails, formHint } from './form-details.ts';

export interface ShifterView {
  id: string;
  name: string;
  /** The form worn now, or null in their own shape. */
  worn: string | null;
  /** The other forms, by index into the character's forms, with hover text. */
  forms: { index: number; name: string; hint: string }[];
}

export function formsView(w: World, data: GameData): ShifterView[] {
  return shifters(w).map((m) => {
    const forms = formDetails(data, m.character);
    return {
      id: m.id,
      name: m.character.name,
      worn: m.form === null ? null : (forms[m.form]?.name ?? null),
      forms: forms.flatMap((f, index) =>
        index === m.form ? [] : [{ index, name: f.name, hint: formHint(f) }],
      ),
    };
  });
}
