import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildVersion,
  listFiles,
  serviceWorkerSource,
  SW_FILE,
} from '../tools/pwa/service-worker.ts';

/** The PRECACHE list the generated worker carries. */
const precacheOf = (source: string): string[] =>
  JSON.parse(/const PRECACHE = (\[.*\]);/.exec(source)?.[1] ?? 'null');

describe('service worker build step', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sw-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html>');
    writeFileSync(join(dir, 'assets', 'index-abc.js'), 'run()');
    writeFileSync(join(dir, 'assets', 'font.woff2'), 'w2');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('lists every file under the build, as sorted URL paths', () => {
    expect(listFiles(dir)).toEqual(['assets/font.woff2', 'assets/index-abc.js', 'index.html']);
  });

  it('versions the cache by file names and contents', () => {
    const files = listFiles(dir);
    const before = buildVersion(dir, files);
    expect(before).toMatch(/^[0-9a-f]{12}$/);
    expect(buildVersion(dir, files)).toBe(before);
    writeFileSync(join(dir, 'assets', 'index-abc.js'), 'run(2)');
    expect(buildVersion(dir, files)).not.toBe(before);
  });

  it('precaches the start URL and every file but itself and the older .woff fonts', () => {
    const source = serviceWorkerSource(
      ['assets/a.js', 'assets/f.woff', 'assets/f.woff2', 'index.html', SW_FILE],
      'v1',
    );
    expect(precacheOf(source)).toEqual(['./', './assets/a.js', './assets/f.woff2', './index.html']);
    expect(source).toContain("const CACHE = 'wastes-crawler-v1';");
  });

  it('writes a worker that parses as JavaScript', () => {
    expect(() => new Function(serviceWorkerSource(['index.html'], 'v1'))).not.toThrow();
  });
});
