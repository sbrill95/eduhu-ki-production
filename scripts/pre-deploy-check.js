#!/usr/bin/env node

/**
 * Pre-deployment check script
 * Runs comprehensive checks before deployment to catch issues locally
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Running pre-deployment checks...\n');

const checks = [
  {
    name: 'TypeScript compilation',
    command: 'npm run build',
    description: 'Checks if Next.js build succeeds'
  },
  {
    name: 'ESLint validation',
    command: 'npm run lint:check',
    description: 'Validates code quality and catches syntax errors'
  },
  {
    name: 'Test suite',
    command: 'npm run test:ci',
    description: 'Runs all tests with coverage reporting'
  }
];

let allPassed = true;
const results = [];

for (const check of checks) {
  console.log(`🧪 ${check.name}...`);

  try {
    const startTime = Date.now();
    const output = execSync(check.command, {
      cwd: process.cwd(),
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 300000 // 5 minutes
    });

    const duration = Date.now() - startTime;
    console.log(`   ✅ Passed (${duration}ms)`);
    results.push({
      name: check.name,
      status: 'PASSED',
      duration,
      output: output.slice(-500) // Last 500 characters
    });

  } catch (error) {
    console.log(`   ❌ Failed`);
    console.log(`   Error: ${error.message}`);
    if (error.stdout) {
      console.log(`   Output: ${error.stdout.slice(-1000)}`); // Last 1000 characters
    }
    if (error.stderr) {
      console.log(`   Error Details: ${error.stderr.slice(-1000)}`);
    }

    allPassed = false;
    results.push({
      name: check.name,
      status: 'FAILED',
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr
    });
  }

  console.log(); // Empty line
}

// Generate report
const reportPath = path.join(process.cwd(), 'pre-deploy-report.json');
const report = {
  timestamp: new Date().toISOString(),
  overallStatus: allPassed ? 'PASSED' : 'FAILED',
  checks: results,
  summary: {
    total: checks.length,
    passed: results.filter(r => r.status === 'PASSED').length,
    failed: results.filter(r => r.status === 'FAILED').length
  }
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

// Final summary
console.log('📋 Pre-deployment Check Summary:');
console.log(`   Total checks: ${report.summary.total}`);
console.log(`   Passed: ${report.summary.passed}`);
console.log(`   Failed: ${report.summary.failed}`);
console.log(`   Report: ${reportPath}`);

if (allPassed) {
  console.log('\n🚀 All checks passed! Ready for deployment.');
  process.exit(0);
} else {
  console.log('\n🛑 Some checks failed. Fix issues before deploying.');
  console.log('\n💡 Common fixes:');
  console.log('   - Run npm run lint --fix for code style issues');
  console.log('   - Check TypeScript errors with npm run build locally');
  console.log('   - Review test failures and update code accordingly');
  process.exit(1);
}