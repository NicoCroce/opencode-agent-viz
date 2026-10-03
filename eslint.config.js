import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import pluginReactConfig from 'eslint-plugin-react/configs/recommended.js';
import { fixupConfigRules } from '@eslint/compat';
import reactHooks from 'eslint-plugin-react-hooks';

const ignores = {
  ignores: [
    'coverage/**',
    'public/**',
    'dist/**',
    'node_modules/**',
    'pnpm-lock.yaml/**',
    '.opencode/**',
    '.specify/**',
    '.agents/**',
    '.atl/**',
    'specs/**',
    'scripts/**',
    'eslint.config.js',
    'postcss.config.js',
    'tailwind.config.js',
    'vite.config.ts',
    'vitest.config.ts',
  ],
};

const customRules = {
  rules: {
    'prettier/prettier': 0,
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        args: 'all',
        argsIgnorePattern: '^_',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
  },
};

export default [
  ignores,
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
        projectService: true,
        tsconfigRootDir: process.cwd(),
      },
      globals: globals.browser,
    },
  },
  customRules,
  ...fixupConfigRules(pluginReactConfig),
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      'import/prefer-default-export': 'off',
      'react/function-component-definition': [
        2,
        {
          namedComponents: 'arrow-function',
          unnamedComponents: 'arrow-function',
        },
      ],
      'react/jsx-pascal-case': 2,
      'react/prop-types': 0,
      'arrow-body-style': 0,
      'import/no-unresolved': 0,
      'import/extensions': 0,
      'no-unused-expressions': ['error', { allowShortCircuit: true }],
      'react/react-in-jsx-scope': 0,
    },
  },
];
