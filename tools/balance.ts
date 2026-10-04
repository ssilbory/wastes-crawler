// pnpm balance: the campaign's fixed fights against the starter party levelled automatically
// (docs/rules-adaptation.md, Balance in Phase 12f). Each fight is run two ways: fresh, and worn
// down (Sam's call), as the last of a gauntlet with no rest: one wandering fight from the table of
// each level passed through (or of the hex, overland), then every garrison post on those levels,
// then the fight itself, with wounds, Frailty, strain, and spent spells carried through. It
// reports the win rate at the quest's minimum level and the lowest level that wins at least 70%
// of the time (Sam's target is 70-85% at the minimum level). Quest guardians reinforced by the
// warlord's clock are measured at tier 1.
//
//   pnpm balance -- --runs 200 --seed balance
import { fights, MAX_LEVEL, RUNS, SEED, TARGET, winRate, type Step } from './balance/gauntlet.ts';

const pct = (n: number) => `${Math.round(100 * n)}%`;
const lowest = (steps: Step[]) => {
  for (let level = 1; level <= MAX_LEVEL; level++)
    if (winRate(level, steps) >= TARGET) return String(level);
  return `>${MAX_LEVEL}`;
};
console.log(`${RUNS} runs each, seed "${SEED}"; the starter party levelled automatically.`);
console.log(
  '| Fight | Min level | Fresh at min | Worn at min | Lowest level, fresh | Lowest level, worn |',
);
console.log('| --- | --- | --- | --- | --- | --- |');
for (const f of fights) {
  const alone: Step[] = [{ enemies: f.enemies }];
  const worn: Step[] = [...f.before, { enemies: f.enemies }];
  const atMin = (steps: Step[]) => (f.minLevel === null ? '-' : pct(winRate(f.minLevel, steps)));
  console.log(
    `| ${f.name} | ${f.minLevel ?? '-'} | ${atMin(alone)} | ${atMin(worn)} | ${lowest(alone)} | ${lowest(worn)} |`,
  );
}
