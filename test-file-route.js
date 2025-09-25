const fetch = require('node-fetch');

async function testFileRoute() {
  const baseUrl = 'http://localhost:3000';

  console.log('Testing file serving route...');

  // Test basic route structure
  try {
    // Test invalid path
    const response1 = await fetch(`${baseUrl}/api/files/`);
    console.log('Empty path test:', response1.status, response1.statusText);

    // Test path traversal protection
    const response2 = await fetch(`${baseUrl}/api/files/../../../etc/passwd`);
    console.log('Path traversal test:', response2.status, response2.statusText);

    // Test valid file (assuming a test file exists)
    const response3 = await fetch(`${baseUrl}/api/files/2024/12/test.txt`);
    console.log('Valid file test:', response3.status, response3.statusText);

    console.log('Basic route tests completed');

  } catch (error) {
    console.error('Test error:', error.message);
  }
}

// Run tests if server is running
testFileRoute();