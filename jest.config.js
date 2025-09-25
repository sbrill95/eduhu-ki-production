const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/app/(.*)$': '<rootDir>/src/app/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/layout.tsx', // Exclude layout as it's mostly boilerplate
    '!src/app/globals.css', // Exclude CSS files
    '!src/**/*.stories.{js,jsx,ts,tsx}', // Exclude Storybook files
    '!src/**/*.test.{js,jsx,ts,tsx}', // Exclude test files from coverage
    '!src/**/*.spec.{js,jsx,ts,tsx}', // Exclude spec files from coverage
    '!src/**/index.{js,jsx,ts,tsx}', // Exclude barrel exports
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Higher coverage required for critical components
    './src/components/chat/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/lib/database.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
    '<rootDir>/tests/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],
  // Coverage reporting configuration for CI/CD
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json',
    'json-summary',
    'cobertura' // For Azure DevOps, GitLab CI
  ],
  coverageDirectory: 'coverage',
  // CI-specific configuration
  ci: process.env.CI === 'true',
  silent: process.env.CI === 'true',
  verbose: process.env.CI !== 'true',
  // Performance optimizations for CI
  maxWorkers: process.env.CI === 'true' ? 2 : '50%',
  moduleDirectories: ['node_modules', '<rootDir>/'],
  testTimeout: 10000, // 10 seconds for database operations
  // Retry failed tests in CI
  // Fail fast in CI to save build time
  bail: process.env.CI === 'true' ? 1 : 0
}

// Enhanced Jest configuration with CI/CD optimizations
module.exports = async () => {
  const jestConfig = await createJestConfig(customJestConfig)()

  // Add additional CI/CD specific configurations
  if (process.env.CI === 'true') {
    jestConfig.reporters = [
      'default',
      ['jest-junit', {
        outputDirectory: 'test-artifacts/unit-test-results',
        outputName: 'results.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }]
    ]

    // Override coverage directory for CI to match expected artifact paths
    jestConfig.coverageDirectory = 'test-artifacts/unit-test-results/coverage'
  }

  return jestConfig
}