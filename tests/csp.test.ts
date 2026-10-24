import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CSP } from '../tools/csp.ts';

// The policy lives twice: the meta tag the build writes (tools/csp.ts) and the header the Docker
// image's nginx sends (docker/security-headers.conf). They must not drift apart.
describe('the Content Security Policy', () => {
  it('is the same in the page and in nginx, which adds only frame-ancestors', () => {
    const conf = readFileSync('docker/security-headers.conf', 'utf8');
    const header = /add_header Content-Security-Policy "([^"]+)" always;/.exec(conf)?.[1];
    expect(header).toBe(`${CSP}; frame-ancestors 'none'`);
  });

  it('allows nothing from outside the game, and no eval', () => {
    expect(CSP).not.toMatch(/unsafe-|https?:|\*/);
  });
});
