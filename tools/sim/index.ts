// pnpm sim: runs auto-combat fights between exported characters and SRD monsters and reports the
// win rate and average rounds. Each fight gets its own seeded RNG stream, so runs are repeatable.
//
//   pnpm sim -- --party tools/sim/parties/starter --rear Lirael,Fizzwick
//                --enemies "thug-or-militia*4/veteran-soldier*2" --fights 1000 --seed sim [--log]
//
// PCs fill the front row in file order; those named in --rear stand in the back row instead.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from '../../src/data/content.ts';
import { loadSrd } from '../../src/data/load.ts';
import { allMonsters } from '../../src/data/monsters.ts';
import type { Character } from '../../src/data/schemas/index.ts';
import { createBattle, runBattle } from '../../src/game/combat/battle.ts';
import { importCharacter } from '../../src/game/character/io.ts';
import { createRng } from '../../src/rules/rng.ts';
import { WORLD_LISTENERS } from '../../src/game/world/listeners.ts';

const data = { srd: loadSrd(), content: loadContent(), listeners: WORLD_LISTENERS };

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

function loadParty(spec: string): Character[] {
  const files = spec.split(',').flatMap((p) =>
    statSync(p).isDirectory()
      ? readdirSync(p)
          .filter((f) => f.endsWith('.json'))
          .sort()
          .map((f) => join(p, f))
      : [p],
  );
  return files.map((f) => {
    const r = importCharacter(readFileSync(f, 'utf8'), data);
    if (!r.ok) throw new Error(`${f}: ${r.errors.join('; ')}`);
    return r.character;
  });
}

/** "thug-or-militia*4,petty-mage/veteran-soldier*2": rows split by '/', counts by '*'. */
function parseEnemies(spec: string): string[][] {
  return spec.split('/').map((row) =>
    row.split(',').flatMap((entry) => {
      const [id = '', count = '1'] = entry.trim().split('*');
      if (!allMonsters(data.srd, data.content).some((m) => m.id === id))
        throw new Error(`unknown monster ${id}`);
      return Array(Number(count)).fill(id) as string[];
    }),
  );
}

const party = loadParty(arg('party', 'tools/sim/parties/starter'));
const enemies = parseEnemies(arg('enemies', 'thug-or-militia*4/veteran-soldier*2'));
const fights = Number(arg('fights', '1000'));
const rearNames = arg('rear', 'Lirael,Fizzwick')
  .split(',')
  .map((n) => n.trim().toLowerCase());
const rear = party.filter((c) => rearNames.includes(c.name.toLowerCase()));
const front = party.filter((c) => !rear.includes(c));
if (front.length > 4 || rear.length > 4) throw new Error('each row holds four characters');
const placed = [
  ...front.map((character, column) => ({ character, row: 0, column })),
  ...rear.map((character, column) => ({ character, row: 1, column })),
];
const seed = arg('seed', 'sim');

const tally = { party: 0, enemy: 0, draw: 0, rounds: 0, winRounds: 0, deaths: 0 };
for (let i = 0; i < fights; i++) {
  const battle = createBattle({
    data,
    rng: createRng(`${seed}-${i}`),
    party: placed,
    enemies,
    log: i === 0 && process.argv.includes('--log'),
  });
  const result = runBattle(battle);
  if (battle.log) console.log(battle.log.join('\n'), '\n');
  tally[result.outcome] += 1;
  tally.rounds += result.rounds;
  tally.deaths += result.deaths;
  if (result.outcome === 'party') tally.winRounds += result.rounds;
}

const pct = (n: number) => `${((100 * n) / fights).toFixed(1)}%`;
console.log(`Party: ${party.map((c) => c.name).join(', ')}`);
console.log(`Enemies: ${enemies.map((r) => r.join(', ')).join(' / ')}`);
console.log(`Fights: ${fights}, seed "${seed}"`);
console.log(`Win rate: ${pct(tally.party)} (losses ${pct(tally.enemy)}, draws ${pct(tally.draw)})`);
console.log(
  `Average rounds: ${(tally.rounds / fights).toFixed(2)} (wins: ${(tally.winRounds / Math.max(1, tally.party)).toFixed(2)})`,
);
console.log(`Average PC deaths per fight: ${(tally.deaths / fights).toFixed(2)}`);
