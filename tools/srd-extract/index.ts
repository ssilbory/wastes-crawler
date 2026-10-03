import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { SrdSchemas, type SrdData, type SrdFile } from '../../src/data/schemas/index.ts';
import { extractClasses, extractDualCasting } from './extractors/classes.ts';
import {
  extractArmor,
  extractGear,
  extractGearBundles,
  extractWeapons,
  extractWeaponTraits,
} from './extractors/equipment.ts';
import { extractArts, extractSpells } from './extractors/magic.ts';
import { extractMonsters } from './extractors/monsters.ts';
import { extractFoci, extractSkills } from './extractors/skills-foci.ts';
import { ErratumSchema, SrdReader } from './reader.ts';
import { crossReferenceErrors } from './validate.ts';

const ROOT = join(import.meta.dirname, '../..');
const VENDOR = join(ROOT, 'vendor/wwn-srd');
const OUT = join(ROOT, 'data/srd');
const check = process.argv.includes('--check');

const errata = z
  .array(ErratumSchema)
  .parse(JSON.parse(readFileSync(join(import.meta.dirname, 'errata.json'), 'utf8')));
const reader = new SrdReader(VENDOR, errata);

const traits = extractWeaponTraits(reader);
const classes = extractClasses(reader);
const raw: SrdData = {
  skills: extractSkills(reader),
  foci: extractFoci(reader),
  classes: classes.classes,
  progressions: classes.progressions,
  'casting-progressions': [...classes.casting, extractDualCasting(reader)],
  'weapon-traits': traits,
  weapons: extractWeapons(reader, traits),
  armor: extractArmor(reader),
  gear: extractGear(reader),
  'gear-bundles': extractGearBundles(reader),
  spells: extractSpells(reader),
  arts: extractArts(reader),
  monsters: extractMonsters(reader),
};

const problems: string[] = [];
for (const e of reader.unusedErrata()) problems.push(`unused erratum for ${e.file}: "${e.find}"`);
const data = {} as Record<SrdFile, unknown[]>;
for (const name of Object.keys(SrdSchemas) as SrdFile[]) {
  const result = SrdSchemas[name].safeParse(raw[name]);
  if (!result.success) {
    for (const issue of result.error.issues) {
      problems.push(`${name}[${issue.path.join('.')}]: ${issue.message}`);
    }
  } else {
    data[name] = result.data;
  }
}
problems.push(...crossReferenceErrors(raw));
if (problems.length > 0) {
  console.error(`SRD extraction failed with ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

type Rec = { id: string } & Record<string, unknown>;
function diff(name: string, before: Rec[], after: Rec[]): string[] {
  const lines: string[] = [];
  const old = new Map(before.map((r) => [r.id, r]));
  const now = new Map(after.map((r) => [r.id, r]));
  for (const [id, rec] of now) {
    const prev = old.get(id);
    if (!prev) lines.push(`  + ${name}/${id}`);
    else {
      const fields = Object.keys({ ...prev, ...rec }).filter(
        (k) => JSON.stringify(prev[k]) !== JSON.stringify(rec[k]),
      );
      if (fields.length > 0) lines.push(`  ~ ${name}/${id}: ${fields.join(', ')}`);
    }
  }
  for (const id of old.keys()) if (!now.has(id)) lines.push(`  - ${name}/${id}`);
  return lines;
}

const report: string[] = [];
let stale = false;
if (!check) mkdirSync(OUT, { recursive: true });
for (const name of Object.keys(data) as SrdFile[]) {
  const path = join(OUT, `${name}.json`);
  const text = `${JSON.stringify(data[name], null, 2)}\n`;
  const previous = existsSync(path) ? readFileSync(path, 'utf8') : undefined;
  if (previous === text) continue;
  stale = true;
  report.push(...diff(name, previous ? (JSON.parse(previous) as Rec[]) : [], data[name] as Rec[]));
  if (!check) writeFileSync(path, text);
}

const counts = (Object.keys(data) as SrdFile[]).map((n) => `${n} ${data[n].length}`).join(', ');
if (!stale) {
  console.log(`data/srd is up to date (${counts}).`);
} else if (check) {
  console.error('data/srd is stale; run pnpm srd:extract. Differences:');
  for (const line of report) console.error(line);
  process.exit(1);
} else {
  console.log(`Wrote data/srd (${counts}). Changes:`);
  for (const line of report) console.log(line);
}
