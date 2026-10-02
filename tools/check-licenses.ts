import { execFileSync } from 'node:child_process';

const ALLOWED = new Set([
  'MIT',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'ISC',
  'Zlib',
  'CC0-1.0',
  '0BSD',
]);

// Only shipped (production) dependencies are checked; dev tooling never reaches the build.
// npm_execpath is the running pnpm, which may not be on PATH when pnpm runs through corepack.
const report = JSON.parse(
  execFileSync(process.env.npm_execpath ?? 'pnpm', ['licenses', 'list', '--prod', '--json'], {
    encoding: 'utf8',
  }) || '{}',
) as Record<string, { name: string; versions: string[] }[]>;

const violations = Object.entries(report)
  .filter(([license]) => !ALLOWED.has(license))
  .flatMap(([license, pkgs]) => pkgs.map((p) => `${p.name}@${p.versions.join(',')}: ${license}`));

if (violations.length > 0) {
  console.error('Production dependencies with licenses outside the allowlist:');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
const count = Object.values(report).reduce((n, pkgs) => n + pkgs.length, 0);
console.log(`${count} production dependencies use allowed licenses.`);
