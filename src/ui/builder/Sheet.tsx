import type { Attribute, Character } from '../../data/schemas/index.ts';
import { ATTRIBUTES } from '../../game/character/attributes.ts';
import { characterSheet, type Preview } from '../../game/character/derived.ts';
import type { AttackLine, EquipmentSummary } from '../../game/character/equipment.ts';
import { focusInfo } from '../../game/character/foci.ts';
import { crowns, entryName } from './GearStep.tsx';
import { spellName } from './MagicStep.tsx';
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

function attackText(a: AttackLine): string {
  const dice = `${a.damage.count}d${a.damage.sides}`;
  const bonus = a.damage.modifier + a.damageBonus;
  const shock = a.shock
    ? `, Shock ${a.shock.damage}/${a.shock.maxAc === null ? 'any AC' : `AC ${a.shock.maxAc}`}`
    : '';
  return `${a.name} (${a.mode}) ${signed(a.hit)}, ${dice}${bonus === 0 ? '' : signed(bonus)}${shock}`;
}

function Equipment(props: { equipment: EquipmentSummary }) {
  const { armorClass, attacks, load } = props.equipment;
  return (
    <>
      <p>
        AC {armorClass}. Load: Readied {load.readied}/{load.readiedLimit}, Stowed {load.stowed}/
        {load.stowedLimit}
        {load.state === 'ok' ? '' : ` (${load.state})`}.
      </p>
      <h3>Attacks</h3>
      <ul class="skills attacks">
        {attacks.map((a) => (
          <li key={`${a.id}-${a.mode}`}>{attackText(a)}</li>
        ))}
      </ul>
    </>
  );
}

/** Derived stats for the character in progress, before HP is rolled. */
export function PreviewSheet(props: {
  preview: Preview;
  skills: Skills;
  equipment: EquipmentSummary | null;
  effort: number | null;
}) {
  const { preview } = props;
  return (
    <aside class="sheet" aria-label="Character preview">
      <h2>Preview</h2>
      <Attributes scores={preview.scores} modifiers={preview.modifiers} />
      <p>Attack bonus: {preview.attackBonus === null ? '–' : signed(preview.attackBonus)}</p>
      <h3>Saves</h3>
      <Saves saves={preview.saves} />
      {props.effort !== null && <p>Effort: {props.effort}</p>}
      {props.equipment && <Equipment equipment={props.equipment} />}
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
      <Equipment equipment={sheet.equipment} />
      <h3>Inventory</h3>
      <ul class="skills">
        {c.inventory.map((e, i) => (
          <li key={i}>
            {entryName(e)}: {e.location}
          </li>
        ))}
      </ul>
      <p>Purse: {crowns(Math.round(c.crowns * 10))}.</p>
      {sheet.magic && (
        <>
          <h3>Magic</h3>
          <p>
            Effort {sheet.magic.effort}. Casts {sheet.magic.slots.spellsCast} a day, prepares{' '}
            {sheet.magic.slots.spellsPrepared}, up to level {sheet.magic.slots.maxSpellLevel}.
            {sheet.magic.canCast ? '' : ' Armor or a shield blocks casting.'}
          </p>
          <p>
            Arts:{' '}
            {c.arts.map((id) => data.srd.arts.find((a) => a.id === id)?.name ?? id).join(', ')}.
          </p>
          <ul class="skills">
            {c.spells.known.map((id) => (
              <li key={id}>
                {spellName(id)}
                {c.spells.prepared.includes(id) ? ' (prepared)' : ''}
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>Foci</h3>
      <ul class="skills">
        {c.foci.map((f) => (
          <li key={`${f.id}-${f.attribute ?? ''}`}>
            {focusInfo(data, f.id)?.name ?? f.id}-{f.level}
            {f.attribute ? ` (${ATTRIBUTE_NAMES[f.attribute]})` : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}
