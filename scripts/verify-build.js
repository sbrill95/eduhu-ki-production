#!/usr/bin/env node

/**
 * Build Verification Script
 *
 * This script runs comprehensive checks before deployment to prevent TypeScript errors.
 * Run with: npm run verify-build
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Starting comprehensive build verification...\n');

// Track all steps and failures
const steps = [];
let hasFailures = false;

function runStep(name, command, options = {}) {
  const step = { name, status: 'running', output: '', error: '' };
  steps.push(step);

  console.log(`⏳ ${name}...`);

  try {
    const startTime = Date.now();
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      timeout: options.timeout || 300000, // 5 minutes default
      ...options
    });

    const duration = Date.now() - startTime;
    step.status = 'success';
    step.output = output;
    step.duration = duration;

    console.log(`✅ ${name} completed in ${duration}ms\n`);

    return output;
  } catch (error) {
    step.status = 'failed';
    step.error = error.message;
    step.output = error.stdout || '';
    hasFailures = true;

    console.error(`❌ ${name} failed:`);
    console.error(error.message);
    console.error(error.stdout || '');
    console.error('');

    if (options.critical) {
      console.error('🚨 Critical step failed. Stopping verification.\n');
      process.exit(1);
    }

    return null;
  }
}

// Step 1: Install dependencies if needed
runStep(
  'Verify dependencies',
  'npm ci --silent',
  { silent: true, timeout: 120000 }
);

// Step 2: Run ESLint (allow warnings, fail on errors only)
runStep(
  'ESLint check',
  'npx eslint src --ext .ts,.tsx',
  { timeout: 60000 }
);

// Step 3: Run TypeScript compilation check
runStep(
  'TypeScript compilation check',
  'npx tsc --noEmit --skipLibCheck',
  { critical: true, timeout: 120000 }
);

// Step 4: Build the project
const buildOutput = runStep(
  'Next.js build',
  'npm run build',
  { critical: true, timeout: 600000 }
);

// Step 5: Run tests (if they exist)
if (fs.existsSync(path.join(process.cwd(), 'jest.config.js')) ||
    fs.existsSync(path.join(process.cwd(), 'jest.config.ts'))) {
  runStep(
    'Run tests',
    'npm test -- --passWithNoTests',
    { timeout: 180000 }
  );
}

// Generate report
console.log('\n📊 VERIFICATION REPORT');
console.log('========================\n');

steps.forEach((step, index) => {
  const status = step.status === 'success' ? '✅' :
                 step.status === 'failed' ? '❌' : '⏳';
  const duration = step.duration ? ` (${step.duration}ms)` : '';

  console.log(`${index + 1}. ${status} ${step.name}${duration}`);

  if (step.status === 'failed' && step.error) {
    console.log(`   Error: ${step.error.split('\n')[0]}`);
  }
});

console.log('\n========================');

if (hasFailures) {
  console.log('❌ VERIFICATION FAILED');
  console.log('\nSome checks failed. Please fix the issues before committing.\n');
  process.exit(1);
} else {
  console.log('✅ VERIFICATION PASSED');
  console.log('\nAll checks passed! Ready for deployment. 🚀\n');
  process.exit(0);
}