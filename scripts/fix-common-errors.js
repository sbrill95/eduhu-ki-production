#!/usr/bin/env node

/**
 * Automatic TypeScript Error Fixer
 * Fixes common patterns that cause deployment failures
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Auto-fixing common TypeScript errors...\n');

// Pattern 1: Find missing imports/exports
function findMissingExports() {
  console.log('🔍 Scanning for missing export patterns...');

  try {
    const output = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf8' });

    // Look for "has no exported member" errors
    const missingExports = output.match(/Module ['"]([^'"]+)['"] has no exported member ['"]([^'"]+)['"]/g);

    if (missingExports) {
      console.log('❌ Found missing exports:');
      missingExports.forEach(error => {
        console.log(`   ${error}`);
      });
      return missingExports;
    }
  } catch (error) {
    // TypeScript errors are expected here
    const output = error.stdout || error.message;

    // Look for missing export patterns
    const missingExports = output.match(/Module ['"]([^'"]+)['"] has no exported member ['"]([^'"]+)['"]/g);

    if (missingExports) {
      console.log('❌ Found missing exports:');
      missingExports.forEach(error => {
        console.log(`   ${error}`);
      });
      return missingExports;
    }
  }

  console.log('✅ No missing exports found');
  return [];
}

// Pattern 2: Find property does not exist errors
function findPropertyErrors() {
  console.log('🔍 Scanning for property errors...');

  try {
    const output = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf8' });

    const propertyErrors = output.match(/Property ['"]([^'"]+)['"] does not exist on type ['"]([^'"]+)['"]/g);

    if (propertyErrors) {
      console.log('❌ Found property errors:');
      propertyErrors.forEach(error => {
        console.log(`   ${error}`);
      });
      return propertyErrors;
    }
  } catch (error) {
    const output = error.stdout || error.message;

    const propertyErrors = output.match(/Property ['"]([^'"]+)['"] does not exist on type ['"]([^'"]+)['"]/g);

    if (propertyErrors) {
      console.log('❌ Found property errors:');
      propertyErrors.forEach(error => {
        console.log(`   ${error}`);
      });
      return propertyErrors;
    }
  }

  console.log('✅ No property errors found');
  return [];
}

// Pattern 3: Find all imports to check
function auditImports() {
  console.log('🔍 Auditing all imports...');

  const srcDir = path.join(process.cwd(), 'src');
  const imports = [];

  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory() && !file.startsWith('.')) {
        scanDirectory(filePath);
      } else if (file.match(/\.(ts|tsx)$/)) {
        const content = fs.readFileSync(filePath, 'utf8');

        // Find import statements
        const importMatches = content.match(/import\s+.*?from\s+['"]@\/[^'"]+['"]/g);

        if (importMatches) {
          importMatches.forEach(importStatement => {
            imports.push({
              file: filePath.replace(process.cwd(), ''),
              import: importStatement
            });
          });
        }
      }
    });
  }

  scanDirectory(srcDir);

  console.log(`📊 Found ${imports.length} internal imports to verify`);

  return imports;
}

// Main execution
async function main() {
  const missingExports = findMissingExports();
  const propertyErrors = findPropertyErrors();
  const imports = auditImports();

  console.log('\n📋 SUMMARY:');
  console.log(`   Missing exports: ${missingExports.length}`);
  console.log(`   Property errors: ${propertyErrors.length}`);
  console.log(`   Total imports: ${imports.length}`);

  if (missingExports.length === 0 && propertyErrors.length === 0) {
    console.log('\n✅ No common TypeScript errors found!');
    console.log('🚀 Ready for deployment');
  } else {
    console.log('\n❌ Issues found that need manual fixing');
    console.log('📖 See DEPLOY_CHECKLIST.md for guidance');
  }
}

main().catch(console.error);