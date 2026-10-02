import { execFileSync } from 'node:child_process';

/** Shipped (production) dependencies must use one of these. */
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

/** No dependency at all, dev tooling included, may use these. */
const DENIED = /\b(?:A?GPL|LGPL|EPL|MS-PL)\b/i;

type Report = Record<string, { name: string; versions: string[] }[]>;

// npm_execpath is the running pnpm, which may not be on PATH when pnpm runs through corepack.
function licenses(prodOnly: boolean): Report {
  const args = ['licenses', 'list', '--json', ...(prodOnly ? ['--prod'] : [])];
  return JSON.parse(
    execFileSync(process.env.npm_execpath ?? 'pnpm', args, { encoding: 'utf8' }) || '{}',
  ) as Report;
}

const describe = (license: string, pkgs: Report[string]) =>
  pkgs.map((p) => `${p.name}@${p.versions.join(',')}: ${license}`);

const shipped = licenses(true);
const violations = [
  ...Object.entries(shipped)
    .filter(([license]) => !ALLOWED.has(license))
    .flatMap(([license, pkgs]) => describe(license, pkgs)),
  ...Object.entries(licenses(false))
    .filter(([license]) => DENIED.test(license))
    .flatMap(([license, pkgs]) => describe(license, pkgs)),
];

if (violations.length > 0) {
  console.error('Dependencies with disallowed licenses:');
  for (const v of new Set(violations)) console.error(`  ${v}`);
  process.exit(1);
}
const count = Object.values(shipped).reduce((n, pkgs) => n + pkgs.length, 0);
console.log(`${count} shipped dependencies use allowed licenses; no GPL-family dependencies.`);
