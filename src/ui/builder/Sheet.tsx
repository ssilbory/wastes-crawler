import type { Attribute, Character } from '../../data/schemas/index.ts';
import { ATTRIBUTES } from '../../game/character/attributes.ts';
import { characterSheet, type Preview } from '../../game/character/derived.ts';
import type { Skills } from '../../game/character/skills.ts';
import type { AttributeScores } from '../../rules/attributes.ts';
import type { SaveType } from '../../rules/saves.ts';
import { ATTRIBUTE_NAMES, className, data, signed, skillName } from './data.ts';

const SAVES: readonly SaveType[] = ['physical', 'evasion', 'mental', 'luck'];
const cap = (s: string) => s[0]?.toUpperCase() + s.slice(1);

function Attributes(props: {
  scores: AttributeScores | null;
  modifiers: Record<Attribute, number> | null;
}) {
  return (
    <table class="attributes">
      <tbody>
        {ATTRIBUTES.map((a) => (
          <tr key={a}>
            <th>{ATTRIBUTE_NAMES[a]}</th>
            <td>{props.scores ? props.scores[a] : '–'}</td>
            <td>{props.modifiers ? signed(props.modifiers[a]) : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Saves(props: { saves: Record<SaveType, number> | null }) {
  return (
    <dl class="saves">
      {SAVES.map((s) => (
        <div key={s}>
          <dt>{cap(s)}</dt>
          <dd>{props.saves ? `${props.saves[s]}+` : '–'}</dd>
        </div>
      ))}
    </dl>
  );
}

function SkillList(props: { skills: Skills }) {
  const entries = Object.entries(props.skills).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return <p class="hint">No skills yet.</p>;
  return (
    <ul class="skills">
      {entries.map(([id, level]) => (
        <li key={id}>
          {skillName(id)}-{level}
        </li>
      ))}
    </ul>
  );
}

/** Derived stats for the character in progress, before HP is rolled. */
export function PreviewSheet(props: { preview: Preview; skills: Skills }) {
  const { preview } = props;
  return (
    <aside class="sheet" aria-label="Character preview">
      <h2>Preview</h2>
      <Attributes scores={preview.scores} modifiers={preview.modifiers} />
      <p>Attack bonus: {preview.attackBonus === null ? '–' : signed(preview.attackBonus)}</p>
      <h3>Saves</h3>
      <Saves saves={preview.saves} />
      <h3>Skills</h3>
      <SkillList skills={props.skills} />
    </aside>
  );
}

/** The finished character, as saved. */
export function CharacterSheet(props: { character: Character }) {
  const c = props.character;
  const sheet = characterSheet(c, data);
  const peopleRecord = data.content.peoples.find((p) => p.id === c.people);
  const lineage = peopleRecord?.lineages?.find((l) => l.id === c.lineage)?.name;
  const people = `${peopleRecord?.name ?? c.people}${lineage ? ` (${lineage})` : ''}`;
  const background = data.content.backgrounds.find((b) => b.id === c.background)?.name;
  return (
    <section class="sheet final" data-testid="character-sheet" aria-label="Character sheet">
      <h2>{c.name}</h2>
      <p>
        {people} {className(c.classes.current)}, level {sheet.level}. Background:{' '}
        {background ?? c.background}.
      </p>
      {c.goal && <p>Goal: {c.goal}</p>}
      <Attributes scores={sheet.scores} modifiers={sheet.modifiers} />
      <dl class="stats">
        <div>
          <dt>HP</dt>
          <dd>
            {c.hp.current}/{c.hp.max}
          </dd>
        </div>
        <div>
          <dt>Attack bonus</dt>
          <dd>{signed(sheet.attackBonus)}</dd>
        </div>
        <div>
          <dt>System Strain</dt>
          <dd>
            {c.strain.value}/{sheet.strainMax}
          </dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{sheet.size}</dd>
        </div>
        <div>
          <dt>XP</dt>
          <dd>{c.xp}</dd>
        </div>
      </dl>
      <h3>Saves</h3>
      <Saves saves={sheet.saves} />
      <h3>Skills</h3>
      <SkillList skills={c.skills} />
    </section>
  );
}
