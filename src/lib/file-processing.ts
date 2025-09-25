import { FILE_UPLOAD_CONFIG } from '@/lib/instant'
import { saveThumbnailToCloudStorage } from '@/lib/file-storage'
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'

// Optional canvas import for thumbnail generation
let createCanvas: any = null
let loadImage: any = null

// Only try to load canvas in Node.js environment and if it exists
if (typeof window === 'undefined') {
  try {
    // Use dynamic import to avoid webpack bundling issues
    const canvas = require('canvas')
    createCanvas = canvas.createCanvas
    loadImage = canvas.loadImage
  } catch (error) {
    console.warn('Canvas not available - thumbnail generation disabled')
    // Don't log the full error in production to avoid noise
  }
}

export interface FileProcessingResult {
  success: boolean
  extractedText?: string
  metadata?: Record<string, any>
  thumbnailUrl?: string
  processingErrors?: string[]
}

/**
 * Process uploaded file based on its type
 * Handles text extraction, thumbnail generation, and metadata extraction
 */
export async function processFile(file: File, fileUrl: string): Promise<FileProcessingResult> {
  const startTime = Date.now()
  const errors: string[] = []
  let extractedText: string | undefined
  let thumbnailUrl: string | undefined
  let metadata: Record<string, any> = {
    processingStartTime: startTime,
    originalSize: file.size,
    originalType: file.type
  }

  try {
    // Get file buffer for processing
    const buffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(buffer)

    // Process based on file type
    if (file.type.startsWith('image/')) {
      const result = await processImage(uint8Array, file.type, file.name)
      extractedText = result.extractedText
      thumbnailUrl = result.thumbnailUrl
      metadata = { ...metadata, ...result.metadata }
      errors.push(...(result.errors || []))

    } else if (file.type === 'application/pdf') {
      const result = await processPDF(uint8Array)
      extractedText = result.extractedText
      thumbnailUrl = result.thumbnailUrl
      metadata = { ...metadata, ...result.metadata }
      errors.push(...(result.errors || []))

    } else if (
      file.type === 'application/msword' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const result = await processWordDocument(uint8Array, file.type)
      extractedText = result.extractedText
      metadata = { ...metadata, ...result.metadata }
      errors.push(...(result.errors || []))

    } else if (file.type.startsWith('text/')) {
      const result = await processTextFile(uint8Array)
      extractedText = result.extractedText
      metadata = { ...metadata, ...result.metadata }
      errors.push(...(result.errors || []))

    } else {
      errors.push(`Unsupported file type: ${file.type}`)
    }

    // Add processing completion metadata
    metadata.processingEndTime = Date.now()
    metadata.processingDurationMs = Date.now() - startTime
    metadata.hasExtractedText = !!extractedText
    metadata.hasThumbnail = !!thumbnailUrl

    return {
      success: errors.length === 0,
      extractedText,
      metadata,
      thumbnailUrl,
      processingErrors: errors.length > 0 ? errors : undefined
    }

  } catch (error) {
    console.error('File processing error:', error)
    errors.push(error instanceof Error ? error.message : 'Unknown processing error')

    return {
      success: false,
      metadata: {
        ...metadata,
        processingEndTime: Date.now(),
        processingDurationMs: Date.now() - startTime
      },
      processingErrors: errors
    }
  }
}

/**
 * Process image files - generate thumbnails and extract metadata
 */
async function processImage(
  buffer: Uint8Array,
  mimeType: string,
  filename: string
): Promise<{ extractedText?: string; thumbnailUrl?: string; metadata?: Record<string, any>; errors?: string[] }> {
  const errors: string[] = []
  let thumbnailUrl: string | undefined
  let metadata: Record<string, any> = {}

  try {
    // Create image from buffer
    const blob = new Blob([buffer], { type: mimeType })
    const imageUrl = URL.createObjectURL(blob)

    if (createCanvas && loadImage) {
      try {
        // Load image using canvas (Node.js environment)
        const image = await loadImage(buffer)

        metadata.originalWidth = image.width
        metadata.originalHeight = image.height
        metadata.aspectRatio = image.width / image.height

        // Generate thumbnail
        const { width: thumbWidth, height: thumbHeight } = FILE_UPLOAD_CONFIG.THUMBNAIL_SIZE

        // Calculate dimensions maintaining aspect ratio
        let finalWidth = thumbWidth
        let finalHeight = thumbHeight

        if (image.width > image.height) {
          finalHeight = Math.round((thumbWidth / image.width) * image.height)
        } else {
          finalWidth = Math.round((thumbHeight / image.height) * image.width)
        }

        // Create thumbnail canvas
        const canvas = createCanvas(finalWidth, finalHeight)
        const ctx = canvas.getContext('2d')

        // Draw resized image
        ctx.drawImage(image, 0, 0, finalWidth, finalHeight)

        // Convert canvas to buffer for cloud storage
        const thumbnailBuffer = canvas.toBuffer('image/jpeg', { quality: 0.8 })

        try {
          // Upload thumbnail to cloud storage
          thumbnailUrl = await saveThumbnailToCloudStorage(thumbnailBuffer, filename)
        } catch (thumbnailError) {
          console.error('Thumbnail upload error:', thumbnailError)
          errors.push('Failed to upload generated thumbnail')

          // Fallback to base64 data URL for development
          if (process.env.NODE_ENV === 'development') {
            thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8)
          }
        }

        metadata.thumbnailWidth = finalWidth
        metadata.thumbnailHeight = finalHeight

      } catch (imageError) {
        console.error('Image processing error:', imageError)
        errors.push('Failed to process image for thumbnail generation')
      } finally {
        URL.revokeObjectURL(imageUrl)
      }
    } else {
      // Canvas not available - skip thumbnail generation
      console.warn('Canvas not available - skipping thumbnail generation for image')
      errors.push('Thumbnail generation skipped - canvas not available in production')
      metadata.thumbnailSkipped = true
    }

    // For images, there's no text to extract unless we implement OCR
    // This would be where you'd integrate with services like Google Vision API or Tesseract
    // For now, we'll just note that OCR isn't implemented
    metadata.ocrAvailable = false
    metadata.ocrNote = 'OCR text extraction not implemented yet'

  } catch (error) {
    console.error('Image processing error:', error)
    errors.push(error instanceof Error ? error.message : 'Unknown image processing error')
  }

  return { thumbnailUrl, metadata, errors }
}

/**
 * Process PDF files - extract text and generate thumbnail
 */
async function processPDF(
  buffer: Uint8Array
): Promise<{ extractedText?: string; thumbnailUrl?: string; metadata?: Record<string, any>; errors?: string[] }> {
  const errors: string[] = []
  let extractedText: string | undefined
  let thumbnailUrl: string | undefined
  let metadata: Record<string, any> = {}

  try {
    // Parse PDF and extract text
    const pdfBuffer = Buffer.from(buffer)
    const pdfData = await pdfParse(pdfBuffer)

    extractedText = pdfData.text?.trim()

    metadata.pageCount = pdfData.numpages
    metadata.textLength = extractedText?.length || 0
    metadata.hasText = !!extractedText && extractedText.length > 0

    // Extract basic PDF info
    if (pdfData.info) {
      metadata.title = pdfData.info.Title
      metadata.author = pdfData.info.Author
      metadata.subject = pdfData.info.Subject
      metadata.creator = pdfData.info.Creator
      metadata.producer = pdfData.info.Producer
      metadata.creationDate = pdfData.info.CreationDate
      metadata.modificationDate = pdfData.info.ModDate
    }

    // PDF thumbnail generation would require additional libraries like pdf-poppler
    // For now, we'll note that thumbnail generation isn't implemented
    metadata.thumbnailAvailable = false
    metadata.thumbnailNote = 'PDF thumbnail generation not implemented yet'

  } catch (error) {
    console.error('PDF processing error:', error)
    errors.push(error instanceof Error ? error.message : 'Failed to process PDF')
  }

  return { extractedText, thumbnailUrl, metadata, errors }
}

/**
 * Process Word documents - extract text content
 */
async function processWordDocument(
  buffer: Uint8Array,
  mimeType: string
): Promise<{ extractedText?: string; metadata?: Record<string, any>; errors?: string[] }> {
  const errors: string[] = []
  let extractedText: string | undefined
  let metadata: Record<string, any> = {}

  try {
    const docBuffer = Buffer.from(buffer)

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // Process .docx files
      const result = await mammoth.extractRawText({ buffer: docBuffer })
      extractedText = result.value?.trim()

      if (result.messages && result.messages.length > 0) {
        const warnings = result.messages.filter(m => m.type === 'warning').map(m => m.message)
        const errors_from_mammoth = result.messages.filter(m => m.type === 'error').map(m => m.message)

        if (warnings.length > 0) {
          metadata.warnings = warnings
        }

        if (errors_from_mammoth.length > 0) {
          errors.push(...errors_from_mammoth)
        }
      }

    } else if (mimeType === 'application/msword') {
      // For older .doc files, we'd need a different library
      // For now, we'll indicate this isn't supported
      errors.push('Legacy .doc format not supported, please use .docx')
    }

    metadata.textLength = extractedText?.length || 0
    metadata.hasText = !!extractedText && extractedText.length > 0
    metadata.documentType = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? 'docx' : 'doc'

  } catch (error) {
    console.error('Word document processing error:', error)
    errors.push(error instanceof Error ? error.message : 'Failed to process Word document')
  }

  return { extractedText, metadata, errors }
}

/**
 * Process text files - extract content
 */
async function processTextFile(
  buffer: Uint8Array
): Promise<{ extractedText?: string; metadata?: Record<string, any>; errors?: string[] }> {
  const errors: string[] = []
  let extractedText: string | undefined
  let metadata: Record<string, any> = {}

  try {
    // Convert buffer to text using UTF-8 encoding
    const textDecoder = new TextDecoder('utf-8')
    extractedText = textDecoder.decode(buffer).trim()

    metadata.textLength = extractedText.length
    metadata.hasText = extractedText.length > 0
    metadata.encoding = 'utf-8'

    // Basic text analysis
    const lines = extractedText.split('\n')
    metadata.lineCount = lines.length
    metadata.wordCount = extractedText.split(/\s+/).filter(word => word.length > 0).length
    metadata.characterCount = extractedText.length

  } catch (error) {
    console.error('Text file processing error:', error)
    errors.push(error instanceof Error ? error.message : 'Failed to process text file')
  }

  return { extractedText, metadata, errors }
}

/**
 * Validate if file processing is supported for the given file type
 */
export function isFileTypeSupported(mimeType: string): boolean {
  const supportedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'text/markdown'
  ]

  return supportedTypes.includes(mimeType) || mimeType.startsWith('text/')
}

/**
 * Get estimated processing time based on file size and type
 */
export function getEstimatedProcessingTime(fileSize: number, mimeType: string): number {
  // Base time in milliseconds
  let baseTime = 1000 // 1 second

  // Adjust based on file type
  if (mimeType.startsWith('image/')) {
    baseTime = 2000 // 2 seconds for image processing
  } else if (mimeType === 'application/pdf') {
    baseTime = 5000 // 5 seconds for PDF processing
  } else if (mimeType.includes('word')) {
    baseTime = 3000 // 3 seconds for Word documents
  }

  // Adjust based on file size (add 1 second per MB)
  const sizeFactor = Math.floor(fileSize / (1024 * 1024)) * 1000

  return baseTime + sizeFactor
}

/**
 * Clean up extracted text for AI processing
 */
export function cleanExtractedText(text: string): string {
  if (!text) return ''

  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove multiple line breaks
    .replace(/\n\s*\n/g, '\n')
    // Trim whitespace
    .trim()
    // Limit length for AI processing (adjust as needed)
    .substring(0, 50000) // 50K character limit
}

/**
 * Extract educational metadata from processed text
 */
export function extractEducationalMetadata(text: string): Record<string, any> {
  if (!text) return {}

  const metadata: Record<string, any> = {}

  // Look for grade level indicators
  const gradePatterns = [
    /grade\s*(\d+)/gi,
    /(\d+)(?:st|nd|rd|th)\s*grade/gi,
    /(kindergarten|k-?\d+)/gi
  ]

  const gradeMatches: string[] = []
  gradePatterns.forEach(pattern => {
    const matches = text.match(pattern)
    if (matches) {
      gradeMatches.push(...matches)
    }
  })

  if (gradeMatches.length > 0) {
    metadata.detectedGrades = [...new Set(gradeMatches)]
  }

  // Look for subject indicators
  const subjects = [
    'math', 'mathematics', 'science', 'english', 'history', 'social studies',
    'reading', 'writing', 'art', 'music', 'physical education', 'pe',
    'biology', 'chemistry', 'physics', 'geography', 'literature'
  ]

  const detectedSubjects = subjects.filter(subject =>
    text.toLowerCase().includes(subject)
  )

  if (detectedSubjects.length > 0) {
    metadata.detectedSubjects = detectedSubjects
  }

  // Look for educational terms
  const educationalTerms = [
    'lesson plan', 'worksheet', 'assessment', 'rubric', 'assignment',
    'homework', 'quiz', 'test', 'project', 'activity', 'objective',
    'standard', 'curriculum', 'learning goal'
  ]

  const detectedTerms = educationalTerms.filter(term =>
    text.toLowerCase().includes(term)
  )

  if (detectedTerms.length > 0) {
    metadata.educationalTerms = detectedTerms
  }

  return metadata
}