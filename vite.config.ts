import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works from any GitHub Pages project path.
  base: './',
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/rules/**/*.ts'],
      reporter: ['text', 'html'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
