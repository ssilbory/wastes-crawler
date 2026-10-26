// Guards the module graph: no runtime import cycle anywhere in src/. Type-only imports (`import
// type`, or braces holding only `type` names) are erased and don't count. Self-contained on purpose:
// a small import scanner and Tarjan's strongly connected components, no dependencies.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');

/** `import`/`export … from` statements; the clause holds only names, braces, commas and `*`. */
const FROM = /^\s*(?:import|export)\s+([\w\s{},*$]*?)\s*from\s*['"]([^'"]+)['"]/gm;
/** Side-effect imports: `import './x.ts';`. */
const BARE = /^\s*import\s*['"]([^'"]+)['"]/gm;

/** Whether an import or export clause brings in types only. */
export function typeOnly(clause: string): boolean {
  const c = clause.trim();
  if (/^type\s/.test(c)) return true;
  const braces = /^\{([^}]*)\}$/.exec(c);
  if (!braces) return false;
  const names = (braces[1] as string)
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  return names.length > 0 && names.every((n) => /^type\s/.test(n));
}

/** The relative module specifiers a source file loads at runtime. */
export function runtimeImports(source: string): string[] {
  const found: string[] = [];
  for (const m of source.matchAll(FROM)) if (!typeOnly(m[1] as string)) found.push(m[2] as string);
  for (const m of source.matchAll(BARE)) found.push(m[1] as string);
  return found.filter((s) => s.startsWith('.'));
}

/** Strongly connected components with more than one module, or a module importing itself. */
export function cycles(graph: ReadonlyMap<string, readonly string[]>): string[][] {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const found: string[][] = [];
  let next = 0;
  const visit = (v: string): void => {
    index.set(v, next);
    low.set(v, next);
    next += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of graph.get(v) ?? []) {
      if (!index.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v) as number, low.get(w) as number));
      } else if (onStack.has(w)) low.set(v, Math.min(low.get(v) as number, index.get(w) as number));
    }
    if (low.get(v) !== index.get(v)) return;
    const scc: string[] = [];
    let w: string;
    do {
      w = stack.pop() as string;
      onStack.delete(w);
      scc.push(w);
    } while (w !== v);
    if (scc.length > 1 || (graph.get(v) ?? []).includes(v)) found.push(scc.sort());
  };
  for (const v of graph.keys()) if (!index.has(v)) visit(v);
  return found;
}

/** One concrete loop inside a component, as `a -> b -> a`, so a failure names a path to cut. */
export function loopIn(graph: ReadonlyMap<string, readonly string[]>, scc: string[]): string {
  const members = new Set(scc);
  const start = scc[0] as string;
  const path = [start];
  const seen = new Set([start]);
  for (;;) {
    const here = path[path.length - 1] as string;
    const nextHop = (graph.get(here) ?? []).find((w) => members.has(w)) as string;
    if (seen.has(nextHop)) return [...path.slice(path.indexOf(nextHop)), nextHop].join(' -> ');
    seen.add(nextHop);
    path.push(nextHop);
  }
}

function sourceGraph(): Map<string, string[]> {
  const files = (readdirSync(SRC, { recursive: true }) as string[])
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.d.ts'))
    .map((f) => join(SRC, f));
  const known = new Set(files);
  const graph = new Map<string, string[]>();
  for (const file of files) {
    const deps = runtimeImports(readFileSync(file, 'utf8'))
      .map((s) => normalize(join(dirname(file), s)))
      .filter((d) => known.has(d));
    graph.set(relative(ROOT, file), [...new Set(deps.map((d) => relative(ROOT, d)))]);
  }
  return graph;
}

describe('the import scanner', () => {
  it('counts value imports, re-exports and side-effect imports, not type-only ones', () => {
    const source = [
      "import { a, type B } from './a.ts';",
      "import type { C } from './c.ts';",
      "import { type D, type E } from './d.ts';",
      'import {',
      '  f,',
      '  g,',
      "} from './f.ts';",
      "import * as h from './h.ts';",
      "import i, { type I } from './i.ts';",
      "export { j } from './j.ts';",
      "export type { K } from './k.ts';",
      "export * from './l.ts';",
      "import './m.ts';",
      "import { n } from 'preact';",
      "const s = 'not an import from \\'./x.ts\\'';",
    ].join('\n');
    expect(runtimeImports(source)).toEqual([
      './a.ts',
      './f.ts',
      './h.ts',
      './i.ts',
      './j.ts',
      './l.ts',
      './m.ts',
    ]);
  });

  it('finds cycles and names a loop in each', () => {
    const graph = new Map([
      ['a', ['b']],
      ['b', ['c', 'd']],
      ['c', ['a']],
      ['d', []],
      ['e', ['e']],
    ]);
    const found = cycles(graph);
    expect(found).toEqual([['a', 'b', 'c'], ['e']]);
    expect(loopIn(graph, found[0] as string[])).toBe('a -> b -> c -> a');
    expect(loopIn(graph, found[1] as string[])).toBe('e -> e');
  });
});

describe('src/', () => {
  it('has no runtime import cycle', () => {
    const graph = sourceGraph();
    expect(graph.size).toBeGreaterThan(100);
    const loops = cycles(graph).map((scc) => `${scc.length} modules: ${loopIn(graph, scc)}`);
    expect(loops).toEqual([]);
  });
});
