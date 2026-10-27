import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', '.claude', 'scripts/overnight.mjs'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/**/*.tsx', 'src/ui/**/*.ts', 'src/state/**/*.ts'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // src/sim is pure game rules: no randomness, wall clock, DOM, React or platform I/O.
    files: ['src/sim/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'src/sim must not read the clock.' },
        { name: 'window', message: 'src/sim must not touch the DOM.' },
        { name: 'document', message: 'src/sim must not touch the DOM.' },
        { name: 'localStorage', message: 'src/sim must not do I/O.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded Rng passed in.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'react/*', 'zustand'], message: 'src/sim is pure.' },
            {
              group: ['**/platform/**', '**/state/**', '**/ui/**', '**/render/**', '**/save/**'],
              message: 'src/sim must not depend on outer layers.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
