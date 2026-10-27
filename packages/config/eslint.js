const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat();

/** @type {import('eslint').Linter.Config[]} */
const baseConfig = [
  ...compat.extends('plugin:@typescript-eslint/recommended'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
];

module.exports = { baseConfig };
