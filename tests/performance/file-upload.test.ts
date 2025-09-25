import { test, expect } from '@playwright/test'
import { performanceHelpers } from '../utils/test-setup'
import path from 'path'

test.describe('File Upload Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat')
  })

  test.describe('Upload Performance Benchmarks', () => {
    test('should upload 5MB PDF within 15 seconds', async ({ page }) => {
      // Create a test PDF file (simulated)
      const testFile = path.join(__dirname, '../fixtures/sample-lesson-plan.pdf')

      const uploadOperation = async () => {
        // Open file upload dialog
        const uploadButton = page.getByRole('button', { name: /upload file|attach/i })
        await uploadButton.click()

        // Select file
        const fileInput = page.getByTestId('file-input')
        await fileInput.setInputFiles(testFile)

        // Wait for upload completion
        await page.waitForSelector('[data-testid="upload-complete"]', { timeout: 20000 })
      }

      const result = await performanceHelpers.assertWithinTime(
        uploadOperation,
        15000, // 15 seconds max
        'PDF upload (5MB)'
      )

      // Verify file appears in chat
      await expect(page.getByText(/sample-lesson-plan\.pdf/i)).toBeVisible()
    })

    test('should upload 3MB JPG image within 10 seconds', async ({ page }) => {
      const testFile = path.join(__dirname, '../fixtures/classroom-diagram.jpg')

      const uploadOperation = async () => {
        const uploadButton = page.getByRole('button', { name: /upload file|attach/i })
        await uploadButton.click()

        const fileInput = page.getByTestId('file-input')
        await fileInput.setInputFiles(testFile)

        await page.waitForSelector('[data-testid="upload-complete"]', { timeout: 15000 })
      }

      await performanceHelpers.assertWithinTime(
        uploadOperation,
        10000, // 10 seconds max
        'JPG upload (3MB)'
      )

      // Verify image preview appears
      await expect(page.getByRole('img', { name: /classroom-diagram/i })).toBeVisible()
    })

    test('should upload Word document within 12 seconds', async ({ page }) => {
      const testFile = path.join(__dirname, '../fixtures/curriculum-guide.docx')

      const uploadOperation = async () => {
        const uploadButton = page.getByRole('button', { name: /upload file|attach/i })
        await uploadButton.click()

        const fileInput = page.getByTestId('file-input')
        await fileInput.setInputFiles(testFile)

        await page.waitForSelector('[data-testid="upload-complete"]', { timeout: 15000 })
      }

      await performanceHelpers.assertWithinTime(
        uploadOperation,
        12000, // 12 seconds max
        'Word document upload'
      )

      // Verify document appears with content preview
      await expect(page.getByText(/curriculum-guide\.docx/i)).toBeVisible()
      await expect(page.getByTestId('document-preview')).toBeVisible()
    })
  })

  test.describe('Multiple File Upload Performance', () => {
    test('should handle 3 concurrent file uploads efficiently', async ({ page }) => {
      const testFiles = [
        path.join(__dirname, '../fixtures/lesson-plan-1.pdf'),
        path.join(__dirname, '../fixtures/worksheet.jpg'),
        path.join(__dirname, '../fixtures/rubric.docx')
      ]

      const uploadOperation = async () => {
        const uploadButton = page.getByRole('button', { name: /upload file|attach/i })
        await uploadButton.click()

        // Select multiple files
        const fileInput = page.getByTestId('file-input')
        await fileInput.setInputFiles(testFiles)

        // Wait for all uploads to complete
        await page.waitForSelector('[data-testid="all-uploads-complete"]', { timeout: 30000 })
      }

      await performanceHelpers.assertWithinTime(
        uploadOperation,
        25000, // 25 seconds for 3 files
        'Multiple file upload (3 files)'
      )

      // Verify all files appear in chat
      await expect(page.getByText(/lesson-plan-1\.pdf/i)).toBeVisible()
      await expect(page.getByText(/worksheet\.jpg/i)).toBeVisible()
      await expect(page.getByText(/rubric\.docx/i)).toBeVisible()
    })

    test('should maintain UI responsiveness during uploads', async ({ page }) => {
      const testFile = path.join(__dirname, '../fixtures/large-presentation.pptx')

      // Start upload
      const uploadButton = page.getByRole('button', { name: /upload file|attach/i })
      await uploadButton.click()

      const fileInput = page.getByTestId('file-input')
      await fileInput.setInputFiles(testFile)

      // Test UI responsiveness during upload
      const chatInput = page.getByPlaceholderText(/ask about lesson plans/i)

      // Should be able to type in chat while upload is in progress
      const typingOperation = async () => {
        await chatInput.fill('Can you help me analyze this presentation?')
        return chatInput.inputValue()
      }

      const { result: typedValue, timeMs } = await performanceHelpers.measureTime(typingOperation)

      expect(typedValue).toBe('Can you help me analyze this presentation?')
      expect(timeMs).toBeLessThan(500) // Typing should remain responsive

      // Navigation should still work
      const homeButton = page.getByRole('button', { name: /home/i })
      await expect(homeButton).toBeEnabled()

      // Wait for upload completion
      await page.waitForSelector('[data-testid="upload-complete"]', { timeout: 45000 })
    })
  })

  test.describe('File Processing Performance', () => {
    test('should generate thumbnail within 3 seconds for images', async ({ page }) => {
      const testFile = path.join(__dirname, '../fixtures/student-work-sample.jpg')

      const uploadButton = page.getByRole('button', { name: /upload file|attach/i })
      await uploadButton.click()

      const fileInput = page.getByTestId('file-input')
      await fileInput.setInputFiles(testFile)

      // Measure thumbnail generation time
      const thumbnailOperation = async () => {
        await page.waitForSelector('[data-testid="file-thumbnail"]', { timeout: 5000 })
        return true
      }

      await performanceHelpers.assertWithinTime(
        thumbnailOperation,
        3000, // 3 seconds max
        'Image thumbnail generation'
      )

      // Verify thumbnail quality
      const thumbnail = page.getByTestId('file-thumbnail')
      await expect(thumbnail).toHaveAttribute('src', /thumbnail/)
    })

    test('should extract text from PDF within 5 seconds', async ({ page }) => {
      const testFile = path.join(__dirname, '../fixtures/text-heavy-document.pdf')

      const uploadButton = page.getByRole('button', { name: /upload file|attach/i })
      await uploadButton.click()

      const fileInput = page.getByTestId('file-input')
      await fileInput.setInputFiles(testFile)

      // Wait for upload completion first
      await page.waitForSelector('[data-testid="upload-complete"]', { timeout: 15000 })

      // Measure text extraction time
      const extractionOperation = async () => {
        await page.waitForSelector('[data-testid="extracted-text"]', { timeout: 8000 })
        return true
      }

      await performanceHelpers.assertWithinTime(
        extractionOperation,
        5000, // 5 seconds max
        'PDF text extraction'
      )

      // Verify extracted content is available
      const extractedText = page.getByTestId('extracted-text')
      await expect(extractedText).toContainText(/\w+/) // Should contain actual text
    })

    test('should process Word document content within 4 seconds', async ({ page }) => {
      const testFile = path.join(__dirname, '../fixtures/detailed-lesson-plan.docx')

      const uploadButton = page.getByRole('button', { name: /upload file|attach/i })
      await uploadButton.click()

      const fileInput = page.getByTestId('file-input')
      await fileInput.setInputFiles(testFile)

      await page.waitForSelector('[data-testid="upload-complete"]', { timeout: 15000 })

      // Measure document processing time
      const processingOperation = async () => {
        await page.waitForSelector('[data-testid="document-processed"]', { timeout: 6000 })
        return true
      }

      await performanceHelpers.assertWithinTime(
        processingOperation,
        4000, // 4 seconds max
        'Word document processing'
      )

      // Verify document structure is parsed
      await expect(page.getByTestId('document-outline')).toBeVisible()
    })
  })

  test.describe('Memory Usage and Resource Management', () => {
    test('should maintain reasonable memory usage during large uploads', async ({ page, context }) => {
      // Monitor performance during upload
      await page.evaluate(() => {
        (window as any).performanceMonitor = {
          initialMemory: (performance as any).memory?.usedJSHeapSize || 0,
          peakMemory: 0
        }
      })

      const testFile = path.join(__dirname, '../fixtures/large-educational-video.mp4')

      const uploadButton = page.getByRole('button', { name: /upload file|attach/i })
      await uploadButton.click()

      const fileInput = page.getByTestId('file-input')
      await fileInput.setInputFiles(testFile)

      // Monitor memory during upload
      const memoryCheck = setInterval(async () => {
        await page.evaluate(() => {
          const currentMemory = (performance as any).memory?.usedJSHeapSize || 0
          const monitor = (window as any).performanceMonitor
          if (currentMemory > monitor.peakMemory) {
            monitor.peakMemory = currentMemory
          }
        })
      }, 1000)

      try {
        await page.waitForSelector('[data-testid="upload-complete"]', { timeout: 60000 })
      } finally {
        clearInterval(memoryCheck)
      }

      // Check memory usage
      const memoryStats = await page.evaluate(() => {
        return (window as any).performanceMonitor
      })

      const memoryIncreasesMB = (memoryStats.peakMemory - memoryStats.initialMemory) / (1024 * 1024)

      // Memory increase should be reasonable (less than 100MB for file upload)
      expect(memoryIncreasesMB).toBeLessThan(100)

      console.log(`📊 Memory increase during upload: ${memoryIncreasesMB.toFixed(2)}MB`)
    })

    test('should handle upload queue efficiently', async ({ page }) => {
      const testFiles = Array.from({ length: 5 }, (_, i) =>
        path.join(__dirname, `../fixtures/test-document-${i + 1}.pdf`)
      )

      const uploadButton = page.getByRole('button', { name: /upload file|attach/i })
      await uploadButton.click()

      const fileInput = page.getByTestId('file-input')

      // Add files to queue rapidly
      const queueingOperation = async () => {
        for (const file of testFiles) {
          await fileInput.setInputFiles([file])
          await page.waitForTimeout(100) // Small delay between queue additions
        }
        return true
      }

      const { timeMs: queueTime } = await performanceHelpers.measureTime(queueingOperation)

      // Queueing should be fast
      expect(queueTime).toBeLessThan(2000) // Under 2 seconds to queue 5 files

      // All files should appear in upload queue
      await expect(page.getByTestId('upload-queue')).toContainText('5 files')

      // Process queue
      const processingOperation = async () => {
        await page.waitForSelector('[data-testid="queue-complete"]', { timeout: 45000 })
        return true
      }

      await performanceHelpers.assertWithinTime(
        processingOperation,
        40000, // 40 seconds for 5 files
        'Upload queue processing'
      )
    })
  })

  test.describe('Error Handling Performance', () => {
    test('should handle large file rejection quickly', async ({ page }) => {
      // This would be a file larger than the 10MB limit
      const oversizedFile = path.join(__dirname, '../fixtures/oversized-file.zip')

      const uploadButton = page.getByRole('button', { name: /upload file|attach/i })
      await uploadButton.click()

      const rejectionOperation = async () => {
        const fileInput = page.getByTestId('file-input')
        await fileInput.setInputFiles(oversizedFile)

        // Should show error quickly
        await page.waitForSelector('[data-testid="upload-error"]', { timeout: 2000 })
        return true
      }

      await performanceHelpers.assertWithinTime(
        rejectionOperation,
        1000, // Should reject within 1 second
        'Oversized file rejection'
      )

      // Verify error message
      await expect(page.getByText(/file too large|exceeds size limit/i)).toBeVisible()
    })

    test('should recover from upload failures efficiently', async ({ page, context }) => {
      const testFile = path.join(__dirname, '../fixtures/test-recovery.pdf')

      const uploadButton = page.getByRole('button', { name: /upload file|attach/i })
      await uploadButton.click()

      const fileInput = page.getByTestId('file-input')
      await fileInput.setInputFiles(testFile)

      // Simulate network failure during upload
      await context.setOffline(true)
      await page.waitForTimeout(2000)

      // Should show upload failed quickly
      await expect(page.getByText(/upload failed|network error/i)).toBeVisible({ timeout: 5000 })

      // Restore network
      await context.setOffline(false)

      // Retry upload
      const retryOperation = async () => {
        const retryButton = page.getByRole('button', { name: /retry|try again/i })
        await retryButton.click()

        await page.waitForSelector('[data-testid="upload-complete"]', { timeout: 20000 })
        return true
      }

      await performanceHelpers.assertWithinTime(
        retryOperation,
        15000, // Should retry and complete within 15 seconds
        'Upload retry after failure'
      )

      // Verify successful upload after retry
      await expect(page.getByText(/test-recovery\.pdf/i)).toBeVisible()
    })

    test('should handle malformed file rejection quickly', async ({ page }) => {
      const malformedFile = path.join(__dirname, '../fixtures/malformed.exe')

      const uploadButton = page.getByRole('button', { name: /upload file|attach/i })
      await uploadButton.click()

      const rejectionOperation = async () => {
        const fileInput = page.getByTestId('file-input')
        await fileInput.setInputFiles(malformedFile)

        // Should detect and reject malformed file quickly
        await page.waitForSelector('[data-testid="security-rejection"]', { timeout: 3000 })
        return true
      }

      await performanceHelpers.assertWithinTime(
        rejectionOperation,
        2000, // Should reject within 2 seconds
        'Malformed file security rejection'
      )

      // Verify security error message
      await expect(page.getByText(/file type not allowed|security risk/i)).toBeVisible()
    })
  })

  test.describe('Integration with Chat Performance', () => {
    test('should integrate uploaded file into conversation quickly', async ({ page }) => {
      const testFile = path.join(__dirname, '../fixtures/math-worksheet.pdf')

      // Upload file
      const uploadButton = page.getByRole('button', { name: /upload file|attach/i })
      await uploadButton.click()

      const fileInput = page.getByTestId('file-input')
      await fileInput.setInputFiles(testFile)

      await page.waitForSelector('[data-testid="upload-complete"]', { timeout: 15000 })

      // Send follow-up message about the file
      const integrationOperation = async () => {
        const chatInput = page.getByPlaceholderText(/ask about lesson plans/i)
        await chatInput.fill('Can you help me improve this math worksheet?')

        const sendButton = page.getByRole('button', { name: /send/i })
        await sendButton.click()

        // AI should respond quickly since file is already processed
        await page.waitForSelector('[data-testid="ai-message"]', { timeout: 8000 })
        return true
      }

      await performanceHelpers.assertWithinTime(
        integrationOperation,
        6000, // Should respond within 6 seconds with file context
        'File-integrated chat response'
      )

      // Verify AI references the uploaded file
      const aiResponse = page.getByTestId('ai-message').last()
      await expect(aiResponse).toContainText(/worksheet|math|uploaded/i)
    })

    test('should maintain chat responsiveness during file processing', async ({ page }) => {
      const testFile = path.join(__dirname, '../fixtures/complex-document.pdf')

      // Start file upload
      const uploadButton = page.getByRole('button', { name: /upload file|attach/i })
      await uploadButton.click()

      const fileInput = page.getByTestId('file-input')
      await fileInput.setInputFiles(testFile)

      // While file is processing, test chat responsiveness
      const chatResponsivenessOperation = async () => {
        const chatInput = page.getByPlaceholderText(/ask about lesson plans/i)
        await chatInput.fill('Quick question while file uploads: What is scaffolding in education?')

        const sendButton = page.getByRole('button', { name: /send/i })
        await sendButton.click()

        // Chat should remain responsive
        await page.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 })
        return true
      }

      await performanceHelpers.assertWithinTime(
        chatResponsivenessOperation,
        8000, // Chat should remain responsive
        'Chat responsiveness during file processing'
      )

      // Verify both the chat response and file upload complete
      await expect(page.getByText(/scaffolding/i)).toBeVisible()
      await expect(page.getByText(/complex-document\.pdf/i)).toBeVisible({ timeout: 30000 })
    })
  })
})