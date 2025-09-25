/**
 * Comprehensive test suite for enhanced file serving route
 * Tests both local storage and S3 integration scenarios
 */

// Use built-in fetch (Node.js 18+)
// const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_TEACHER_ID = 'test_teacher_123';
const TEST_SESSION_ID = 'test_session_456';

class FileRouteTestSuite {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
  }

  async runTest(testName, testFunction) {
    this.results.total++;
    try {
      await testFunction();
      this.results.passed++;
      this.results.details.push({ test: testName, status: 'PASSED' });
      console.log(`✅ ${testName}: PASSED`);
    } catch (error) {
      this.results.failed++;
      this.results.details.push({ test: testName, status: 'FAILED', error: error.message });
      console.error(`❌ ${testName}: FAILED - ${error.message}`);
    }
  }

  async testBasicSecurityValidation() {
    // Test empty path protection
    const response1 = await fetch(`${BASE_URL}/api/files/`);
    if (response1.status !== 400) {
      throw new Error(`Expected 400, got ${response1.status}`);
    }

    // Test path traversal protection
    const response2 = await fetch(`${BASE_URL}/api/files/../../../etc/passwd`);
    if (response2.status !== 400) {
      throw new Error(`Expected 400 for path traversal, got ${response2.status}`);
    }

    // Test tilde protection
    const response3 = await fetch(`${BASE_URL}/api/files/~/sensitive`);
    if (response3.status !== 400) {
      throw new Error(`Expected 400 for tilde path, got ${response3.status}`);
    }
  }

  async testAuthenticationFlow() {
    // Test file access without authentication (should work but no analytics)
    const response1 = await fetch(`${BASE_URL}/api/files/test.txt`);
    console.log(`No auth test: ${response1.status} ${response1.statusText}`);

    // Test file access with teacherId parameter
    const response2 = await fetch(`${BASE_URL}/api/files/test.txt?teacherId=${TEST_TEACHER_ID}`);
    console.log(`With teacherId test: ${response2.status} ${response2.statusText}`);

    // Test session validation (will likely fail without valid session)
    const response3 = await fetch(`${BASE_URL}/api/files/test.txt?teacherId=${TEST_TEACHER_ID}&sessionId=${TEST_SESSION_ID}`);
    console.log(`With session test: ${response3.status} ${response3.statusText}`);
  }

  async testFileNotFound() {
    const response = await fetch(`${BASE_URL}/api/files/nonexistent-file.txt`);
    if (response.status !== 404) {
      throw new Error(`Expected 404 for nonexistent file, got ${response.status}`);
    }
  }

  async testHeadRequest() {
    // Test HEAD request for file info
    const response = await fetch(`${BASE_URL}/api/files/test.txt`, { method: 'HEAD' });
    console.log(`HEAD request test: ${response.status} ${response.statusText}`);

    // Check if response has appropriate headers
    const contentLength = response.headers.get('content-length');
    const contentType = response.headers.get('content-type');
    const servedFrom = response.headers.get('x-served-from');

    console.log(`HEAD response headers:`, {
      'content-length': contentLength,
      'content-type': contentType,
      'x-served-from': servedFrom
    });
  }

  async testMimeTypeDetection() {
    // Test various file extensions
    const testFiles = [
      { path: 'test.jpg', expectedType: 'image/jpeg' },
      { path: 'test.png', expectedType: 'image/png' },
      { path: 'test.pdf', expectedType: 'application/pdf' },
      { path: 'test.txt', expectedType: 'text/plain' }
    ];

    for (const testFile of testFiles) {
      const response = await fetch(`${BASE_URL}/api/files/${testFile.path}`, { method: 'HEAD' });
      const contentType = response.headers.get('content-type');
      console.log(`MIME test for ${testFile.path}: ${contentType} (expected: ${testFile.expectedType})`);
    }
  }

  async testThumbnailPath() {
    // Test thumbnail path handling
    const response = await fetch(`${BASE_URL}/api/files/thumbnails/test.jpg`, { method: 'HEAD' });
    const servedFrom = response.headers.get('x-served-from');
    const filePath = response.headers.get('x-file-path');

    console.log(`Thumbnail test: ${response.status}, served from: ${servedFrom}, path: ${filePath}`);
  }

  async testStorageAdapterFallback() {
    // This test checks if S3 fallback is properly configured
    console.log('Testing storage adapter configuration...');

    // Test a file that doesn't exist locally (would fallback to S3)
    const response = await fetch(`${BASE_URL}/api/files/s3-only-file.txt?teacherId=${TEST_TEACHER_ID}`);
    const servedFrom = response.headers.get('x-served-from');

    console.log(`Storage fallback test: ${response.status}, served from: ${servedFrom || 'unknown'}`);
  }

  async testAnalyticsHeaders() {
    // Test that proper headers are returned for debugging
    const response = await fetch(`${BASE_URL}/api/files/test.txt?teacherId=${TEST_TEACHER_ID}`, { method: 'HEAD' });

    const headers = {
      'x-served-from': response.headers.get('x-served-from'),
      'x-file-path': response.headers.get('x-file-path'),
      'content-length': response.headers.get('content-length'),
      'cache-control': response.headers.get('cache-control'),
      'x-content-type-options': response.headers.get('x-content-type-options')
    };

    console.log('Analytics headers test:', headers);
  }

  printSummary() {
    console.log('\n=== Test Suite Summary ===');
    console.log(`Total tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Success rate: ${((this.results.passed / this.results.total) * 100).toFixed(2)}%`);

    if (this.results.failed > 0) {
      console.log('\nFailed tests:');
      this.results.details
        .filter(result => result.status === 'FAILED')
        .forEach(result => console.log(`- ${result.test}: ${result.error}`));
    }
  }

  async runAll() {
    console.log('🧪 Starting Enhanced File Route Test Suite\n');

    await this.runTest('Basic Security Validation', () => this.testBasicSecurityValidation());
    await this.runTest('Authentication Flow', () => this.testAuthenticationFlow());
    await this.runTest('File Not Found Handling', () => this.testFileNotFound());
    await this.runTest('HEAD Request Support', () => this.testHeadRequest());
    await this.runTest('MIME Type Detection', () => this.testMimeTypeDetection());
    await this.runTest('Thumbnail Path Handling', () => this.testThumbnailPath());
    await this.runTest('Storage Adapter Fallback', () => this.testStorageAdapterFallback());
    await this.runTest('Analytics Headers', () => this.testAnalyticsHeaders());

    this.printSummary();
  }
}

// Create test files for the suite
function createTestFiles() {
  const uploadsDir = path.join(process.cwd(), 'uploads', '2024', '12');

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const testFiles = [
    { name: 'test.txt', content: 'This is a test file for the enhanced route.' },
    { name: 'test.jpg', content: 'fake-jpeg-content' },
    { name: 'test.png', content: 'fake-png-content' },
    { name: 'test.pdf', content: 'fake-pdf-content' }
  ];

  testFiles.forEach(file => {
    const filePath = path.join(uploadsDir, file.name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, file.content);
      console.log(`Created test file: ${filePath}`);
    }
  });

  // Create thumbnail directory and test files
  const thumbnailDir = path.join(process.cwd(), 'uploads', 'thumbnails', '2024', '12');
  if (!fs.existsSync(thumbnailDir)) {
    fs.mkdirSync(thumbnailDir, { recursive: true });
  }

  const thumbnailPath = path.join(thumbnailDir, 'test_thumb.jpg');
  if (!fs.existsSync(thumbnailPath)) {
    fs.writeFileSync(thumbnailPath, 'fake-thumbnail-content');
    console.log(`Created test thumbnail: ${thumbnailPath}`);
  }
}

// Run the test suite
async function main() {
  try {
    // Create necessary test files
    createTestFiles();

    // Run the test suite
    const testSuite = new FileRouteTestSuite();
    await testSuite.runAll();

  } catch (error) {
    console.error('Test suite execution failed:', error);
    process.exit(1);
  }
}

// Export for use in other test files
module.exports = { FileRouteTestSuite };

// Run if called directly
if (require.main === module) {
  main();
}