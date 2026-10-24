// Starts the XP difficulty simulation when a fight begins: in a Web Worker when the browser has
// one, otherwise on the main thread. Either way it runs on its own seed, never the world's RNG.
// One worker serves every fight, so its copy of the game data loads once, not once a fight.
import { simulateDifficulty, type Difficulty } from '../../game/world/difficulty.ts';
import type { PartySetup } from '../../game/world/fight.ts';
import { data } from '../builder/data.ts';

export interface AssessRequest {
  setup: PartySetup;
  seed: string;
  fights: number;
}

/** A request as the worker gets it, numbered so each answer finds its fight. */
export type AssessMessage = AssessRequest & { id: number };
export interface AssessAnswer {
  id: number;
  difficulty: Difficulty;
}

const inline = (r: AssessRequest) => simulateDifficulty(data, r.setup, r.seed, r.fights);

/** The worker, null once it has failed (the rest run inline), undefined until the first fight. */
let worker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<number, { request: AssessRequest; resolve: (d: Difficulty) => void }>();

function start(): Worker | null {
  if (worker !== undefined) return worker;
  if (typeof Worker === 'undefined') return (worker = null);
  const w = new Worker(new URL('./difficulty-worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<AssessAnswer>) => {
    waiting.get(e.data.id)?.resolve(e.data.difficulty);
    waiting.delete(e.data.id);
  };
  // A worker that can't load, or fails, hands its fights back to the main thread for good.
  w.onerror = () => {
    w.terminate();
    worker = null;
    for (const { request, resolve } of waiting.values()) resolve(inline(request));
    waiting.clear();
  };
  return (worker = w);
}

export function assess(request: AssessRequest): Promise<Difficulty> {
  const w = start();
  if (!w) return Promise.resolve(inline(request));
  const id = nextId++;
  return new Promise((resolve) => {
    waiting.set(id, { request, resolve });
    w.postMessage({ ...request, id } satisfies AssessMessage);
  });
}
