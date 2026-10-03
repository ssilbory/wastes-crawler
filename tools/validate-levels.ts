// pnpm validate:levels: checks every dungeon level (docs/decisions/0003-level-authoring.md) and
// prints each level's size, or the problems found.
import { loadContent } from '../src/data/content.ts';
import { dungeonReferenceErrors } from '../src/data/dungeon-check.ts';
import { parseLevelMap } from '../src/data/dungeon-map.ts';

const content = loadContent();
const errors = dungeonReferenceErrors(content);
for (const d of content.dungeons) {
  for (const level of d.levels) {
    const parsed = parseLevelMap(level.map);
    if (parsed.ok) console.log(`${d.id}/${level.id}: ${parsed.map.width}x${parsed.map.height}`);
  }
}
if (errors.length > 0) {
  for (const e of errors) console.error(e);
  process.exit(1);
}
console.log(`All ${content.dungeons.length} dungeons are valid.`);
