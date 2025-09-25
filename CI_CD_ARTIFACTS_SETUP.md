# CI/CD Test Artifacts Configuration

## Overview
This document describes the test artifact generation setup for the eduhu.ki CI/CD pipeline.

## Fixed Issues

### 1. Missing Coverage Files
**Problem**: `cat: test-artifacts/unit-test-results/coverage/coverage-summary.json: No such file or directory`

**Solution**: Updated Jest configuration to generate coverage files in the correct directory structure expected by CI/CD.

### 2. Jest JUnit XML Reports
**Problem**: CI/CD expected XML test results for reporting.

**Solution**: Configured `jest-junit` to output results to `test-artifacts/unit-test-results/results.xml`.

### 3. Coverage Threshold Configuration
**Problem**: Coverage thresholds were not properly enforced in CI environment.

**Solution**: Maintained 80% coverage threshold requirement with proper CI-specific configurations.

## Configuration Changes

### Jest Configuration (`jest.config.js`)

1. **Added CI-specific coverage directory**:
   ```javascript
   if (process.env.CI === 'true') {
     jestConfig.coverageDirectory = 'test-artifacts/unit-test-results/coverage'
   }
   ```

2. **Updated jest-junit configuration**:
   ```javascript
   ['jest-junit', {
     outputDirectory: 'test-artifacts/unit-test-results',
     outputName: 'results.xml',
     // ... other configurations
   }]
   ```

3. **Added json-summary reporter**:
   ```javascript
   coverageReporters: [
     'text', 'text-summary', 'html', 'lcov', 'json', 'json-summary', 'cobertura'
   ]
   ```

### Package.json Scripts

Updated test scripts to ensure proper CI compatibility:
- `test:ci`: Sets `CI=true` environment variable
- `test:coverage`: Added `--verbose` flag for detailed output
- `test:unit` & `test:integration`: Added `--verbose` flag

## Generated Artifacts

The CI/CD pipeline now generates these artifacts in the expected locations:

```
test-artifacts/
└── unit-test-results/
    ├── coverage/
    │   ├── coverage-summary.json  ← Required by QA pipeline
    │   ├── lcov.info             ← For codecov integration
    │   ├── coverage-final.json   ← Complete coverage data
    │   └── [HTML reports]
    └── results.xml               ← JUnit XML for CI/CD
```

## Usage

### Running Tests with CI Artifacts
```bash
# Generate all CI artifacts
npm run test:ci

# Generate only coverage artifacts
npm run test:coverage

# Validate artifacts are generated correctly
npm run validate:ci-artifacts
```

### In CI/CD Pipeline

The QA pipeline (`qa-pipeline.yml`) can now successfully:

1. **Check coverage thresholds**:
   ```bash
   COVERAGE=$(cat test-artifacts/unit-test-results/coverage/coverage-summary.json | jq '.total.lines.pct')
   ```

2. **Upload test results**:
   ```yaml
   - name: Store test results
     uses: actions/upload-artifact@v4
     with:
       name: unit-test-results
       path: |
         coverage/
         test-results/
   ```

3. **Generate quality reports**:
   ```bash
   node scripts/generate-qa-report.js
   ```

## Quality Gates

The pipeline enforces these quality gates:
- **Coverage**: 80% minimum (lines, statements, functions, branches)
- **Security**: No critical vulnerabilities
- **Accessibility**: WCAG compliance
- **Performance**: Lighthouse thresholds

## Validation

Use the validation script to ensure artifacts are properly generated:
```bash
npm run validate:ci-artifacts
```

This will check for:
- ✅ Coverage summary JSON exists and is valid
- ✅ LCOV coverage report exists
- ✅ JUnit XML results exist
- ✅ File sizes are reasonable
- ✅ Coverage data is parseable

## Next Steps

1. **Increase Test Coverage**: Add more unit tests to meet the 80% threshold
2. **Fix Failing Tests**: Address test failures for components and database integration
3. **Environment Configuration**: Set proper test environment variables for InstantDB

## Dependencies

Required packages (already installed):
- `jest-junit`: For XML test result generation
- `jest`: Test runner with coverage support
- Next.js jest configuration for proper module resolution