module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: ['./tsconfig.app.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'jsx-a11y', 'import'],
  extends: ['airbnb', 'airbnb/hooks', 'airbnb-typescript', 'prettier'],
  settings: {
    react: { version: '18' },
    'import/resolver': {
      typescript: { project: ['./tsconfig.app.json', './tsconfig.node.json'] },
      node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
    },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/jsx-filename-extension': ['error', { extensions: ['.tsx'] }],
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        jsx: 'never',
        ts: 'always',
        tsx: 'always',
      },
    ],
    'import/prefer-default-export': 'off',
  },
  ignorePatterns: [
    'dist',
    'coverage',
    'node_modules',
    '.eslintrc.cjs',
    'vite.config.*',
    'vitest.config.*',
    'playwright.config.*',
    'tests/e2e/**',
    'test-results/**',
    'playwright-report/**',
  ],
  overrides: [
    {
      files: ['**/*.test.{ts,tsx}', '**/setupTests.ts'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
    {
      // PRD §8.4 — privacy: parsing & engine modules must never make network calls.
      // Excludes test files and fixtures (not shipped to users).
      files: ['src/parsing/**/*.{ts,tsx}', 'src/pnl/**/*.{ts,tsx}'],
      excludedFiles: ['**/*.test.{ts,tsx}', '**/__fixtures__/**'],
      rules: {
        'no-restricted-globals': [
          'error',
          { name: 'fetch', message: 'PRD §8.4 — privacy: no network calls in src/parsing/ or src/pnl/.' },
          { name: 'XMLHttpRequest', message: 'PRD §8.4 — privacy: no network calls in src/parsing/ or src/pnl/.' },
          { name: 'WebSocket', message: 'PRD §8.4 — privacy: no network calls in src/parsing/ or src/pnl/.' },
          { name: 'EventSource', message: 'PRD §8.4 — privacy: no network calls in src/parsing/ or src/pnl/.' },
        ],
        'no-restricted-properties': [
          'error',
          { object: 'navigator', property: 'sendBeacon', message: 'PRD §8.4 — privacy: no network calls in src/parsing/ or src/pnl/.' },
          { object: 'window', property: 'fetch', message: 'PRD §8.4 — privacy: no network calls in src/parsing/ or src/pnl/.' },
        ],
      },
    },
  ],
};
