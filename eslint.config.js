import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'vendor/', 'node_modules/', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the injected seeded RNG.' },
      ],
    },
  },
  {
    // Rules and data are pure: no DOM, storage, network, or clock.
    files: ['src/rules/**/*.ts', 'src/data/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'localStorage',
          'sessionStorage',
          'navigator',
          'fetch',
          'Date',
          'performance',
          'setTimeout',
          'setInterval',
          'indexedDB',
          'XMLHttpRequest',
          'WebSocket',
          'crypto',
          'globalThis',
        ].map((name) => ({
          name,
          message: 'Rules and data stay pure; pass this in from the game layer.',
        })),
      ],
    },
  },
  {
    files: ['src/data/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '**/rules',
            '**/rules/**',
            '**/game',
            '**/game/**',
            '**/render',
            '**/render/**',
            '**/ui',
            '**/ui/**',
          ],
        },
      ],
    },
  },
  {
    files: ['src/rules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['**/game', '**/game/**', '**/render', '**/render/**', '**/ui', '**/ui/**'] },
      ],
    },
  },
  {
    files: ['src/game/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['**/render', '**/render/**', '**/ui', '**/ui/**'] },
      ],
    },
  },
  prettier,
);
