// The Content Security Policy for the built game, written into index.html as a meta tag so it holds
// wherever the build is served, GitHub Pages included. Everything comes from the game's own origin:
// no inline script or style, no eval (src/ui/zod-jitless.ts), no third-party hosts. Images may also
// be data: URIs, as the select arrow in src/ui/theme/controls.css is. The Docker image's nginx sends
// the same policy as a header (docker/security-headers.conf), plus frame-ancestors, which a meta
// tag can't carry. Only builds get the tag: the dev server injects styles inline.
import type { Plugin } from 'vite';

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

/** The Vite plugin: puts the policy at the top of the built page's head. */
export function contentSecurityPolicy(): Plugin {
  return {
    name: 'wastes-crawler-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
        injectTo: 'head-prepend',
      },
    ],
  };
}
