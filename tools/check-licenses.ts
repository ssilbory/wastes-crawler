import { execFileSync } from 'node:child_process';

/** Shipped (production) dependencies must use one of these. OFL covers the bundled fonts. */
const ALLOWED = new Set([
  'MIT',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'ISC',
  'Zlib',
  'CC0-1.0',
  '0BSD',
  'OFL-1.1',
]);

/** No dependency at all, dev tooling included, may be limited to these. */
const DENIED = /\b(?:A?GPL|LGPL|EPL|MS-PL)\b/i;

type Report = Record<string, { name: string; versions: string[] }[]>;

/** "(MIT OR GPL-3.0)" offers a choice; "(MIT AND GPL-3.0)" requires both. */
function options(expression: string): string[][] {
  return expression
    .replace(/[()]/g, '')
    .split(/\s+OR\s+/i)
    .map((choice) => choice.split(/\s+AND\s+/i).map((id) => id.trim()));
}

const shippable = (license: string) =>
  options(license).some((choice) => choice.every((id) => ALLOWED.has(id)));
const gplOnly = (license: string) =>
  options(license).every((choice) => choice.some((id) => DENIED.test(id)));

function licenses(prodOnly: boolean): Report {
  const args = ['licenses', 'list', '--json', ...(prodOnly ? ['--prod'] : [])];
  // npm_execpath is the running pnpm, which may not be on PATH when pnpm runs through corepack.
  // It's a native binary under corepack but a JavaScript file in some installs.
  const pnpm = process.env.npm_execpath ?? 'pnpm';
  const [cmd, cmdArgs] = /\.[cm]?js$/.test(pnpm)
    ? [process.execPath, [pnpm, ...args]]
    : [pnpm, args];
  return JSON.parse(execFileSync(cmd, cmdArgs, { encoding: 'utf8' }) || '{}') as Report;
}

const describe = (license: string, pkgs: Report[string]) =>
  pkgs.map((p) => `${p.name}@${p.versions.join(',')}: ${license}`);

const shipped = licenses(true);
const violations = [
  ...Object.entries(shipped)
    .filter(([license]) => !shippable(license))
    .flatMap(([license, pkgs]) => describe(license, pkgs)),
  ...Object.entries(licenses(false))
    .filter(([license]) => /^unknown$/i.test(license) || gplOnly(license))
    .flatMap(([license, pkgs]) => describe(license, pkgs)),
];

if (violations.length > 0) {
  console.error('Dependencies with disallowed or unknown licenses:');
  for (const v of new Set(violations)) console.error(`  ${v}`);
  process.exit(1);
}
const count = Object.values(shipped).reduce((n, pkgs) => n + pkgs.length, 0);
console.log(`${count} shipped dependencies use allowed licenses; no GPL-only dependencies.`);
