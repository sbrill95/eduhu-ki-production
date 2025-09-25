import crypto from 'crypto'

// Optional JWT import - graceful degradation if not available
let jwt: any = null
try {
  jwt = require('jsonwebtoken')
} catch (error) {
  console.warn('jsonwebtoken not available - file access tokens will use basic signing')
}

// Security configuration for file storage
export const STORAGE_SECURITY_CONFIG = {
  // File access token configuration
  ACCESS_TOKEN_SECRET: process.env.FILE_ACCESS_TOKEN_SECRET || 'change-in-production',
  ACCESS_TOKEN_EXPIRES_IN: process.env.SIGNED_URL_EXPIRES_MINUTES ?
    parseInt(process.env.SIGNED_URL_EXPIRES_MINUTES) * 60 :
    3600, // 1 hour default

  // CORS configuration
  CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS ?
    process.env.CORS_ALLOWED_ORIGINS.split(',') :
    ['http://localhost:3000'],

  // File upload security
  MAX_FILE_SIZE_MB: process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB ?
    parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB) :
    10,

  ALLOWED_FILE_EXTENSIONS: process.env.ALLOWED_FILE_EXTENSIONS ?
    process.env.ALLOWED_FILE_EXTENSIONS.split(',') :
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'txt', 'csv', 'md'],

  // Storage limits per teacher
  MAX_STORAGE_PER_TEACHER_GB: process.env.MAX_STORAGE_PER_TEACHER_GB ?
    parseInt(process.env.MAX_STORAGE_PER_TEACHER_GB) :
    2,

  // Content security policy sources
  CSP_FILE_UPLOAD_SOURCES: process.env.CSP_FILE_UPLOAD_SOURCES ?
    process.env.CSP_FILE_UPLOAD_SOURCES.split(',') :
    ['self', 'data:', 'blob:'],
} as const

/**
 * Generate a secure file access token
 * Used for temporary file access authentication
 */
export function generateFileAccessToken(payload: {
  teacherId: string
  filename: string
  sessionId?: string
  expiresIn?: number
}): string {
  const tokenPayload = {
    teacherId: payload.teacherId,
    filename: payload.filename,
    sessionId: payload.sessionId,
    type: 'file_access',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (payload.expiresIn || STORAGE_SECURITY_CONFIG.ACCESS_TOKEN_EXPIRES_IN),
  }

  if (jwt) {
    // Use JWT if available
    return jwt.sign(
      tokenPayload,
      STORAGE_SECURITY_CONFIG.ACCESS_TOKEN_SECRET,
      {
        expiresIn: payload.expiresIn || STORAGE_SECURITY_CONFIG.ACCESS_TOKEN_EXPIRES_IN,
        issuer: 'eduhu-ki',
        audience: 'file-storage'
      }
    )
  } else {
    // Fallback to basic signed token
    const tokenString = JSON.stringify(tokenPayload)
    const signature = crypto
      .createHmac('sha256', STORAGE_SECURITY_CONFIG.ACCESS_TOKEN_SECRET)
      .update(tokenString)
      .digest('hex')

    return Buffer.from(`${tokenString}.${signature}`).toString('base64')
  }
}

/**
 * Verify and decode a file access token
 */
export function verifyFileAccessToken(token: string): {
  teacherId: string
  filename: string
  sessionId?: string
  type: string
} {
  try {
    if (jwt) {
      // Use JWT verification if available
      const decoded = jwt.verify(
        token,
        STORAGE_SECURITY_CONFIG.ACCESS_TOKEN_SECRET,
        {
          issuer: 'eduhu-ki',
          audience: 'file-storage'
        }
      ) as any

      if (decoded.type !== 'file_access') {
        throw new Error('Invalid token type')
      }

      return {
        teacherId: decoded.teacherId,
        filename: decoded.filename,
        sessionId: decoded.sessionId,
        type: decoded.type
      }
    } else {
      // Fallback verification for basic signed tokens
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const [tokenString, providedSignature] = decoded.split('.')

      if (!tokenString || !providedSignature) {
        throw new Error('Invalid token format')
      }

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', STORAGE_SECURITY_CONFIG.ACCESS_TOKEN_SECRET)
        .update(tokenString)
        .digest('hex')

      if (providedSignature !== expectedSignature) {
        throw new Error('Invalid token signature')
      }

      const payload = JSON.parse(tokenString)

      // Check expiration
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        throw new Error('Token has expired')
      }

      if (payload.type !== 'file_access') {
        throw new Error('Invalid token type')
      }

      return {
        teacherId: payload.teacherId,
        filename: payload.filename,
        sessionId: payload.sessionId,
        type: payload.type
      }
    }
  } catch (error) {
    throw new Error(`Invalid file access token: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Generate a secure filename with anti-collision measures
 */
export function generateSecureFilename(originalFilename: string, teacherId: string): string {
  const timestamp = Date.now()
  const randomBytes = crypto.randomBytes(8).toString('hex')
  const teacherPrefix = teacherId.substring(0, 8)
  const fileExtension = getFileExtension(originalFilename)

  // Create collision-resistant filename
  const hash = crypto.createHash('md5')
    .update(`${teacherId}-${originalFilename}-${timestamp}`)
    .digest('hex')
    .substring(0, 8)

  return `${teacherPrefix}-${timestamp}-${hash}-${randomBytes}${fileExtension}`
}

/**
 * Validate file security before upload
 */
export function validateFileUploadSecurity(
  file: File,
  teacherId: string,
  currentStorageUsageBytes: number = 0
): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate file size
  const maxFileSizeBytes = STORAGE_SECURITY_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024
  if (file.size > maxFileSizeBytes) {
    errors.push(`File size ${formatBytes(file.size)} exceeds maximum allowed size of ${STORAGE_SECURITY_CONFIG.MAX_FILE_SIZE_MB}MB`)
  }

  // Validate file extension
  const fileExtension = getFileExtension(file.name).toLowerCase().substring(1) // Remove the dot
  if (!STORAGE_SECURITY_CONFIG.ALLOWED_FILE_EXTENSIONS.includes(fileExtension)) {
    errors.push(`File type '.${fileExtension}' is not allowed. Allowed types: ${STORAGE_SECURITY_CONFIG.ALLOWED_FILE_EXTENSIONS.join(', ')}`)
  }

  // Check for dangerous extensions
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.vbs', '.js', '.jar', '.com', '.pif', '.msi', '.app']
  const fullExtension = getFileExtension(file.name).toLowerCase()
  if (dangerousExtensions.includes(fullExtension)) {
    errors.push(`File extension '${fullExtension}' is blocked for security reasons`)
  }

  // Validate filename
  if (file.name.length > 255) {
    errors.push('Filename is too long (maximum 255 characters)')
  }

  // Check for suspicious filename patterns
  const suspiciousPatterns = [
    /\.\./,  // Path traversal
    /[<>:"|?*]/,  // Invalid filename characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i,  // Windows reserved names
  ]

  suspiciousPatterns.forEach(pattern => {
    if (pattern.test(file.name)) {
      errors.push('Filename contains invalid or suspicious characters')
    }
  })

  // Validate storage quota
  const maxStorageBytes = STORAGE_SECURITY_CONFIG.MAX_STORAGE_PER_TEACHER_GB * 1024 * 1024 * 1024
  const newTotalStorage = currentStorageUsageBytes + file.size

  if (newTotalStorage > maxStorageBytes) {
    errors.push(`Upload would exceed storage limit of ${STORAGE_SECURITY_CONFIG.MAX_STORAGE_PER_TEACHER_GB}GB. Current usage: ${formatBytes(currentStorageUsageBytes)}, File size: ${formatBytes(file.size)}`)
  }

  // Warning for large files
  if (file.size > 50 * 1024 * 1024) { // 50MB
    warnings.push('Large file detected. Upload may take longer and consume more bandwidth.')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate CORS origin against allowed origins
 */
export function validateCORSOrigin(origin: string | null): boolean {
  if (!origin) {
    return false
  }

  // Check exact matches
  if (STORAGE_SECURITY_CONFIG.CORS_ALLOWED_ORIGINS.includes(origin)) {
    return true
  }

  // Check wildcard patterns
  return STORAGE_SECURITY_CONFIG.CORS_ALLOWED_ORIGINS.some(allowedOrigin => {
    if (allowedOrigin.includes('*')) {
      const pattern = allowedOrigin.replace(/\*/g, '.*')
      const regex = new RegExp(`^${pattern}$`)
      return regex.test(origin)
    }
    return false
  })
}

/**
 * Generate security headers for file responses
 */
export function getSecurityHeaders(filename?: string): HeadersInit {
  const headers: HeadersInit = {
    // Basic security headers
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Content Security Policy
    'Content-Security-Policy': [
      "default-src 'self'",
      `media-src 'self' ${STORAGE_SECURITY_CONFIG.CSP_FILE_UPLOAD_SOURCES.join(' ')}`,
      `img-src 'self' ${STORAGE_SECURITY_CONFIG.CSP_FILE_UPLOAD_SOURCES.join(' ')} data: https:`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; '),

    // Cache control for sensitive files
    'Cache-Control': filename?.includes('private') ? 'private, no-cache' : 'public, max-age=31536000',

    // CORS headers
    'Access-Control-Allow-Origin': STORAGE_SECURITY_CONFIG.CORS_ALLOWED_ORIGINS[0] || '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    'Access-Control-Max-Age': '86400',
  }

  return headers
}

/**
 * Generate CORS preflight response headers
 */
export function getCORSPreflightHeaders(origin: string | null): HeadersInit {
  const headers: HeadersInit = {}

  if (origin && validateCORSOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, HEAD, OPTIONS'
    headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-File-Token'
    headers['Access-Control-Max-Age'] = '86400'
    headers['Access-Control-Allow-Credentials'] = 'false'
  }

  return headers
}

/**
 * Sanitize filename for storage
 */
export function sanitizeFilename(filename: string): string {
  // Remove or replace dangerous characters
  return filename
    .replace(/[<>:"|?*]/g, '-')  // Replace dangerous chars with dash
    .replace(/\.\./g, '.')       // Remove path traversal
    .replace(/^\.+/, '')         // Remove leading dots
    .replace(/\.+$/, '')         // Remove trailing dots
    .replace(/\s+/g, '_')        // Replace spaces with underscores
    .substring(0, 255)           // Limit length
}

/**
 * Calculate file hash for integrity checking
 */
export async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Rate limiting for file uploads per teacher
 */
export class FileUploadRateLimiter {
  private static uploadCounts = new Map<string, { count: number; resetTime: number }>()
  private static readonly MAX_UPLOADS_PER_HOUR = 50
  private static readonly WINDOW_MS = 60 * 60 * 1000 // 1 hour

  static checkLimit(teacherId: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now()
    const key = teacherId
    const current = this.uploadCounts.get(key)

    if (!current || now > current.resetTime) {
      // Reset or initialize
      const resetTime = now + this.WINDOW_MS
      this.uploadCounts.set(key, { count: 0, resetTime })
      return {
        allowed: true,
        remaining: this.MAX_UPLOADS_PER_HOUR - 1,
        resetTime
      }
    }

    if (current.count >= this.MAX_UPLOADS_PER_HOUR) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: current.resetTime
      }
    }

    // Increment and update
    current.count++
    this.uploadCounts.set(key, current)

    return {
      allowed: true,
      remaining: this.MAX_UPLOADS_PER_HOUR - current.count,
      resetTime: current.resetTime
    }
  }
}

// Utility functions
function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.')
  return lastDotIndex === -1 ? '' : filename.substring(lastDotIndex)
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}