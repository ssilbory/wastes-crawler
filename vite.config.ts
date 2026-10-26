import { defineConfig } from 'vitest/config';
import { contentSecurityPolicy } from './tools/csp.ts';
import { serviceWorker } from './tools/pwa/service-worker.ts';

export default defineConfig({
  // Relative base so the build works from any GitHub Pages project path.
  base: './',
  // Preact JSX through Vite's built-in Oxc transform; @preact/preset-vite pulls in Babel, whose
  // dependencies fail the pnpm trust policy.
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  // Writes dist/sw.js so the built game installs and plays offline (src/ui/pwa.ts), and puts the
  // Content Security Policy in the built page (tools/csp.ts).
  plugins: [serviceWorker(), contentSecurityPolicy()],
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/data/**/*.ts', 'src/rules/**/*.ts', 'src/game/**/*.ts', 'src/render/**/*.ts'],
      reporter: ['text', 'html'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
