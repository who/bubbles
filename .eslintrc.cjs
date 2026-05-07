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
  ],
  overrides: [
    {
      files: ['**/*.test.{ts,tsx}', '**/setupTests.ts'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
  ],
};
