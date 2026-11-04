// pnpm factions: the faction turn run headless for two years, many times over (Phase 13). It
// reports, every six months, how often each faction still stands, its bases and assets on
// average, where the warlord's clock sits, and how the sieges went, with no party in the world
// to change anything: every assault is fought without it (Phase 23a).
//
// With --party, the same years are played in the whole world, once with no party and once for
// each level given, the starters at that level played by the siege bot (tools/factions/
// party-bot.ts; Phase 23f), to show what the party changes.
//
//   pnpm factions -- --runs 200 --seed factions --months 24
//   pnpm factions -- --runs 50 --party 3,6,9
import { loadContent } from '../src/data/content.ts';
import { loadSrd } from '../src/data/load.ts';
import { startFactions } from '../src/game/factions/state.ts';
import { factionTurn } from '../src/game/factions/turn.ts';
import type { World } from '../src/game/world/types.ts';
import { createRng } from '../src/rules/rng.ts';
import { WORLD_LISTENERS } from '../src/game/world/listeners.ts';
import { siegesListener } from '../src/game/world/sieges.ts';
import { newRun, playUntil, siegeWorld } from './factions/party-bot.ts';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
};
const RUNS = Number(arg('runs', '200'));
const SEED = arg('seed', 'factions');
const MONTHS = Number(arg('months', '24'));
const PARTY = arg('party', '');
const pct = (n: number) => `${Math.round((100 * n) / RUNS)}%`;
const avg = (n: number) => (n / RUNS).toFixed(1);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const data = { srd: loadSrd(), content: loadContent(), listeners: WORLD_LISTENERS };
const ids = data.content.factions.factions.map((f) => f.id);
const checkpoints = Array.from({ length: Math.floor(MONTHS / 6) }, (_, i) => (i + 1) * 6);
type Tally = { alive: number; bases: number; assets: number };
const tally = new Map<string, Tally>();
const clocks = new Map<number, number[]>();
const ended = { begun: 0, lifted: 0, fallen: 0 };

if (PARTY) {
  withParty();
  process.exit(0);
}

for (let run = 0; run < RUNS; run++) {
  // Only what the faction turn touches; the party plays no part.
  const w = {
    rng: createRng(`${SEED}-${run}`),
    factions: {},
    clock: 0,
    day: 0,
    log: [],
    sieges: [],
    raided: {},
    towns: {},
    majorProjects: {},
    quests: {},
    workings: [],
    members: [],
    dungeon: null,
    encounter: null,
    renown: 0,
    region: 'dark-lands',
    position: { col: -1, row: -1 },
  };
  const world = w as unknown as World;
  startFactions(world, data);
  for (let month = 1; month <= MONTHS; month++) {
    world.log = [];
    factionTurn(world, data);
    // The month's days, each with any assault due.
    for (let d = 0; d < data.content.overlandRules.daysPerMonth; d++) {
      siegesListener(world, data, { kind: 'day-passed' });
      world.day += 1;
    }
    for (const line of world.log) {
      if (line.includes('lays siege to')) ended.begun += 1;
      if (line.includes('is lifted')) ended.lifted += 1;
      if (/ falls to /.test(line)) ended.fallen += 1;
    }
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
console.log(
  `| clock (median) | ${checkpoints.map((m) => median(clocks.get(m) ?? [])).join(' | ')} |`,
);
console.log(
  `Sieges per run: ${avg(ended.begun)} begun, ${avg(ended.lifted)} lifted, ${avg(ended.fallen)} fallen.`,
);

/** The --party report: the Settlements, the sieges, and the party, with no party and at each level. */
function withParty(): void {
  const levels = [0, ...PARTY.split(',').map(Number)];
  const days = data.content.overlandRules.daysPerMonth;
  console.log(`${RUNS} runs a level, seed "${SEED}"; level 0 is no party.`);
  console.log(
    `| Level | ${checkpoints.map((m) => `Settlements, month ${m}`).join(' | ')} | Sieges begun, lifted, fallen | Party wiped (median month) | Fights (siege), won | Towns freed by the party | Freeing quests paid |`,
  );
  console.log(
    `| --- | ${checkpoints.map(() => '---').join(' | ')} | --- | --- | --- | --- | --- |`,
  );
  for (const level of levels) {
    const standing = new Map<number, number>();
    const sieges = { begun: 0, lifted: 0, fallen: 0 };
    const wipes: number[] = [];
    let fights = 0;
    let siegeFights = 0;
    let won = 0;
    let freed = 0;
    let quests = 0;
    for (let run = 0; run < RUNS; run++) {
      const w = siegeWorld(data, `${SEED}-${level}-${run}`, level);
      const r = newRun(w);
      for (let month = 1; month <= MONTHS; month++) {
        playUntil(w, data, r, month * days, month);
        if (!checkpoints.includes(month)) continue;
        const s = w.factions[data.content.siegeRules.ally];
        if (s && s.hp > 0) standing.set(month, (standing.get(month) ?? 0) + 1);
      }
      for (const line of w.log) {
        if (line.includes('lays siege to')) sieges.begun += 1;
        if (line.includes('is lifted')) sieges.lifted += 1;
        if (/ falls to /.test(line)) sieges.fallen += 1;
      }
      if (r.wipedIn !== null) wipes.push(r.wipedIn);
      fights += r.fights;
      siegeFights += r.siegeFights;
      won += r.won;
      freed += r.freed;
      quests += r.quests;
    }
    const wiped =
      level === 0 ? '-' : `${pct(wipes.length)} (${wipes.length > 0 ? median(wipes) : '-'})`;
    const party =
      level === 0
        ? '- | - | -'
        : `${avg(fights)} (${avg(siegeFights)}), ${avg(won)} | ${avg(freed)} | ${avg(quests)}`;
    console.log(
      `| ${level} | ${checkpoints.map((m) => pct(standing.get(m) ?? 0)).join(' | ')} | ${avg(sieges.begun)}, ${avg(sieges.lifted)}, ${avg(sieges.fallen)} | ${wiped} | ${party} |`,
    );
  }
}
