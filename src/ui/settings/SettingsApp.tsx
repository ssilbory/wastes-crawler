import { useLayoutEffect, useState } from 'preact/hooks';
import {
  CombatSpeedSchema,
  KeyActionSchema,
  TextSizeSchema,
  type KeyAction,
} from '../../data/schemas/index.ts';
import { defaultSettings, rebind, unbind } from '../../game/settings.ts';
import { ACTION_NAMES, keyLabel } from '../../render/settings-view.ts';
import { data } from '../builder/data.ts';
import { setSettings, useSettings } from '../settings-store.ts';
import { play } from '../sound.ts';
import './settings.css';

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph']);

/** Settings: keys, sound, combat speed, and text size (docs/plan.md, Phase 11). */
export function SettingsApp() {
  const s = useSettings();
  /** The action and slot waiting for a key press, if any. */
  const [listening, setListening] = useState<{ action: KeyAction; slot: 0 | 1 } | null>(null);
  // A layout effect listens from the same commit that shows "Press a key…", so no key is missed.
  useLayoutEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      // A modifier alone waits for the key it goes with; Tab gives up and moves focus on.
      if (MODIFIERS.has(e.key) || e.repeat) return;
      if (e.key === 'Tab') return setListening(null);
      e.preventDefault();
      setSettings(rebind(s, listening.action, listening.slot, e.key));
      setListening(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [listening, s]);
  return (
    <main class="settings">
      <h1>Settings</h1>
      <section class="panel" aria-label="Keys">
        <h2>Dungeon keys</h2>
        <p class="hint">
          Click a key, then press the new one (Escape or Tab cancels; Enter can't be bound).
        </p>
        <table>
          <tbody>
            {KeyActionSchema.options.map((action) => (
              <tr key={action}>
                <th scope="row">{ACTION_NAMES[action]}</th>
                {([0, 1] as const).map((slot) => {
                  const key = s.keys[action][slot];
                  const waiting = listening?.action === action && listening.slot === slot;
                  return (
                    <td key={slot}>
                      <button
                        type="button"
                        aria-label={`${ACTION_NAMES[action]} key ${slot + 1}`}
                        onClick={() => setListening({ action, slot })}
                      >
                        {waiting ? 'Press a key…' : key ? keyLabel(key) : '—'}
                      </button>
                      {key && (
                        <button
                          type="button"
                          class="secondary"
                          aria-label={`Clear ${ACTION_NAMES[action]} key ${slot + 1}`}
                          onClick={() => setSettings(unbind(s, action, slot))}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section class="panel" aria-label="Sound">
        <h2>Sound</h2>
        <label>
          <input
            type="checkbox"
            checked={s.sound.on}
            onChange={(e) =>
              setSettings({
                ...s,
                sound: { ...s.sound, on: (e.target as HTMLInputElement).checked },
              })
            }
          />{' '}
          Sound on
        </label>{' '}
        <label>
          Volume{' '}
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={s.sound.volume}
            onInput={(e) =>
              setSettings({
                ...s,
                sound: { ...s.sound, volume: Number((e.target as HTMLInputElement).value) },
              })
            }
          />
        </label>{' '}
        <button type="button" onClick={() => play('win')}>
          Test
        </button>
      </section>
      <section class="panel" aria-label="Combat and text">
        <h2>Combat and text</h2>
        <label>
          Auto-resolve speed{' '}
          <select
            value={s.combatSpeed}
            onChange={(e) =>
              setSettings({
                ...s,
                combatSpeed: CombatSpeedSchema.parse((e.target as HTMLSelectElement).value),
              })
            }
          >
            {CombatSpeedSchema.options.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Text size{' '}
          <select
            value={s.textSize}
            onChange={(e) =>
              setSettings({
                ...s,
                textSize: TextSizeSchema.parse((e.target as HTMLSelectElement).value),
              })
            }
          >
            {TextSizeSchema.options.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
      </section>
      <button type="button" class="secondary" onClick={() => setSettings(defaultSettings(data))}>
        Restore defaults
      </button>
    </main>
  );
}
