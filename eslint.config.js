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
    files: ['src/data/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['**/rules/**', '**/game/**', '**/render/**', '**/ui/**'] },
      ],
    },
  },
  {
    files: ['src/rules/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['**/game/**', '**/render/**', '**/ui/**'] }],
    },
  },
  {
    files: ['src/game/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['**/render/**', '**/ui/**'] }],
    },
  },
  prettier,
);
