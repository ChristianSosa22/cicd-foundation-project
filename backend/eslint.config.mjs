import js from '@eslint/js';

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'eslint.config.js', '*.cjs'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
