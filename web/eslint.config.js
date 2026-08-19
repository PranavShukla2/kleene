import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    // `scripts/` is build tooling: plain Node ESM, run by hand, outside the app's tsconfig.
    // Type-aware linting cannot see it and there is nothing there worth type-aware linting.
    ignores: [
      'dist',
      'dev-dist',
      'node_modules',
      'scripts',
      'src/wasm/generated',
      'src/model/generated',
    ],
  },

  js.configs.recommended,

  // Type-aware rules. Slower than the syntactic ones, and worth it: the editor is about to
  // be full of state-id lookups, and the rules that catch a mishandled `undefined` or a
  // floating promise all need type information to work at all.
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // An unused variable is usually a half-finished edit. The underscore escape hatch
      // exists for genuinely-ignored callback parameters.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // The editor will be full of async work — layout, wasm, persistence. A promise
      // dropped on the floor there surfaces as a UI that silently does nothing.
      '@typescript-eslint/no-floating-promises': 'error',

      // Consistent type imports keep the wasm boundary honest: a type-only import cannot
      // accidentally pull a runtime value across it.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],
    },
  },

  // Config files run in Node and are not part of the app's type-checked program.
  {
    files: ['*.config.{js,ts}', 'eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },

  // Last, so formatting rules never fight Prettier.
  prettier,
);
