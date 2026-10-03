// Runs the XP benchmark off the main thread (docs/rules-adaptation.md, XP).
import { simulateDifficulty } from '../../game/world/difficulty.ts';
import { data } from '../builder/data.ts';
import type { AssessRequest } from './assess.ts';

globalThis.onmessage = (e: MessageEvent<AssessRequest>) => {
  const { enemies, level, seed, fights } = e.data;
  globalThis.postMessage(simulateDifficulty(data, enemies, level, seed, fights));
};
