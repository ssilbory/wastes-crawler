// Optional sound (docs/plan.md, Phase 11): short cues synthesized with Web Audio from
// data/content/sound-cues.json, so the game ships no audio files. Off unless the player turns it on.
import { soundCue } from '../game/settings.ts';
import { data } from './builder/data.ts';
import { getSettings } from './settings-store.ts';

let context: AudioContext | null = null;

export function play(id: string): void {
  const { on, volume } = getSettings().sound;
  if (!on || volume === 0 || typeof AudioContext === 'undefined') return;
  context ??= new AudioContext();
  const ctx = context;
  const cue = soundCue(data, id);
  let at = ctx.currentTime;
  for (const note of cue.notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = cue.wave;
    osc.frequency.value = note.hz;
    const end = at + note.ms / 1000;
    gain.gain.setValueAtTime(volume * 0.3, at);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(end);
    at = end;
  }
}

/** Plays a cue when an action succeeds, passing its result on. */
export function cue<R extends { ok: boolean }>(result: R, id: string): R {
  if (result.ok) play(id);
  return result;
}
