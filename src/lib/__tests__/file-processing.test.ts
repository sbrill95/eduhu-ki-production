import {
  processFile,
  isFileTypeSupported,
  getEstimatedProcessingTime,
  cleanExtractedText,
  extractEducationalMetadata,
  FileProcessingResult
} from '../file-processing'
import { processImageModern } from '../modern-image-processing'
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'

// Mock external dependencies
jest.mock('../modern-image-processing')
jest.mock('mammoth')
jest.mock('pdf-parse')

const mockProcessImageModern = processImageModern as jest.MockedFunction<typeof processImageModern>
const mockMammoth = mammoth as jest.Mocked<typeof mammoth>
const mockPdfParse = pdfParse as jest.MockedFunction<typeof pdfParse>

describe('file-processing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('processFile', () => {
    const createMockFile = (name: string, type: string, size: number = 1024): File => {
      const content = 'test file content'
      const blob = new Blob([content], { type })
      return new File([blob], name, { type })
    }

    it('should successfully process an image file', async () => {
      const mockFile = createMockFile('test.jpg', 'image/jpeg')

      mockProcessImageModern.mockResolvedValue({
        success: true,
        extractedText: 'Text from image',
        thumbnailUrl: 'https://example.com/thumbnail.jpg',
        metadata: { width: 800, height: 600 },
        errors: []
      })

      const result = await processFile(mockFile, 'https://example.com/test.jpg')

      expect(result.success).toBe(true)
      expect(result.extractedText).toBe('Text from image')
      expect(result.thumbnailUrl).toBe('https://example.com/thumbnail.jpg')
      expect(result.metadata).toMatchObject({
        originalSize: expect.any(Number),
        originalType: 'image/jpeg',
        width: 800,
        height: 600,
        hasExtractedText: true,
        hasThumbnail: true
      })
      expect(mockProcessImageModern).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        'image/jpeg',
        'test.jpg'
      )
    })

    it('should successfully process a PDF file', async () => {
      const mockFile = createMockFile('document.pdf', 'application/pdf')

      mockPdfParse.mockResolvedValue({
        text: 'PDF content text',
        numpages: 5,
        info: {
          Title: 'Test Document',
          Author: 'Test Author',
          Subject: 'Test Subject'
        }
      })

      const result = await processFile(mockFile, 'https://example.com/doc.pdf')

      expect(result.success).toBe(true)
      expect(result.extractedText).toBe('PDF content text')
      expect(result.metadata).toMatchObject({
        pageCount: 5,
        textLength: 16,
        hasText: true,
        title: 'Test Document',
        author: 'Test Author',
        subject: 'Test Subject',
        thumbnailAvailable: false
      })
    })

    it('should successfully process a DOCX file', async () => {
      const mockFile = createMockFile('document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')

      mockMammoth.extractRawText.mockResolvedValue({
        value: 'Word document content',
        messages: [
          { type: 'warning', message: 'Test warning' },
          { type: 'error', message: 'Test error' }
        ]
      })

      const result = await processFile(mockFile, 'https://example.com/doc.docx')

      expect(result.success).toBe(false) // Due to error in messages
      expect(result.extractedText).toBe('Word document content')
      expect(result.metadata).toMatchObject({
        textLength: 21,
        hasText: true,
        documentType: 'docx',
        warnings: ['Test warning']
      })
      expect(result.processingErrors).toContain('Test error')
    })

    it('should handle legacy DOC files with error message', async () => {
      const mockFile = createMockFile('document.doc', 'application/msword')

      const result = await processFile(mockFile, 'https://example.com/doc.doc')

      expect(result.success).toBe(false)
      expect(result.processingErrors).toContain('Legacy .doc format not supported, please use .docx')
    })

    it('should successfully process a text file', async () => {
      const mockFile = createMockFile('test.txt', 'text/plain', 100)

      const result = await processFile(mockFile, 'https://example.com/test.txt')

      expect(result.success).toBe(true)
      expect(result.extractedText).toBe('test file content')
      expect(result.metadata).toMatchObject({
        textLength: 17,
        hasText: true,
        encoding: 'utf-8',
        lineCount: 1,
        wordCount: 3,
        characterCount: 17
      })
    })

    it('should handle unsupported file types', async () => {
      const mockFile = createMockFile('test.xyz', 'application/xyz')

      const result = await processFile(mockFile, 'https://example.com/test.xyz')

      expect(result.success).toBe(false)
      expect(result.processingErrors).toContain('Unsupported file type: application/xyz')
    })

    it('should handle processing errors gracefully', async () => {
      const mockFile = createMockFile('test.jpg', 'image/jpeg')

      mockProcessImageModern.mockRejectedValue(new Error('Processing failed'))

      const result = await processFile(mockFile, 'https://example.com/test.jpg')

      expect(result.success).toBe(false)
      expect(result.processingErrors).toContain('Processing failed')
      expect(result.metadata).toMatchObject({
        originalSize: expect.any(Number),
        originalType: 'image/jpeg',
        processingDurationMs: expect.any(Number)
      })
    })

    it('should include processing timing metadata', async () => {
      const mockFile = createMockFile('test.txt', 'text/plain')

      const result = await processFile(mockFile, 'https://example.com/test.txt')

      expect(result.metadata).toMatchObject({
        processingStartTime: expect.any(Number),
        processingEndTime: expect.any(Number),
        processingDurationMs: expect.any(Number)
      })
      expect(result.metadata!.processingEndTime).toBeGreaterThan(result.metadata!.processingStartTime)
    })
  })

  describe('isFileTypeSupported', () => {
    it('should return true for supported image types', () => {
      expect(isFileTypeSupported('image/jpeg')).toBe(true)
      expect(isFileTypeSupported('image/png')).toBe(true)
      expect(isFileTypeSupported('image/gif')).toBe(true)
      expect(isFileTypeSupported('image/webp')).toBe(true)
    })

    it('should return true for supported document types', () => {
      expect(isFileTypeSupported('application/pdf')).toBe(true)
      expect(isFileTypeSupported('application/msword')).toBe(true)
      expect(isFileTypeSupported('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true)
    })

    it('should return true for text types', () => {
      expect(isFileTypeSupported('text/plain')).toBe(true)
      expect(isFileTypeSupported('text/csv')).toBe(true)
      expect(isFileTypeSupported('text/markdown')).toBe(true)
      expect(isFileTypeSupported('text/html')).toBe(true) // any text/* type
    })

    it('should return false for unsupported types', () => {
      expect(isFileTypeSupported('video/mp4')).toBe(false)
      expect(isFileTypeSupported('audio/mp3')).toBe(false)
      expect(isFileTypeSupported('application/unknown')).toBe(false)
    })
  })

  describe('getEstimatedProcessingTime', () => {
    it('should return correct base times for different file types', () => {
      expect(getEstimatedProcessingTime(1024, 'text/plain')).toBe(1000) // 1 second base
      expect(getEstimatedProcessingTime(1024, 'image/jpeg')).toBe(2000) // 2 seconds base
      expect(getEstimatedProcessingTime(1024, 'application/pdf')).toBe(5000) // 5 seconds base
      expect(getEstimatedProcessingTime(1024, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(3000) // 3 seconds base
    })

    it('should add time based on file size', () => {
      const oneMB = 1024 * 1024
      const twoMB = 2 * oneMB

      expect(getEstimatedProcessingTime(oneMB, 'text/plain')).toBe(2000) // 1000 + 1000
      expect(getEstimatedProcessingTime(twoMB, 'text/plain')).toBe(3000) // 1000 + 2000
    })

    it('should combine base time and size factor', () => {
      const oneMB = 1024 * 1024
      expect(getEstimatedProcessingTime(oneMB, 'image/jpeg')).toBe(3000) // 2000 + 1000
    })
  })

  describe('cleanExtractedText', () => {
    it('should return empty string for falsy input', () => {
      expect(cleanExtractedText('')).toBe('')
      expect(cleanExtractedText(null as any)).toBe('')
      expect(cleanExtractedText(undefined as any)).toBe('')
    })

    it('should clean excessive whitespace', () => {
      const input = 'This   has    excessive     whitespace'
      const expected = 'This has excessive whitespace'
      expect(cleanExtractedText(input)).toBe(expected)
    })

    it('should clean multiple line breaks', () => {
      const input = 'Line 1\n\n\n\nLine 2'
      const expected = 'Line 1\nLine 2'
      expect(cleanExtractedText(input)).toBe(expected)
    })

    it('should trim whitespace', () => {
      const input = '   \n  Text with surrounding whitespace  \n  '
      const expected = 'Text with surrounding whitespace'
      expect(cleanExtractedText(input)).toBe(expected)
    })

    it('should limit text length', () => {
      const longText = 'a'.repeat(60000)
      const result = cleanExtractedText(longText)
      expect(result.length).toBe(50000)
    })

    it('should handle complex text cleaning', () => {
      const input = '  \n\n  This   is    a\n\n\ncomplex   text\n\nwith    various    \n\n  issues  \n\n  '
      const expected = 'This is a\ncomplex text\nwith various\nissues'
      expect(cleanExtractedText(input)).toBe(expected)
    })
  })

  describe('extractEducationalMetadata', () => {
    it('should return empty object for empty text', () => {
      expect(extractEducationalMetadata('')).toEqual({})
      expect(extractEducationalMetadata(null as any)).toEqual({})
    })

    it('should detect grade levels', () => {
      const text = 'This is for Grade 5 and 3rd grade students, also kindergarten'
      const result = extractEducationalMetadata(text)

      expect(result.detectedGrades).toEqual(
        expect.arrayContaining(['Grade 5', '3rd grade', 'kindergarten'])
      )
    })

    it('should detect subjects', () => {
      const text = 'This math lesson covers science concepts and english literature'
      const result = extractEducationalMetadata(text)

      expect(result.detectedSubjects).toEqual(
        expect.arrayContaining(['math', 'science', 'english', 'literature'])
      )
    })

    it('should detect educational terms', () => {
      const text = 'This lesson plan includes a worksheet and assessment rubric for the assignment'
      const result = extractEducationalMetadata(text)

      expect(result.educationalTerms).toEqual(
        expect.arrayContaining(['lesson plan', 'worksheet', 'assessment', 'rubric', 'assignment'])
      )
    })

    it('should handle case insensitive detection', () => {
      const text = 'MATH lesson for GRADE 7 with WORKSHEET'
      const result = extractEducationalMetadata(text)

      expect(result.detectedSubjects).toContain('math')
      expect(result.detectedGrades).toContain('GRADE 7')
      expect(result.educationalTerms).toContain('worksheet')
    })

    it('should extract multiple types of metadata', () => {
      const text = `
        Grade 4 Mathematics Lesson Plan

        This worksheet covers basic math concepts for 4th grade students.
        The assignment includes a quiz and assessment rubric.
        Students will learn about science through hands-on activities.
      `

      const result = extractEducationalMetadata(text)

      expect(result).toMatchObject({
        detectedGrades: expect.arrayContaining(['Grade 4', '4th grade']),
        detectedSubjects: expect.arrayContaining(['math', 'science']),
        educationalTerms: expect.arrayContaining(['lesson plan', 'worksheet', 'assignment', 'quiz', 'assessment', 'rubric'])
      })
    })

    it('should not duplicate detected items', () => {
      const text = 'math math math Grade 5 Grade 5 lesson plan lesson plan'
      const result = extractEducationalMetadata(text)

      expect(result.detectedSubjects).toEqual(['math'])
      expect(result.detectedGrades).toEqual(['Grade 5'])
      expect(result.educationalTerms).toEqual(['lesson plan'])
    })
  })
})