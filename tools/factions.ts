// pnpm factions: the faction turn run headless for two years, many times over (Phase 13). It
// reports, every six months, how often each faction still stands, its bases and assets on
// average, and where the warlord's clock sits, with no party in the world to change anything:
// every raid comes undefended.
//
//   pnpm factions -- --runs 200 --seed factions --months 24
import { loadContent } from '../src/data/content.ts';
import { loadSrd } from '../src/data/load.ts';
import { resolveRaid } from '../src/game/factions/raid.ts';
import { startFactions } from '../src/game/factions/state.ts';
import { factionTurn } from '../src/game/factions/turn.ts';
import type { World } from '../src/game/world/types.ts';
import { createRng } from '../src/rules/rng.ts';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
};
const RUNS = Number(arg('runs', '200'));
const SEED = arg('seed', 'factions');
const MONTHS = Number(arg('months', '24'));

const data = { srd: loadSrd(), content: loadContent() };
const ids = data.content.factions.factions.map((f) => f.id);
const checkpoints = Array.from({ length: Math.floor(MONTHS / 6) }, (_, i) => (i + 1) * 6);
type Tally = { alive: number; bases: number; assets: number };
const tally = new Map<string, Tally>();
const clocks = new Map<number, number[]>();

for (let run = 0; run < RUNS; run++) {
  // Only what the faction turn touches; the party plays no part.
  const w = {
    rng: createRng(`${SEED}-${run}`),
    factions: {},
    clock: 0,
    day: 0,
    log: [],
    raid: null,
    raided: {},
  };
  const world = w as unknown as World;
  startFactions(world, data);
  for (let month = 1; month <= MONTHS; month++) {
    world.log = [];
    // A raid announced last month has come and gone, undefended.
    if (world.raid) resolveRaid(world, data, world.raid.town);
    world.raid = null;
    factionTurn(world, data);
    if (!checkpoints.includes(month)) continue;
    clocks.set(month, [...(clocks.get(month) ?? []), world.clock]);
    for (const id of ids) {
      const s = world.factions[id];
      const t = tally.get(`${id}@${month}`) ?? { alive: 0, bases: 0, assets: 0 };
      if (s && s.hp > 0) t.alive += 1;
      t.bases += s?.bases.length ?? 0;
      t.assets += s?.assets.length ?? 0;
      tally.set(`${id}@${month}`, t);
    }
  }
}

const pct = (n: number) => `${Math.round((100 * n) / RUNS)}%`;
const avg = (n: number) => (n / RUNS).toFixed(1);
console.log(`${RUNS} runs, seed "${SEED}"; standing, bases, and assets on average.`);
console.log(`| Faction | ${checkpoints.map((m) => `Month ${m}`).join(' | ')} |`);
console.log(`| --- | ${checkpoints.map(() => '---').join(' | ')} |`);
for (const id of ids) {
  const cells = checkpoints.map((m) => {
    const t = tally.get(`${id}@${m}`) as Tally;
    return `${pct(t.alive)}, ${avg(t.bases)}, ${avg(t.assets)}`;
  });
  console.log(`| ${id} | ${cells.join(' | ')} |`);
}
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
console.log(
  `| clock (median) | ${checkpoints.map((m) => median(clocks.get(m) ?? [])).join(' | ')} |`,
);
