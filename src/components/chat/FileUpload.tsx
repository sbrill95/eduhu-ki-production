'use client'

import { useState, useRef, useCallback, DragEvent } from 'react'
import { FILE_UPLOAD_CONFIG, FileUpload } from '@/lib/instant'

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void
  onFileRemove: (fileId: string) => void
  uploadedFiles: FileUpload[]
  disabled?: boolean
  maxFiles?: number
}

interface FilePreview {
  id: string
  file: File
  preview?: string
  error?: string
  uploading?: boolean
  progress?: number
}

export default function FileUploadComponent({
  onFilesSelected,
  onFileRemove,
  uploadedFiles = [],
  disabled = false,
  maxFiles = 10
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [previews, setPreviews] = useState<FilePreview[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Validate file type and size
  const validateFile = (file: File): string | null => {
    // Check file size (convert MB to bytes)
    if (file.size > FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `File size exceeds ${FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_MB}MB limit`
    }

    // Check file type
    const isValidType = FILE_UPLOAD_CONFIG.ALLOWED_TYPES.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1))
      }
      return file.type === type
    })

    if (!isValidType) {
      return 'File type not supported. Supported types: JPG, PDF, Word documents, and text files'
    }

    return null
  }

  // Generate file preview
  const generatePreview = useCallback((file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = () => resolve(undefined)
        reader.readAsDataURL(file)
      } else {
        resolve(undefined)
      }
    })
  }, [])

  // Handle file selection
  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || disabled) return

    const fileArray = Array.from(files)
    const totalFiles = previews.length + uploadedFiles.length + fileArray.length

    if (totalFiles > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`)
      return
    }

    const newPreviews: FilePreview[] = []
    const validFiles: File[] = []

    for (const file of fileArray) {
      const error = validateFile(file)
      const preview = await generatePreview(file)

      const filePreview: FilePreview = {
        id: `preview-${Date.now()}-${Math.random()}`,
        file,
        preview,
        error,
        uploading: false
      }

      newPreviews.push(filePreview)

      if (!error) {
        validFiles.push(file)
      }
    }

    setPreviews(prev => [...prev, ...newPreviews])

    if (validFiles.length > 0) {
      onFilesSelected(validFiles)
    }
  }, [previews.length, uploadedFiles.length, maxFiles, disabled, onFilesSelected, generatePreview])

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragOver(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Only set drag over to false if leaving the drop zone entirely
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (!disabled) {
      handleFiles(e.dataTransfer.files)
    }
  }, [disabled, handleFiles])

  // File input click handler
  const handleFileInputClick = () => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }

  // Remove preview file
  const removePreview = (previewId: string) => {
    setPreviews(prev => prev.filter(p => p.id !== previewId))
  }

  // Get file type icon
  const getFileIcon = (file: File | FileUpload) => {
    const fileType = 'type' in file ? file.type : file.file_type

    if (fileType.startsWith('image/')) {
      return (
        <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    } else if (fileType === 'application/pdf') {
      return (
        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return (
        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    } else {
      return (
        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    }
  }

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB'
    return Math.round(bytes / (1024 * 1024)) + ' MB'
  }

  const totalFiles = previews.length + uploadedFiles.length
  const canAddMore = totalFiles < maxFiles && !disabled

  return (
    <div className="w-full">
      {/* Drop Zone */}
      {canAddMore && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 cursor-pointer ${
            isDragOver
              ? 'border-primary bg-primary/5 scale-105'
              : disabled
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
              : 'border-gray-300 hover:border-primary hover:bg-primary/5'
          }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleFileInputClick}
        >
          <div className="flex flex-col items-center space-y-2">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="text-sm text-gray-600">
              <span className="font-medium text-primary">Click to upload</span> or drag and drop
            </div>
            <div className="text-xs text-gray-500">
              JPG, PDF, Word documents up to {FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_MB}MB
            </div>
            {totalFiles > 0 && (
              <div className="text-xs text-gray-400">
                {totalFiles}/{maxFiles} files selected
              </div>
            )}
          </div>
        </div>
      )}

      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={FILE_UPLOAD_CONFIG.ALLOWED_TYPES.join(',')}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {/* File Previews */}
      {(previews.length > 0 || uploadedFiles.length > 0) && (
        <div className="mt-4 space-y-2">
          {/* Uploaded Files */}
          {uploadedFiles.map((file) => (
            <div key={file.id} className="flex items-center space-x-3 p-3 border rounded-lg bg-green-50 border-green-200">
              <div className="flex-shrink-0">
                {file.thumbnail_url ? (
                  <img
                    src={file.thumbnail_url}
                    alt={file.original_filename}
                    className="w-10 h-10 object-cover rounded"
                  />
                ) : (
                  getFileIcon(file)
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {file.original_filename}
                </div>
                <div className="text-xs text-gray-500">
                  {formatFileSize(file.file_size)} • Uploaded
                </div>
              </div>

              <div className="flex-shrink-0 flex items-center space-x-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <button
                  onClick={() => onFileRemove(file.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors duration-200"
                  disabled={disabled}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}

          {/* Preview Files */}
          {previews.map((preview) => (
            <div key={preview.id} className={`flex items-center space-x-3 p-3 border rounded-lg ${
              preview.error ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex-shrink-0">
                {preview.preview ? (
                  <img
                    src={preview.preview}
                    alt={preview.file.name}
                    className="w-10 h-10 object-cover rounded"
                  />
                ) : (
                  getFileIcon(preview.file)
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {preview.file.name}
                </div>
                <div className="text-xs text-gray-500">
                  {formatFileSize(preview.file.size)}
                  {preview.error && <span className="text-red-500 ml-2">{preview.error}</span>}
                </div>
              </div>

              <div className="flex-shrink-0 flex items-center space-x-2">
                {preview.uploading ? (
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : preview.error ? (
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <button
                  onClick={() => removePreview(preview.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors duration-200"
                  disabled={disabled}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File Limits Info */}
      {totalFiles > 0 && (
        <div className="mt-3 text-xs text-gray-500 text-center">
          {totalFiles}/{maxFiles} files • Max {FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_MB}MB per file
        </div>
      )}
    </div>
  )
}