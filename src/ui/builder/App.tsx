import { useMemo, useRef, useState } from 'preact/hooks';
import type { Character } from '../../data/schemas/index.ts';
import { ATTRIBUTES } from '../../game/character/attributes.ts';
import {
  emptyChoices,
  evaluateChoices,
  finishCharacter,
  rollBackground,
  type Choices,
} from '../../game/character/creation.ts';
import { previewSheet } from '../../game/character/derived.ts';
import { exportCharacter, importCharacter } from '../../game/character/io.ts';
import type { AttributeScores } from '../../rules/attributes.ts';
import { AttributesStep, type DraftArray } from './AttributesStep.tsx';
import { BackgroundStep } from './BackgroundStep.tsx';
import { data, freshRng } from './data.ts';
import { ClassStep, FreeSkillStep, IdentityStep } from './OtherSteps.tsx';
import { CharacterSheet, PreviewSheet } from './Sheet.tsx';

function toArray(draft: DraftArray): AttributeScores | null {
  return ATTRIBUTES.every((a) => draft[a] !== undefined) ? (draft as AttributeScores) : null;
}

function download(character: Character) {
  const blob = new Blob([exportCharacter(character)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${character.name.replace(/[^\w-]+/g, '_') || 'character'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function App() {
  const rng = useRef(freshRng());
  const [choices, setChoices] = useState<Choices>(() => emptyChoices());
  const [draft, setDraft] = useState<DraftArray>({});
  const [character, setCharacter] = useState<Character | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const ev = useMemo(() => evaluateChoices(choices, data), [choices]);
  const preview = useMemo(() => previewSheet(ev, choices.classId, data), [ev, choices.classId]);
  const update = (patch: Partial<Choices>) => setChoices((c) => ({ ...c, ...patch }));

  const create = () => {
    const result = finishCharacter(choices, data, rng.current);
    if (result.ok) {
      setCharacter(result.character);
      setErrors([]);
    } else setErrors(result.errors);
  };

  const onImport = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file) return;
    const result = importCharacter(await file.text(), data);
    input.value = '';
    if (result.ok) {
      setCharacter(result.character);
      setErrors([]);
    } else setErrors(result.errors.map((e) => `${file.name}: ${e}`));
  };

  const startOver = () => {
    setCharacter(null);
    setChoices(emptyChoices());
    setDraft({});
    setErrors([]);
  };

  return (
    <div class="builder">
      <header>
        <h1>Wastes Crawler: character builder</h1>
        <label class="import">
          <span>Import character file</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => void onImport(e.target as HTMLInputElement)}
          />
        </label>
      </header>
      {errors.length > 0 && (
        <ul class="errors" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {character ? (
        <main class="done">
          <CharacterSheet character={character} />
          <div class="actions">
            <button type="button" onClick={() => download(character)}>
              Export JSON
            </button>
            <button type="button" onClick={startOver}>
              Start over
            </button>
          </div>
        </main>
      ) : (
        <main class="steps">
          <div class="column">
            <AttributesStep
              draft={draft}
              status={ev.steps.attributes}
              onChange={(next) => {
                setDraft(next);
                update({ array: toArray(next) });
              }}
            />
            <BackgroundStep
              choices={choices}
              status={ev.steps.background}
              onChange={(background) => update({ background })}
              onRoll={(tables) =>
                choices.background &&
                update({
                  background: {
                    id: choices.background.id,
                    choice: { mode: 'roll', rolls: rollBackground(rng.current, tables) },
                  },
                })
              }
            />
            <ClassStep
              value={choices.classId}
              status={ev.steps.class}
              onChange={(classId) => update({ classId })}
            />
            <FreeSkillStep
              value={choices.freeSkill}
              status={ev.steps['free-skill']}
              onChange={(freeSkill) => update({ freeSkill })}
            />
            <IdentityStep
              name={choices.name}
              goal={choices.goal}
              status={ev.steps.identity}
              onChange={update}
            />
            <button type="button" class="create" disabled={!ev.complete} onClick={create}>
              Create character
            </button>
          </div>
          <PreviewSheet preview={preview} skills={ev.skills} />
        </main>
      )}
    </div>
  );
}
