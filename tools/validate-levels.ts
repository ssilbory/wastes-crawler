// pnpm validate:levels: checks every dungeon level (docs/decisions/0003-level-authoring.md) and
// prints each level's size, or the problems found. Ruins are generated under many seeds and checked
// the same way.
import { loadContent } from '../src/data/content.ts';
import { dungeonReferenceErrors } from '../src/data/dungeon-check.ts';
import { parseLevelMap } from '../src/data/dungeon-map.ts';
import { generateRuin } from '../src/game/dungeon/generate.ts';

const content = loadContent();
const errors = dungeonReferenceErrors(content);
for (const d of content.dungeons) {
  for (const level of d.levels) {
    const parsed = parseLevelMap(level.map);
    if (parsed.ok) console.log(`${d.id}/${level.id}: ${parsed.map.width}x${parsed.map.height}`);
  }
}
// Ruins are generated (ADR 0004): every ruin is checked under a run of seeds.
const RUIN_SEEDS = 100;
for (const r of content.ruins)
  for (let seed = 1; seed <= RUIN_SEEDS; seed++)
    errors.push(...dungeonReferenceErrors({ ...content, dungeons: [generateRuin(r, seed)] }));
console.log(`${content.ruins.length} ruins generated under ${RUIN_SEEDS} seeds each.`);
if (errors.length > 0) {
  for (const e of errors) console.error(e);
  process.exit(1);
}
console.log(`All ${content.dungeons.length} dungeons are valid.`);
