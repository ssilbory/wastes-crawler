// Runs the XP difficulty simulation off the main thread (docs/rules-adaptation.md, XP).
import { simulateDifficulty } from '../../game/world/difficulty.ts';
import { data } from '../builder/data.ts';
import type { AssessAnswer, AssessMessage } from './assess.ts';

globalThis.onmessage = (e: MessageEvent<AssessMessage>) => {
  const { id, setup, seed, fights } = e.data;
  const answer: AssessAnswer = { id, difficulty: simulateDifficulty(data, setup, seed, fights) };
  globalThis.postMessage(answer);
};
