import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * ESLint config notes
 * ──────────────────────────────────────────────────────────────────────────
 * CI runs `npm run lint` and fails on errors. We deliberately downgrade
 * several rules that fire on patterns deeply embedded in the codebase so
 * CI stays a useful regression gate without forcing a multi-day refactor
 * sprint. The goal: catch NEW tech debt at PR time, not gate everything
 * behind cleaning up the existing 60+ accumulated lint issues from
 * pre-CI development.
 *
 * Anything downgraded to 'warn' still surfaces in editor + CI output,
 * just doesn't fail the build. Tighten back to 'error' as the codebase
 * is cleaned up.
 */

export default defineConfig([
  globalIgnores(['dist', 'test-results', 'playwright-report']),
  // ─── Playwright tests run in Node, not the browser ──────────────────
  // Override block placed FIRST so the later browser-globals block doesn't
  // shadow it for tests/. Tests reference process.env and use the @playwright/test
  // runtime, both of which expect Node globals.
  {
    files: ['tests/**/*.{ts,tsx}', 'playwright.config.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // ─── Unused vars: allow `_`-prefixed intentional ignores ────────────
      // Standard convention for "I know it's unused, leaving it for shape".
      // Keep as error otherwise — genuine dead vars are real cleanup signal.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],

      // ─── `any` is debt, not a bug ───────────────────────────────────────
      // Lots of legacy `any` from early prototyping. Warn so it's visible
      // and discouraged in new code without blocking CI.
      '@typescript-eslint/no-explicit-any': 'warn',

      // ─── React refresh / HMR boundary warnings ──────────────────────────
      // ConfirmDialog + PromptDialog co-export Provider/hook/component.
      // Splitting the files later is fine; not worth blocking CI on it.
      'react-refresh/only-export-components': 'warn',

      // ─── React 19 strict-mode rules ─────────────────────────────────────
      // These flag patterns that were valid (and recommended) in React 18:
      //   - setState inside useEffect bodies (used in our debounce + auth
      //     pattern across InitialPage, ItineraryForm, useBookmarks)
      //   - inline component definitions (the SuggestionDropdown helper
      //     inside ItineraryForm)
      //   - reading ref.current during render (passing mapRef.current as
      //     a prop in MapView — actually safe and intentional here)
      // Each requires real refactoring with semantic implications. Disable
      // for now; revisit when we touch those components anyway.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/refs': 'off',

      // ─── Style nits — surface as warnings ───────────────────────────────
      'no-useless-escape': 'warn',
      'prefer-const': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
    },
  },
])
