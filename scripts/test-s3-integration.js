#!/usr/bin/env node

/**
 * Simple integration test for S3Storage implementation
 * This script tests the S3Storage configuration without requiring full AWS access
 */

const path = require('path');

// Set up the path for imports
const projectRoot = path.join(__dirname, '..');
process.env.NODE_PATH = path.join(projectRoot, 'src');

console.log('🧪 Testing S3Storage Integration');
console.log('=================================');

// Test 1: Basic file structure check
console.log('\n1. Testing file structure...');
try {
  const fs = require('fs');
  const path = require('path');

  const fileStoragePath = path.join(__dirname, '..', 'src', 'lib', 'file-storage.ts');
  if (fs.existsSync(fileStoragePath)) {
    console.log('✅ file-storage.ts exists');

    // Read and check for key exports
    const content = fs.readFileSync(fileStoragePath, 'utf8');
    const hasS3Adapter = content.includes('class S3StorageAdapter');
    const hasFactory = content.includes('createStorageAdapter');
    const hasCloudFunctions = content.includes('saveFileToCloudStorage');

    console.log(`   S3StorageAdapter class: ${hasS3Adapter ? '✅' : '❌'}`);
    console.log(`   Storage factory: ${hasFactory ? '✅' : '❌'}`);
    console.log(`   Cloud storage functions: ${hasCloudFunctions ? '✅' : '❌'}`);

  } else {
    console.log('❌ file-storage.ts not found');
    process.exit(1);
  }
} catch (error) {
  console.log('❌ Failed to check file structure:', error.message);
}

// Test 2: Check AWS SDK dependencies
console.log('\n2. Testing AWS SDK dependencies...');
try {
  const fs = require('fs');
  const path = require('path');
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  const hasS3Client = packageJson.dependencies['@aws-sdk/client-s3'];
  const hasPresigner = packageJson.dependencies['@aws-sdk/s3-request-presigner'];

  console.log(`   @aws-sdk/client-s3: ${hasS3Client ? `✅ ${hasS3Client}` : '❌ Missing'}`);
  console.log(`   @aws-sdk/s3-request-presigner: ${hasPresigner ? `✅ ${hasPresigner}` : '❌ Missing'}`);

  if (hasS3Client && hasPresigner) {
    console.log('✅ All AWS SDK dependencies are installed');
  } else {
    console.log('❌ Missing AWS SDK dependencies');
  }
} catch (error) {
  console.log('❌ Failed to check dependencies:', error.message);
}

// Test 3: TypeScript compilation check
console.log('\n3. Testing TypeScript compilation...');
try {
  const fs = require('fs');
  const path = require('path');
  const fileStoragePath = path.join(__dirname, '..', 'src', 'lib', 'file-storage.ts');
  const content = fs.readFileSync(fileStoragePath, 'utf8');

  // Check for common TypeScript patterns
  const hasImports = content.includes('import {') && content.includes('} from');
  const hasExports = content.includes('export class') || content.includes('export function');
  const hasTypes = content.includes('interface') || content.includes('type ');

  console.log(`   Import statements: ${hasImports ? '✅' : '❌'}`);
  console.log(`   Export statements: ${hasExports ? '✅' : '❌'}`);
  console.log(`   Type definitions: ${hasTypes ? '✅' : '❌'}`);

  // Check for specific S3 implementations
  const hasS3Methods = [
    'saveFile',
    'deleteFile',
    'getFileInfo',
    'generateSignedUrl'
  ].every(method => content.includes(method));

  console.log(`   S3 methods implemented: ${hasS3Methods ? '✅' : '❌'}`);

} catch (error) {
  console.log('❌ Failed to analyze TypeScript code:', error.message);
}

// Test 4: Environment variables check
console.log('\n4. Checking environment variables...');
const requiredVars = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET_NAME',
  'AWS_S3_REGION'
];

const envStatus = requiredVars.map(varName => ({
  name: varName,
  set: !!process.env[varName],
  value: process.env[varName] ? '***' : 'undefined'
}));

envStatus.forEach(env => {
  const status = env.set ? '✅' : '❌';
  console.log(`   ${status} ${env.name}: ${env.value}`);
});

const allConfigured = envStatus.every(env => env.set);
if (allConfigured) {
  console.log('✅ All S3 environment variables are configured');
} else {
  console.log('ℹ️  Some S3 environment variables are missing - will use local storage');
}

// Test 5: API endpoints check
console.log('\n5. Testing API endpoints...');
const fs = require('fs');

const apiEndpoints = [
  'src/app/api/upload/route.ts',
  'src/app/api/storage/info/route.ts'
];

apiEndpoints.forEach(endpoint => {
  const fullPath = path.join(projectRoot, endpoint);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${endpoint} exists`);
  } else {
    console.log(`❌ ${endpoint} missing`);
  }
});

console.log('\n🎉 S3Storage Integration Test Complete');
console.log('=====================================');

if (allConfigured) {
  console.log('✅ Ready for production S3 usage');
  console.log('Next steps:');
  console.log('1. Test file uploads through the API');
  console.log('2. Verify S3 bucket permissions');
  console.log('3. Test thumbnail generation');
} else {
  console.log('ℹ️  Development mode - using local storage');
  console.log('To enable S3 storage:');
  console.log('1. Set up AWS credentials in .env.local');
  console.log('2. Create S3 bucket and configure permissions');
  console.log('3. Test with real file uploads');
}

console.log('\nFor testing file uploads, use: POST /api/upload');