import { useState } from 'preact/hooks';
import { artHint } from '../../render/describe-view.ts';
import type { Form } from '../../data/schemas/index.ts';
import { formArts, maxForms } from '../../game/character/forms.ts';
import { setForms } from '../../game/world/practice.ts';
import type { Member, World } from '../../game/world/types.ts';
import { data } from '../builder/data.ts';
import { FormsEditor } from '../builder/FormsEditor.tsx';
import type { Act } from './TownScreen.tsx';

/** A Skinshifter's forms, built and reshaped in town (1.5.15). */
export function FormsTraining(props: { world: World; member: Member; act: Act }) {
  const c = props.member.character;
  const [draft, setDraft] = useState<Form[] | null>(null);
  const max = maxForms(data, c);
  if (max === 0) return null;
  const arts = formArts(data, c).map((id) => ({
    id,
    name: data.srd.arts.find((a) => a.id === id)?.name ?? id,
    hint: artHint(data, id),
  }));
  const forms = draft ?? c.forms ?? [];
  return (
    <section class="panel" aria-label="Forms">
      <h3>Forms</h3>
      <p class="hint">
        One form per level. A form in an empty slot is free; reshaping or dropping a kept form takes
        a day of practice, a night at the inn.
      </p>
      <FormsEditor forms={forms} arts={arts} max={max} onChange={setDraft} />
      {draft && (
        <button
          type="button"
          onClick={() => {
            let kept = false;
            props.act(() => {
              const r = setForms(props.world, data, props.member.id, draft);
              kept = r.ok;
              return r;
            });
            if (kept) setDraft(null);
          }}
        >
          Keep these forms
        </button>
      )}
    </section>
  );
}
