import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      // These v7 react-hooks rules are too strict for our intentional patterns
      // (reading from localStorage cache in effects, filtering in effects).
      // rules-of-hooks and exhaustive-deps remain enforced.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      // AuthContext exports both component and context — required for this pattern
      'react-refresh/only-export-components': 'off',
      // Empty catch blocks are acceptable when errors are intentionally swallowed
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
])
