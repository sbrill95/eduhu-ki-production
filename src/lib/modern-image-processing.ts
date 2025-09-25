// Modern image processing using Web APIs compatible with Edge Runtime
// Replaces canvas dependency with native browser/Web APIs
import { FILE_UPLOAD_CONFIG } from '@/lib/instant-server'
import { saveThumbnailToCloudStorage } from '@/lib/file-storage'

export interface ImageProcessingResult {
  success: boolean
  thumbnailUrl?: string
  metadata?: Record<string, any>
  errors?: string[]
}

/**
 * Modern image processing using Web APIs instead of canvas
 * Compatible with Edge Runtime and serverless environments
 */
export async function processImageModern(
  buffer: Uint8Array,
  mimeType: string,
  filename: string
): Promise<ImageProcessingResult> {
  const errors: string[] = []
  let thumbnailUrl: string | undefined
  let metadata: Record<string, any> = {}

  try {
    // Create blob from buffer
    const imageBlob = new Blob([buffer as Uint8Array], { type: mimeType })

    // Use ImageData or OffscreenCanvas if available in Edge Runtime
    if (typeof OffscreenCanvas !== 'undefined') {
      try {
        const result = await processWithOffscreenCanvas(imageBlob, filename)
        thumbnailUrl = result.thumbnailUrl
        metadata = { ...metadata, ...result.metadata }
        errors.push(...(result.errors || []))
      } catch (offscreenError) {
        console.warn('OffscreenCanvas processing failed, falling back to metadata extraction:', offscreenError)
        // Fall back to basic metadata extraction
        const basicResult = await extractBasicImageMetadata(imageBlob)
        metadata = { ...metadata, ...basicResult.metadata }
        errors.push('Thumbnail generation skipped - using basic metadata extraction')
      }
    } else {
      // Edge Runtime fallback - extract basic metadata only
      console.warn('OffscreenCanvas not available in Edge Runtime, using basic metadata extraction')
      const basicResult = await extractBasicImageMetadata(imageBlob)
      metadata = { ...metadata, ...basicResult.metadata }
      errors.push('Thumbnail generation not available in Edge Runtime')
    }

    return {
      success: errors.length === 0,
      thumbnailUrl,
      metadata,
      errors: errors.length > 0 ? errors : undefined
    }

  } catch (error) {
    console.error('Modern image processing error:', error)
    errors.push(error instanceof Error ? error.message : 'Unknown image processing error')

    return {
      success: false,
      metadata,
      errors
    }
  }
}

/**
 * Process image using OffscreenCanvas (when available)
 */
async function processWithOffscreenCanvas(
  imageBlob: Blob,
  filename: string
): Promise<{ thumbnailUrl?: string; metadata: Record<string, any>; errors?: string[] }> {
  const errors: string[] = []
  let thumbnailUrl: string | undefined
  const metadata: Record<string, any> = {}

  try {
    // Create ImageBitmap from blob
    const imageBitmap = await createImageBitmap(imageBlob)

    metadata.originalWidth = imageBitmap.width
    metadata.originalHeight = imageBitmap.height
    metadata.aspectRatio = imageBitmap.width / imageBitmap.height

    // Calculate thumbnail dimensions
    const { width: thumbWidth, height: thumbHeight } = FILE_UPLOAD_CONFIG.THUMBNAIL_SIZE

    let finalWidth = thumbWidth
    let finalHeight = thumbHeight

    if (imageBitmap.width > imageBitmap.height) {
      finalHeight = Math.round((thumbWidth / imageBitmap.width) * imageBitmap.height)
    } else {
      finalWidth = Math.round((thumbHeight / imageBitmap.height) * imageBitmap.width)
    }

    // Create OffscreenCanvas for thumbnail generation
    const canvas = new OffscreenCanvas(finalWidth, finalHeight)
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('Failed to get 2D context from OffscreenCanvas')
    }

    // Draw resized image
    ctx.drawImage(imageBitmap, 0, 0, finalWidth, finalHeight)

    // Convert canvas to blob
    const thumbnailBlob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: 0.8
    })

    try {
      // Convert blob to buffer for cloud storage
      const thumbnailBuffer = new Uint8Array(await thumbnailBlob.arrayBuffer())

      // Upload thumbnail to cloud storage
      thumbnailUrl = await saveThumbnailToCloudStorage(thumbnailBuffer, filename)
    } catch (thumbnailError) {
      console.error('Thumbnail upload error:', thumbnailError)
      errors.push('Failed to upload generated thumbnail')

      // Fallback to base64 data URL for development
      if (process.env.NODE_ENV === 'development') {
        const reader = new FileReader()
        thumbnailUrl = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(thumbnailBlob)
        })
      }
    }

    metadata.thumbnailWidth = finalWidth
    metadata.thumbnailHeight = finalHeight
    metadata.processingMethod = 'OffscreenCanvas'

    // Clean up
    imageBitmap.close()

  } catch (error) {
    console.error('OffscreenCanvas processing error:', error)
    errors.push('Failed to process image with OffscreenCanvas')
  }

  return { thumbnailUrl, metadata, errors }
}

/**
 * Extract basic image metadata without canvas dependency
 */
async function extractBasicImageMetadata(
  imageBlob: Blob
): Promise<{ metadata: Record<string, any> }> {
  const metadata: Record<string, any> = {}

  try {
    // Create ImageBitmap to get dimensions (if available)
    if (typeof createImageBitmap !== 'undefined') {
      try {
        const imageBitmap = await createImageBitmap(imageBlob)
        metadata.originalWidth = imageBitmap.width
        metadata.originalHeight = imageBitmap.height
        metadata.aspectRatio = imageBitmap.width / imageBitmap.height
        metadata.processingMethod = 'ImageBitmap metadata only'
        imageBitmap.close()
      } catch (bitmapError) {
        console.warn('ImageBitmap creation failed:', bitmapError)
        metadata.processingMethod = 'Blob metadata only'
      }
    } else {
      metadata.processingMethod = 'Basic blob analysis'
    }

    // Add blob metadata
    metadata.fileSize = imageBlob.size
    metadata.mimeType = imageBlob.type
    metadata.thumbnailGenerated = false
    metadata.thumbnailNote = 'Thumbnail generation not available in this environment'

  } catch (error) {
    console.error('Basic metadata extraction error:', error)
    metadata.error = 'Failed to extract basic image metadata'
  }

  return { metadata }
}

/**
 * Check if modern image processing is available in current environment
 */
export function isModernImageProcessingAvailable(): boolean {
  return typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined'
}

/**
 * Get image processing capabilities for current environment
 */
export function getImageProcessingCapabilities(): {
  canCreateThumbnails: boolean
  canExtractDimensions: boolean
  availableMethods: string[]
} {
  const capabilities = {
    canCreateThumbnails: false,
    canExtractDimensions: false,
    availableMethods: [] as string[]
  }

  if (typeof OffscreenCanvas !== 'undefined') {
    capabilities.canCreateThumbnails = true
    capabilities.availableMethods.push('OffscreenCanvas')
  }

  if (typeof createImageBitmap !== 'undefined') {
    capabilities.canExtractDimensions = true
    capabilities.availableMethods.push('ImageBitmap')
  }

  if (typeof ImageData !== 'undefined') {
    capabilities.availableMethods.push('ImageData')
  }

  return capabilities
}

/**
 * Validate image file before processing
 */
export function validateImageFile(file: File): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check file size
  if (file.size > FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
    errors.push(`File size exceeds ${FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_MB}MB limit`)
  }

  // Check file type
  if (!file.type.startsWith('image/')) {
    errors.push('File is not an image')
  }

  // Check supported image types
  const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!supportedTypes.includes(file.type)) {
    errors.push(`Unsupported image type: ${file.type}`)
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Create a placeholder thumbnail URL for development/fallback
 */
export function createPlaceholderThumbnail(
  originalWidth: number,
  originalHeight: number,
  filename: string
): string {
  const { width, height } = FILE_UPLOAD_CONFIG.THUMBNAIL_SIZE

  // Create a simple SVG placeholder
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="40%" text-anchor="middle" fill="#6b7280" font-family="Arial, sans-serif" font-size="12">
        Image
      </text>
      <text x="50%" y="55%" text-anchor="middle" fill="#9ca3af" font-family="Arial, sans-serif" font-size="10">
        ${originalWidth} × ${originalHeight}
      </text>
      <text x="50%" y="70%" text-anchor="middle" fill="#9ca3af" font-family="Arial, sans-serif" font-size="8">
        ${filename.length > 20 ? `${filename.substring(0, 17)  }...` : filename}
      </text>
    </svg>
  `.trim()

  return `data:image/svg+xml;base64,${btoa(svg)}`
}

/**
 * Edge Runtime compatible image analyzer
 */
export class EdgeImageProcessor {
  private static instance: EdgeImageProcessor

  static getInstance(): EdgeImageProcessor {
    if (!this.instance) {
      this.instance = new EdgeImageProcessor()
    }
    return this.instance
  }

  async processImage(file: File, fileUrl: string): Promise<ImageProcessingResult> {
    // Validate file first
    const validation = validateImageFile(file)
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      }
    }

    // Get file buffer
    const buffer = new Uint8Array(await file.arrayBuffer())

    // Process using modern methods
    return processImageModern(buffer, file.type, file.name)
  }

  getCapabilities() {
    return getImageProcessingCapabilities()
  }

  isProcessingAvailable(): boolean {
    return isModernImageProcessingAvailable()
  }
}

// Export singleton instance
export const edgeImageProcessor = EdgeImageProcessor.getInstance()