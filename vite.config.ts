import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works from any GitHub Pages project path.
  base: './',
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
