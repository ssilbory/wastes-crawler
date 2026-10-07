// What each Skinshifter in the party can change into outside a fight (1.5.15), for the panel. Pure.
import type { Form } from '../data/schemas/index.ts';
import type { GameData } from '../game/character/context.ts';
import { shifters } from '../game/world/forms.ts';
import type { World } from '../game/world/types.ts';

export interface ShifterView {
  id: string;
  name: string;
  /** The form worn now, or null in their own shape. */
  worn: string | null;
  /** The other forms, by index into the character's forms. */
  forms: { index: number; name: string }[];
}

export function formsView(w: World): ShifterView[] {
  return shifters(w).map((m) => {
    // Only members with forms are shifters.
    const forms = m.character.forms as Form[];
    return {
      id: m.id,
      name: m.character.name,
      worn: m.form === null ? null : (forms[m.form]?.name ?? null),
      forms: forms.flatMap((f, index) => (index === m.form ? [] : [{ index, name: f.name }])),
    };
  });
}

const ATTRIBUTE = { str: 'Strength', dex: 'Dexterity', con: 'Constitution' } as const;

/** "Wolf: Savage Talons, Feral Prowess (Dexterity)", with "humanoid" for a humanoid shape. */
export function formText(data: GameData, f: Form): string {
  const arts = f.arts.map((id) => {
    const name = data.srd.arts.find((a) => a.id === id)?.name ?? id;
    return id === 'feral-prowess' && f.feral ? `${name} (${ATTRIBUTE[f.feral]})` : name;
  });
  const notes = [...(f.humanoid ? ['humanoid'] : []), ...arts];
  return notes.length > 0 ? `${f.name}: ${notes.join(', ')}` : f.name;
}
