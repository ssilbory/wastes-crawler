// pnpm playtest: the starter party played for a span of days by a cautious bot (tools/playtest/
// bot.ts), many seeds over, to see how the early game plays: who wipes the party and when, how
// fast it levels, and whether its money holds. --without drops every encounter-table entry with a
// monster whose id starts with the given text, to compare the game without it.
//
//   pnpm playtest -- --seeds 40 --days 60 --seed playtest --without death-hare
import { loadContent } from '../src/data/content.ts';
import { loadSrd } from '../src/data/load.ts';
import type { GameData } from '../src/game/character/context.ts';
import { play, type Run } from './playtest/bot.ts';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
};
const SEEDS = Number(arg('seeds', '40'));
const DAYS = Number(arg('days', '60'));
const SEED = arg('seed', 'playtest');
const WITHOUT = arg('without', '');

const loaded: GameData = { srd: loadSrd(), content: loadContent() };
const data: GameData = WITHOUT
  ? {
      ...loaded,
      content: {
        ...loaded.content,
        encounterTables: loaded.content.encounterTables.map((t) => ({
          ...t,
          entries: t.entries.filter((e) => !e.groups.some((g) => g.monster.startsWith(WITHOUT))),
        })),
      },
    }
  : loaded;

const runs: Run[] = [];
for (let n = 1; n <= SEEDS; n++) runs.push(play(data, SEED, n, DAYS));

const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const one = (x: number) => x.toFixed(1);
const count = <T>(xs: T[]) => {
  const c = new Map<T, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1]);
};
const wiped = runs.filter((r) => r.wipedBy !== null);
const lived = runs.filter((r) => r.wipedBy === null);
// The four starters' night at the inn.
const night = 4 * loaded.content.townRules.innPerPc;

console.log(
  `${SEEDS} runs of ${DAYS} days, seed "${SEED}"${WITHOUT ? `, without ${WITHOUT}*` : ''}.`,
);
console.log('\n| Measure | Value |\n| --- | --- |');
const rows: [string, string][] = [
  ['Parties wiped', `${wiped.length} of ${runs.length}`],
  [
    'Wipe days',
    wiped
      .map((r) => r.days)
      .sort((a, b) => a - b)
      .join(', ') || '-',
  ],
  [
    'Survivors, levels',
    count(lived.map((r) => r.level))
      .sort((a, b) => a[0] - b[0])
      .map(([l, n]) => `${n} at ${l}`)
      .join(', ') || '-',
  ],
  ['Fights per survivor', one(mean(lived.map((r) => r.fights)))],
  ['Close calls per survivor', one(mean(lived.map((r) => r.closeCalls)))],
  ['Deaths per survivor', one(mean(lived.map((r) => r.deaths)))],
  ['Crowns gained per survivor', one(mean(lived.map((r) => r.endPurse - r.startPurse)))],
  [
    'Runs dropping below one inn night',
    `${runs.filter((r) => r.lowestPurse < night).length} (under ${night} crowns)`,
  ],
  ['Inn nights per survivor', one(mean(lived.map((r) => r.innNights)))],
  ['Hidden sites found per run', one(mean(runs.map((r) => r.sitesFound)))],
  ['Hungry nights per run', one(mean(runs.map((r) => r.hungryNights)))],
  ['Thirsty nights per run', one(mean(runs.map((r) => r.thirstyNights)))],
];
for (const [k, v] of rows) console.log(`| ${k} | ${v} |`);
if (wiped.length > 0) {
  console.log('\n| Wiped by | Parties |\n| --- | --- |');
  for (const [k, n] of count(wiped.map((r) => r.wipedBy))) console.log(`| ${k} | ${n} |`);
}
