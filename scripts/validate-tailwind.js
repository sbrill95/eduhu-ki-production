#!/usr/bin/env node

/**
 * TailwindCSS Configuration Validator
 * Catches common TailwindCSS configuration issues before deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🎨 Validating TailwindCSS configuration...\n');

const errors = [];
const warnings = [];

// Check package.json for TailwindCSS version compatibility
function validatePackageJson() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    errors.push('package.json not found');
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const tailwindVersion = packageJson.dependencies?.tailwindcss || packageJson.devDependencies?.tailwindcss;

  if (!tailwindVersion) {
    errors.push('TailwindCSS not found in package.json dependencies');
    return;
  }

  console.log(`📦 TailwindCSS version: ${tailwindVersion}`);

  // Check for version-specific compatibility issues
  const isV4 = tailwindVersion.includes('4.') || tailwindVersion.includes('^4') || tailwindVersion.includes('~4');
  const isV3 = tailwindVersion.includes('3.') || tailwindVersion.includes('^3') || tailwindVersion.includes('~3');

  return { isV4, isV3, version: tailwindVersion };
}

// Check tailwind.config.js
function validateTailwindConfig() {
  const configPaths = ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.mjs'];
  let configFound = false;

  for (const configPath of configPaths) {
    const fullPath = path.join(process.cwd(), configPath);
    if (fs.existsSync(fullPath)) {
      console.log(`⚙️  Found config: ${configPath}`);
      configFound = true;

      try {
        const configContent = fs.readFileSync(fullPath, 'utf8');

        // Check for common v4 to v3 migration issues
        if (configContent.includes('@tailwind/postcss')) {
          errors.push(`${configPath}: Found @tailwind/postcss - this is TailwindCSS v4 syntax, but package.json shows v3`);
        }

        // Validate content paths exist - simplified check for main directories
        const contentRegex = /content:\s*\[([\s\S]*?)\]/;
        const match = configContent.match(contentRegex);
        if (match) {
          const contentPaths = match[1]
            .split(',')
            .map(path => path.trim().replace(/['"]/g, ''))
            .filter(path => path && !path.startsWith('//') && path.includes('/'));

          const checkedPaths = new Set();
          for (const contentPath of contentPaths) {
            const basePath = contentPath.split('/')[0].replace('./', '');
            if (basePath && !basePath.includes('*') && !basePath.includes('{') && !checkedPaths.has(basePath)) {
              checkedPaths.add(basePath);
              const fullGlobPath = path.join(process.cwd(), basePath);
              if (!fs.existsSync(fullGlobPath)) {
                warnings.push(`Content path directory may not exist: ${basePath}`);
              }
            }
          }
        }

      } catch (error) {
        errors.push(`Error reading ${configPath}: ${error.message}`);
      }

      break;
    }
  }

  if (!configFound) {
    errors.push('No TailwindCSS configuration file found (tailwind.config.js/ts/mjs)');
  }
}

// Check PostCSS configuration
function validatePostcssConfig() {
  const configPaths = ['postcss.config.js', 'postcss.config.mjs', 'postcss.config.json'];
  let configFound = false;

  for (const configPath of configPaths) {
    const fullPath = path.join(process.cwd(), configPath);
    if (fs.existsSync(fullPath)) {
      console.log(`📮 Found PostCSS config: ${configPath}`);
      configFound = true;

      try {
        const configContent = fs.readFileSync(fullPath, 'utf8');

        // Check for v4 syntax in v3 environment
        if (configContent.includes('@tailwindcss/postcss')) {
          errors.push(`${configPath}: Found @tailwindcss/postcss - this requires TailwindCSS v4`);
        }

        // Check for proper v3 syntax
        if (!configContent.includes('tailwindcss:') && !configContent.includes('"tailwindcss"')) {
          warnings.push(`${configPath}: TailwindCSS plugin not found in PostCSS config`);
        }

        if (!configContent.includes('autoprefixer')) {
          warnings.push(`${configPath}: autoprefixer not found - recommended for browser compatibility`);
        }

      } catch (error) {
        errors.push(`Error reading ${configPath}: ${error.message}`);
      }

      break;
    }
  }

  if (!configFound) {
    errors.push('No PostCSS configuration file found');
  }
}

// Check globals.css for proper directives
function validateGlobalsCss() {
  const possiblePaths = [
    'src/app/globals.css',
    'styles/globals.css',
    'src/styles/globals.css',
    'app/globals.css'
  ];

  let globalsFound = false;

  for (const globalPath of possiblePaths) {
    const fullPath = path.join(process.cwd(), globalPath);
    if (fs.existsSync(fullPath)) {
      console.log(`🎯 Found globals CSS: ${globalPath}`);
      globalsFound = true;

      try {
        const cssContent = fs.readFileSync(fullPath, 'utf8');

        // Check for v4 syntax
        if (cssContent.includes('@import "tailwindcss"')) {
          errors.push(`${globalPath}: Found @import "tailwindcss" - this is TailwindCSS v4 syntax`);
        }

        // Check for proper v3 directives
        const hasBase = cssContent.includes('@tailwind base');
        const hasComponents = cssContent.includes('@tailwind components');
        const hasUtilities = cssContent.includes('@tailwind utilities');

        if (!hasBase && cssContent.includes('@layer base')) {
          errors.push(`${globalPath}: @layer base used without @tailwind base directive`);
        }

        if (!hasComponents && cssContent.includes('@layer components')) {
          errors.push(`${globalPath}: @layer components used without @tailwind components directive`);
        }

        if (!hasUtilities && cssContent.includes('@layer utilities')) {
          errors.push(`${globalPath}: @layer utilities used without @tailwind utilities directive`);
        }

        if (!hasBase || !hasComponents || !hasUtilities) {
          warnings.push(`${globalPath}: Missing some @tailwind directives - consider adding @tailwind base, @tailwind components, @tailwind utilities`);
        }

      } catch (error) {
        errors.push(`Error reading ${globalPath}: ${error.message}`);
      }

      break;
    }
  }

  if (!globalsFound) {
    warnings.push('No globals.css file found in common locations');
  }
}

// Check Next.js configuration for TailwindCSS
function validateNextConfig() {
  const configPaths = ['next.config.js', 'next.config.mjs', 'next.config.ts'];

  for (const configPath of configPaths) {
    const fullPath = path.join(process.cwd(), configPath);
    if (fs.existsSync(fullPath)) {
      console.log(`⚡ Found Next.js config: ${configPath}`);

      try {
        const configContent = fs.readFileSync(fullPath, 'utf8');

        // Check for TailwindCSS experimental features
        if (configContent.includes('experimental') && configContent.includes('tailwindcss')) {
          warnings.push(`${configPath}: Experimental TailwindCSS features detected - may cause compatibility issues`);
        }

      } catch (error) {
        errors.push(`Error reading ${configPath}: ${error.message}`);
      }

      break;
    }
  }
}

// Run all validations
console.log('🔍 Running validation checks...\n');

const packageInfo = validatePackageJson();
validateTailwindConfig();
validatePostcssConfig();
validateGlobalsCss();
validateNextConfig();

// Report results
console.log('\n📋 Validation Results:');
console.log(`   Errors: ${errors.length}`);
console.log(`   Warnings: ${warnings.length}\n`);

if (errors.length > 0) {
  console.log('❌ ERRORS:');
  errors.forEach((error, index) => {
    console.log(`   ${index + 1}. ${error}`);
  });
  console.log();
}

if (warnings.length > 0) {
  console.log('⚠️  WARNINGS:');
  warnings.forEach((warning, index) => {
    console.log(`   ${index + 1}. ${warning}`);
  });
  console.log();
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All TailwindCSS configurations look good!');
  console.log('\n🎨 TailwindCSS validation passed!\n');
  process.exit(0);
} else if (errors.length === 0) {
  console.log('✅ No critical errors found, but please review warnings.');
  console.log('\n💡 Fix suggestions:');
  console.log('   - Update content paths to match your project structure');
  console.log('   - Ensure all @tailwind directives are present in globals.css');
  console.log('   - Consider using autoprefixer for better browser support');
  console.log('\n🎨 TailwindCSS validation completed with warnings.\n');
  process.exit(0);
} else {
  console.log('💡 Common fixes:');
  console.log('   - For TailwindCSS v3: Use @tailwind directives in globals.css');
  console.log('   - For TailwindCSS v4: Use @import "tailwindcss" syntax');
  console.log('   - Update PostCSS config to match TailwindCSS version');
  console.log('   - Check package.json for correct TailwindCSS version');
  console.log('\n🛑 TailwindCSS validation failed. Fix errors before deployment.\n');
  process.exit(1);
}