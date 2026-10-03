// Starts the XP difficulty simulation when a fight begins: in a Web Worker when the browser has
// one, otherwise on the main thread. Either way it runs on its own seed, never the world's RNG.
import { simulateDifficulty, type Difficulty } from '../../game/world/difficulty.ts';
import type { PartySetup } from '../../game/world/fight.ts';
import { data } from '../builder/data.ts';

export interface AssessRequest {
  setup: PartySetup;
  seed: string;
  fights: number;
}

const inline = (r: AssessRequest) => simulateDifficulty(data, r.setup, r.seed, r.fights);

export function assess(request: AssessRequest): Promise<Difficulty> {
  if (typeof Worker === 'undefined') return Promise.resolve(inline(request));
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./difficulty-worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<Difficulty>) => {
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = () => {
      worker.terminate();
      resolve(inline(request));
    };
    worker.postMessage(request);
  });
}
