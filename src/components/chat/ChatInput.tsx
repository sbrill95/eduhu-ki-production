'use client'

import { useState, KeyboardEvent } from 'react'
import FileUploadComponent from './FileUpload'
import { FileUpload } from '@/lib/instant'

interface ChatInputProps {
  onSendMessage: (content: string, files?: File[]) => void
  disabled?: boolean
}

export default function ChatInput({ onSendMessage, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<FileUpload[]>([])

  const handleSubmit = () => {
    if ((!message.trim() && attachedFiles.length === 0) || disabled) return

    onSendMessage(message.trim(), attachedFiles.length > 0 ? attachedFiles : undefined)
    setMessage('')
    setAttachedFiles([])
    setUploadedFiles([])
    setShowFileUpload(false)
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleFilesSelected = (files: File[]) => {
    setAttachedFiles(prev => [...prev, ...files])
  }

  const handleFileRemove = (fileId: string) => {
    // For attached files (not yet uploaded), remove by index
    if (fileId.startsWith('preview-')) {
      const index = attachedFiles.findIndex((_, i) => `preview-${i}` === fileId)
      if (index >= 0) {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index))
      }
    } else {
      // For uploaded files, remove by ID
      setUploadedFiles(prev => prev.filter(file => file.id !== fileId))
    }
  }

  const hasContent = message.trim() || attachedFiles.length > 0
  const totalFiles = attachedFiles.length + uploadedFiles.length

  return (
    <div className="border-t border-gray-200 bg-white">
      {/* File Upload Section */}
      {showFileUpload && (
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Attach Files</h3>
            <button
              onClick={() => setShowFileUpload(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              disabled={disabled}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <FileUploadComponent
            onFilesSelected={handleFilesSelected}
            onFileRemove={handleFileRemove}
            uploadedFiles={uploadedFiles}
            disabled={disabled}
            maxFiles={5}
          />
        </div>
      )}

      {/* Main Input Section */}
      <div className="p-4">
        {/* Attached Files Preview */}
        {totalFiles > 0 && (
          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="text-sm text-blue-700">
                  {totalFiles} file{totalFiles !== 1 ? 's' : ''} attached
                </span>
              </div>
              <button
                onClick={() => {
                  setAttachedFiles([])
                  setUploadedFiles([])
                }}
                className="text-blue-400 hover:text-blue-600 transition-colors duration-200"
                disabled={disabled}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Input Row */}
        <div className="flex gap-2 items-end">
          {/* File Attachment Button */}
          <button
            onClick={() => setShowFileUpload(!showFileUpload)}
            disabled={disabled}
            className={`p-3 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              disabled
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : showFileUpload
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
            }`}
            title="Attach files"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          {/* Text Input */}
          <div className="flex-1">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={disabled ? "AI is responding..." : "Ask a question about teaching..."}
              className={`w-full resize-none border rounded-lg px-4 py-3 text-sm max-h-32 transition-all duration-200 ${
                disabled
                  ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'
                  : 'border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent hover:border-gray-400'
              }`}
              rows={1}
              disabled={disabled}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleSubmit}
            disabled={!hasContent || disabled}
            className={`p-3 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              !hasContent || disabled
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-primary-dark hover:scale-105 active:scale-95'
            }`}
          >
            {disabled ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Help Text */}
        <p className="text-xs text-gray-500 mt-2">
          {disabled
            ? "Please wait while the AI is responding..."
            : "Press Enter to send, Shift+Enter for new line. Click attachment button to add files."
          }
        </p>
      </div>
    </div>
  )
}