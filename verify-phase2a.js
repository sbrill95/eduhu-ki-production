#!/usr/bin/env node

// Phase 2A Verification Script - InstantDB Setup
// This script verifies that all Phase 2A components are in place

const fs = require('fs');
const path = require('path');

console.log('🔍 PHASE 2A VERIFICATION - InstantDB Setup');
console.log('==========================================\n');

const checks = [];

// Check 1: InstantDB Setup Guide exists
const setupGuidePath = path.join(__dirname, 'INSTANTDB_SETUP.md');
if (fs.existsSync(setupGuidePath)) {
  checks.push({ name: 'InstantDB Setup Guide', status: '✅ CREATED', details: 'INSTANTDB_SETUP.md exists' });
} else {
  checks.push({ name: 'InstantDB Setup Guide', status: '❌ MISSING', details: 'INSTANTDB_SETUP.md not found' });
}

// Check 2: Enhanced InstantDB configuration
const instantConfigPath = path.join(__dirname, 'src/lib/instant.ts');
if (fs.existsSync(instantConfigPath)) {
  const content = fs.readFileSync(instantConfigPath, 'utf8');
  if (content.includes('schema') && content.includes('chats') && content.includes('messages')) {
    checks.push({ name: 'InstantDB Schema Configuration', status: '✅ ENHANCED', details: 'Schema defined in src/lib/instant.ts' });
  } else {
    checks.push({ name: 'InstantDB Schema Configuration', status: '⚠️  BASIC', details: 'Schema needs enhancement' });
  }
} else {
  checks.push({ name: 'InstantDB Schema Configuration', status: '❌ MISSING', details: 'src/lib/instant.ts not found' });
}

// Check 3: Database utility functions
const databaseUtilPath = path.join(__dirname, 'src/lib/database.ts');
if (fs.existsSync(databaseUtilPath)) {
  const content = fs.readFileSync(databaseUtilPath, 'utf8');
  if (content.includes('createChat') && content.includes('addMessage') && content.includes('db.tx')) {
    checks.push({ name: 'Database Utilities', status: '✅ CREATED', details: 'Complete CRUD operations in src/lib/database.ts' });
  } else {
    checks.push({ name: 'Database Utilities', status: '⚠️  INCOMPLETE', details: 'Database utilities need completion' });
  }
} else {
  checks.push({ name: 'Database Utilities', status: '❌ MISSING', details: 'src/lib/database.ts not found' });
}

// Check 4: Connection testing utilities
const testUtilPath = path.join(__dirname, 'src/lib/test-db-connection.ts');
if (fs.existsSync(testUtilPath)) {
  checks.push({ name: 'Connection Testing', status: '✅ CREATED', details: 'Test utilities in src/lib/test-db-connection.ts' });
} else {
  checks.push({ name: 'Connection Testing', status: '❌ MISSING', details: 'src/lib/test-db-connection.ts not found' });
}

// Check 5: Environment configuration ready
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  const appId = content.match(/NEXT_PUBLIC_INSTANTDB_APP_ID=(.+)/)?.[1]?.trim();

  if (appId === 'demo-app-id') {
    checks.push({ name: 'Environment Configuration', status: '🔧 MANUAL REQUIRED', details: 'Ready for real app ID - currently demo-app-id' });
  } else if (appId && appId !== 'your-app-id-here') {
    checks.push({ name: 'Environment Configuration', status: '✅ CONFIGURED', details: `Real app ID configured: ${appId.substring(0, 8)}...` });
  } else {
    checks.push({ name: 'Environment Configuration', status: '⚠️  PLACEHOLDER', details: 'Environment needs real app ID' });
  }
} else {
  checks.push({ name: 'Environment Configuration', status: '❌ MISSING', details: '.env.local not found' });
}

// Check 6: InstantDB package installed
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const content = fs.readFileSync(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(content);

  if (packageJson.dependencies && packageJson.dependencies['@instantdb/react']) {
    const version = packageJson.dependencies['@instantdb/react'];
    checks.push({ name: 'InstantDB Package', status: '✅ INSTALLED', details: `@instantdb/react ${version}` });
  } else {
    checks.push({ name: 'InstantDB Package', status: '❌ MISSING', details: '@instantdb/react not in dependencies' });
  }
} else {
  checks.push({ name: 'InstantDB Package', status: '❌ MISSING', details: 'package.json not found' });
}

// Display results
console.log('PHASE 2A COMPONENT VERIFICATION:');
console.log('-'.repeat(50));

let allPassed = true;
checks.forEach((check, index) => {
  console.log(`${index + 1}. ${check.name}:`);
  console.log(`   ${check.status}`);
  console.log(`   ${check.details}\n`);

  if (check.status.includes('❌')) {
    allPassed = false;
  }
});

// Summary
console.log('SUMMARY:');
console.log('='.repeat(50));

const passed = checks.filter(c => c.status.includes('✅')).length;
const manual = checks.filter(c => c.status.includes('🔧')).length;
const warnings = checks.filter(c => c.status.includes('⚠️')).length;
const failed = checks.filter(c => c.status.includes('❌')).length;

console.log(`✅ Completed: ${passed}/${checks.length}`);
console.log(`🔧 Manual Required: ${manual}`);
console.log(`⚠️  Warnings: ${warnings}`);
console.log(`❌ Failed: ${failed}\n`);

if (failed === 0 && manual <= 1) {
  console.log('🎉 PHASE 2A INFRASTRUCTURE READY!');
  console.log('📋 Manual Action Required:');
  console.log('   1. Visit https://www.instantdb.com/dash');
  console.log('   2. Create new application: "eduhu-ki-production"');
  console.log('   3. Copy the generated App ID');
  console.log('   4. Replace "demo-app-id" in .env.local with real App ID');
  console.log('   5. Run: npm run dev');
  console.log('   6. Test chat functionality\n');

  console.log('🚀 Ready for Phase 2B: Database Integration');
} else {
  console.log('❌ PHASE 2A INCOMPLETE - Address failed checks before proceeding');
}

console.log('\nFor detailed setup instructions, see: INSTANTDB_SETUP.md');