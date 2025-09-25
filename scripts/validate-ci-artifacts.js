#!/usr/bin/env node

/**
 * CI/CD Artifact Validation Script
 * Validates that all required test artifacts are generated for the pipeline
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_ARTIFACTS = {
  'test-artifacts/unit-test-results/coverage/coverage-summary.json': 'Coverage summary JSON',
  'test-artifacts/unit-test-results/coverage/lcov.info': 'LCOV coverage report',
  'test-artifacts/unit-test-results/results.xml': 'Jest JUnit XML results'
};

function validateArtifacts() {
  console.log('🔍 Validating CI/CD test artifacts...\n');

  let allValid = true;

  for (const [filePath, description] of Object.entries(REQUIRED_ARTIFACTS)) {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const size = (stats.size / 1024).toFixed(2);
      console.log(`✅ ${description}: ${filePath} (${size} KB)`);

      // Additional validation for coverage-summary.json
      if (filePath.includes('coverage-summary.json')) {
        try {
          const coverage = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (coverage.total && coverage.total.lines) {
            console.log(`   📊 Line coverage: ${coverage.total.lines.pct}%`);
            console.log(`   📊 Statement coverage: ${coverage.total.statements.pct}%`);
            console.log(`   📊 Function coverage: ${coverage.total.functions.pct}%`);
            console.log(`   📊 Branch coverage: ${coverage.total.branches.pct}%`);
          }
        } catch (e) {
          console.log(`   ⚠️  Warning: Could not parse coverage data`);
        }
      }
    } else {
      console.log(`❌ Missing: ${description} (${filePath})`);
      allValid = false;
    }
  }

  console.log('\n' + '='.repeat(60));

  if (allValid) {
    console.log('🎉 All CI/CD artifacts are present and valid!');
    console.log('✅ Pipeline should be able to:');
    console.log('   - Parse coverage data');
    console.log('   - Generate test reports');
    console.log('   - Check quality gates');
    console.log('   - Upload artifacts to CI/CD system');
    process.exit(0);
  } else {
    console.log('❌ Some CI/CD artifacts are missing!');
    console.log('💡 Run `npm run test:coverage` or `npm run test:ci` to generate them.');
    process.exit(1);
  }
}

// Additional directory structure validation
function validateDirectoryStructure() {
  const requiredDirs = [
    'test-artifacts',
    'test-artifacts/unit-test-results',
    'test-artifacts/unit-test-results/coverage'
  ];

  for (const dir of requiredDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  }
}

if (require.main === module) {
  validateDirectoryStructure();
  validateArtifacts();
}