// The economy validator's report: every policy over every seed, the lock-outs found, and how the
// party ended up. Any lock-out on any seed fails the check (Sam's call: the worst case, zero locks).
import type { EconomySim } from '../../data/schemas/index.ts';
import { createRng } from '../../rules/rng.ts';
import type { GameData } from '../character/context.ts';
import { runEconomy, type Lockout } from './run.ts';

export const LOCKOUTS: readonly Lockout[] = ['loot-worthless', 'no-progress'];

/** The lock-outs ruled out by construction, and why (see run.ts). */
export const RULED_OUT = [
  'cannot-recover: a made camp heals as much as the inn, for free',
  'short-handed: the tavern always has a recruit for a PC the party cannot raise',
];

export interface PolicyReport {
  policy: string;
  /** Seeds that hit each lock-out, and the earliest delve any of them did. */
  locks: Record<Lockout, { seeds: number; firstDelve: number | null }>;
  medianPurse: number;
  medianLevel: number;
  medianDays: number;
  /** The dead over every seed: raised by quest, raised for crowns, and replaced. */
  raised: { quest: number; paid: number; recruited: number };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1
    ? (s[mid] as number)
    : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
};

export function economyReport(data: GameData, sim: EconomySim): PolicyReport[] {
  return sim.policies.map((policy) => {
    const runs = Array.from({ length: sim.seeds }, (_, seed) =>
      runEconomy(createRng(`economy-${policy.id}-${seed}`), data, sim, policy.towns),
    );
    const locks = Object.fromEntries(
      LOCKOUTS.map((kind) => {
        const hits = runs.map((r) => r.locks[kind]).filter((d): d is number => d !== undefined);
        return [kind, { seeds: hits.length, firstDelve: hits.length ? Math.min(...hits) : null }];
      }),
    ) as PolicyReport['locks'];
    return {
      policy: policy.id,
      locks,
      medianPurse: median(runs.map((r) => r.purse)),
      medianLevel: median(runs.map((r) => Math.max(...r.levels))),
      medianDays: median(runs.map((r) => r.day)),
      raised: {
        quest: runs.reduce((n, r) => n + r.raised.quest, 0),
        paid: runs.reduce((n, r) => n + r.raised.paid, 0),
        recruited: runs.reduce((n, r) => n + r.raised.recruited, 0),
      },
    };
  });
}

export const passes = (reports: readonly PolicyReport[]) =>
  reports.every((r) => LOCKOUTS.every((k) => r.locks[k].seeds === 0));
