#!/usr/bin/env node

/**
 * Generate Test Fixtures Script
 * Creates test data and fixtures for the eduhu-test project
 */

const fs = require('fs')
const path = require('path')

function generateTestFixtures() {
  const projectRoot = path.resolve(__dirname, '..')
  const fixturesDir = path.join(projectRoot, 'test-fixtures')

  console.log('🔧 Generating test fixtures...')

  // Ensure fixtures directory exists
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true })
  }

  // Generate sample test data
  const fixtures = {
    sampleUser: {
      id: 'teacher_123',
      name: 'Test Teacher',
      email: 'test@eduhu.ki',
      subjects: ['Mathematics', 'Science'],
      gradeLevel: '5-8'
    },
    sampleSession: {
      id: 'session_abc123',
      teacherId: 'teacher_123',
      title: 'Test Math Session',
      sessionType: 'lesson_planning',
      createdAt: new Date().toISOString()
    },
    sampleFiles: [
      {
        id: 'file_001',
        filename: 'test-document.pdf',
        mimeType: 'application/pdf',
        size: 1024000,
        processingStatus: 'completed'
      },
      {
        id: 'file_002',
        filename: 'test-image.jpg',
        mimeType: 'image/jpeg',
        size: 512000,
        processingStatus: 'completed'
      }
    ]
  }

  // Write fixtures file
  const fixturesFile = path.join(fixturesDir, 'test-data.json')
  fs.writeFileSync(fixturesFile, JSON.stringify(fixtures, null, 2))

  // Create sample test files (empty placeholders)
  const samplePdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Test Document) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000174 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n268\n%%EOF')
  fs.writeFileSync(path.join(fixturesDir, 'test-document.pdf'), samplePdf)

  // Create a minimal 1x1 JPEG
  const sampleJpeg = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x03, 0x02, 0x02, 0x02, 0x02, 0x02, 0x03,
    0x02, 0x02, 0x02, 0x03, 0x03, 0x03, 0x03, 0x04, 0x06, 0x04, 0x04, 0x04, 0x04, 0x04, 0x08, 0x06,
    0x06, 0x05, 0x06, 0x09, 0x08, 0x0A, 0x0A, 0x09, 0x08, 0x09, 0x09, 0x0A, 0x0C, 0x0F, 0x0C, 0x0A,
    0x0B, 0x0E, 0x0B, 0x09, 0x09, 0x0D, 0x11, 0x0D, 0x0E, 0x0F, 0x10, 0x10, 0x11, 0x10, 0x0A, 0x0C,
    0x12, 0x13, 0x12, 0x10, 0x13, 0x0F, 0x10, 0x10, 0x10, 0xFF, 0xC9, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xCC, 0x00, 0x06, 0x00, 0x10, 0x10, 0x05, 0xFF, 0xDA,
    0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0xD2, 0xCF, 0x20, 0xFF, 0xD9
  ])
  fs.writeFileSync(path.join(fixturesDir, 'test-image.jpg'), sampleJpeg)

  console.log('✅ Test fixtures generated successfully')
  console.log(`📁 Fixtures directory: ${fixturesDir}`)
  console.log(`📄 Test data: ${fixturesFile}`)
  console.log('📎 Sample files: test-document.pdf, test-image.jpg')

  return fixtures
}

// Run if called directly
if (require.main === module) {
  try {
    generateTestFixtures()
    process.exit(0)
  } catch (error) {
    console.error('❌ Test fixtures generation failed:', error.message)
    process.exit(1)
  }
}

module.exports = { generateTestFixtures }