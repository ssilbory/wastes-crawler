// pnpm economy: the Phase 9 economy validator (docs/rules-adaptation.md, Economy validator in
// Phase 9). Runs every policy in data/economy-sim.json over its seeds and fails on any lock-out.
import { readFileSync } from 'node:fs';
import { loadContent } from '../src/data/content.ts';
import { loadSrd } from '../src/data/load.ts';
import { EconomySimSchema } from '../src/data/schemas/index.ts';
import { economyReport, LOCKOUTS, passes, RULED_OUT } from '../src/game/economy/report.ts';

const data = { srd: loadSrd(), content: loadContent() };
const sim = EconomySimSchema.parse(JSON.parse(readFileSync('data/economy-sim.json', 'utf8')));
const reports = economyReport(data, sim);

console.log(`${sim.delves} delves x ${sim.seeds} seeds per policy`);
for (const r of reports) {
  console.log(
    `\n${r.policy}: median purse ${r.medianPurse.toFixed(1)}, best level ${r.medianLevel}, ${r.medianDays} days`,
  );
  const { quest, paid, recruited } = r.raised;
  console.log(`  the dead: ${quest} raised by quest, ${paid} for crowns, ${recruited} replaced`);
  console.log(`  hirelings who left unpaid: ${r.hirelingsLeft}`);
  for (const k of LOCKOUTS) {
    const l = r.locks[k];
    console.log(
      `  ${k.padEnd(15)} ${l.seeds}/${sim.seeds} seeds${l.firstDelve ? `, first at delve ${l.firstDelve}` : ''}`,
    );
  }
}
console.log('\nRuled out by construction:');
for (const line of RULED_OUT) console.log(`  ${line}`);
const ok = passes(reports);
console.log(ok ? '\nNo lock-outs.' : '\nLock-outs found.');
process.exit(ok ? 0 : 1);
