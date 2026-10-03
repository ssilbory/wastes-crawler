import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works from any GitHub Pages project path.
  base: './',
  // Preact JSX through Vite's built-in Oxc transform; @preact/preset-vite pulls in Babel, whose
  // dependencies fail the pnpm trust policy.
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/rules/**/*.ts', 'src/game/**/*.ts'],
      reporter: ['text', 'html'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
