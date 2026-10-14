import { useState } from 'preact/hooks';
import type { Attribute } from '../../data/schemas/index.ts';
import { boneshape, liftShaping, SHAPEABLE } from '../../game/world/boneshaper.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import type { CasterView } from '../../render/necromancy-view.ts';
import { attributeLabel } from '../../render/attribute-view.ts';
import { data } from '../builder/data.ts';

const NAMES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  cha: 'Charisma',
};

/** Boneshaper on a living member, and lifting the caster's shapings. */
export function Boneshaping(props: {
  world: World;
  caster: CasterView;
  run: (action: () => TownResult) => void;
}) {
  const w = props.world;
  const c = props.caster;
  const living = w.members.filter((m) => !m.dead);
  const [target, setTarget] = useState(living[0]?.id ?? '');
  const [raise, setRaise] = useState<Attribute>('str');
  const [lower, setLower] = useState<Attribute>('cha');
  if (w.encounter) return null;
  const shaped = living.find((m) => m.id === target) ?? living[0];
  const pick = (label: string, value: string, set: (v: Attribute) => void) => (
    <label>
      {label}{' '}
      <select value={value} onChange={(e) => set(e.currentTarget.value as Attribute)}>
        {SHAPEABLE.map((a) => (
          <option key={a} value={a}>
            {shaped ? attributeLabel(data, shaped.character, a, NAMES[a] ?? a) : NAMES[a]}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      {c.shape && (
        <fieldset>
          <legend>Boneshaper</legend>
          <label>
            Shape{' '}
            <select value={target} onChange={(e) => setTarget(e.currentTarget.value)}>
              {living.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.character.name}
                </option>
              ))}
            </select>
          </label>
          {pick('Raise', raise, setRaise)}
          {pick('Lower', lower, setLower)}
          <button
            type="button"
            onClick={() => props.run(() => boneshape(w, data, c.id, target, raise, lower))}
          >
            Reshape
          </button>
        </fieldset>
      )}
      {c.shaped.map((s) => (
        <p key={s.id}>
          {s.name} is shaped ({s.changes}).{' '}
          <button type="button" onClick={() => props.run(() => liftShaping(w, c.id, s.id))}>
            Lift the shaping from {s.name}
          </button>
        </p>
      ))}
    </>
  );
}
