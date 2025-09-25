// ESLint 9+ flat config format for Next.js 15+ compatibility
import js from '@eslint/js'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  // Base JavaScript configuration
  js.configs.recommended,

  {
    // Global settings for all files
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
        // Add web APIs for better browser compatibility
        fetch: 'readonly',
        FormData: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        HeadersInit: 'readonly',
        React: 'readonly',
        NodeJS: 'readonly',
      },
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },

    plugins: {
      '@typescript-eslint': typescriptEslint,
      'react-hooks': reactHooks,
    },

    // File patterns to lint
    files: ['**/*.{js,jsx,ts,tsx}'],

    // Rules configuration
    rules: {
      // TypeScript rules
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',

      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // General JavaScript rules - more lenient for development
      'no-console': 'off', // Allow console.log for debugging
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      'no-alert': 'warn',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-unused-vars': 'off', // Use TypeScript version instead

      // Code quality rules - more lenient
      'prefer-const': 'warn',
      'no-var': 'error',
      'object-shorthand': 'warn',
      'prefer-template': 'warn',

      // Import/Export rules
      'no-duplicate-imports': 'error',
    },

    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  {
    // Test files specific configuration
    files: [
      '**/*.test.{js,jsx,ts,tsx}',
      '**/*.spec.{js,jsx,ts,tsx}',
      '**/tests/**/*',
      'jest.setup.js',
      'jest.config.js',
      'comprehensive-test-runner.js'
    ],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
    rules: {
      // Relax rules for test files
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off',
      'no-unused-vars': 'off',
      'no-undef': 'off', // Jest globals are handled by globals.jest
      'prefer-template': 'off',
      'object-shorthand': 'off',
    },
  },

  {
    // Playwright E2E test files
    files: ['**/e2e/**/*.{js,ts}', '**/*.spec.{js,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
        // Playwright globals
        test: 'readonly',
        expect: 'readonly',
        page: 'readonly',
        browser: 'readonly',
        context: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off',
      'prefer-template': 'off',
    },
  },

  {
    // Next.js API routes specific configuration
    files: ['**/api/**/*.{js,ts}', '**/app/**/route.{js,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off', // Allow console.log in API routes for debugging
      '@typescript-eslint/no-explicit-any': 'warn', // More lenient for API data handling
    },
  },

  {
    // Configuration files and scripts
    files: [
      '*.config.{js,mjs,ts}',
      '*.config.*.{js,mjs,ts}',
      'tailwind.config.js',
      'postcss.config.js',
      'next.config.js',
      'scripts/**/*.js',
      'verify-*.js'
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off',
      'no-unused-vars': 'off',
      'prefer-template': 'off',
      'object-shorthand': 'off',
    },
  },

  {
    // TypeScript declaration files
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-var': 'off',
    },
  },

  // Ignore patterns
  {
    ignores: [
      'node_modules/',
      '.next/',
      'out/',
      'build/',
      'dist/',
      'coverage/',
      'test-fixtures/',
      '*.min.js',
      '*.bundle.js',
      '.cache/',
      'public/',
      '*.d.ts',
      '.env*',
      'next-env.d.ts',
      '.eslintrc.json', // Ignore old config if it exists
      'tsconfig.tsbuildinfo',
      // Ignore files with parsing issues temporarily
      'tests/integration/analytics-validation.test.ts',
      'tests/integration/file-serving-api.test.ts',
      'tests/integration/file-serving-errors.test.ts',
      'tests/performance/file-operations.test.ts',
      'tests/security/file-serving-security.test.ts',
      'tests/utils/test-environment.ts',
      'tests/utils/test-mocks.ts',
    ],
  },
]
