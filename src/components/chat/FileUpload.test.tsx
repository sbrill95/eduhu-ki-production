import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FileUploadComponent from './FileUpload'

// Mock dependencies
jest.mock('@/lib/instant', () => ({
  FILE_UPLOAD_CONFIG: {
    MAX_FILE_SIZE_MB: 50,
    ALLOWED_TYPES: [
      'image/*',
      'application/pdf',
      'text/*',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  },
  FileUpload: {
    id: 'string',
    filename: 'string',
    file_path: 'string'
  }
}))

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = jest.fn()

describe('FileUpload Component', () => {
  const mockOnFilesSelected = jest.fn()
  const mockOnFileRemove = jest.fn()

  const defaultProps = {
    onFilesSelected: mockOnFilesSelected,
    onFileRemove: mockOnFileRemove,
    uploadedFiles: [],
    disabled: false,
    maxFiles: 10
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render file upload area', () => {
    render(<FileUploadComponent {...defaultProps} />)

    expect(screen.getByText(/Drag and drop files here/i)).toBeInTheDocument()
    expect(screen.getByText(/or click to browse/i)).toBeInTheDocument()
  })

  it('should handle file selection through input', async () => {
    const user = userEvent.setup()
    render(<FileUploadComponent {...defaultProps} />)

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    const fileInput = screen.getByRole('button', { name: /or click to browse/i })

    // Trigger file input click
    await user.click(fileInput)

    // Mock file input change
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (hiddenInput) {
      Object.defineProperty(hiddenInput, 'files', {
        value: [file],
        writable: false,
      })
      fireEvent.change(hiddenInput)
    }

    await waitFor(() => {
      expect(mockOnFilesSelected).toHaveBeenCalledWith([file])
    })
  })

  it('should handle drag and drop', async () => {
    render(<FileUploadComponent {...defaultProps} />)

    const dropArea = screen.getByText(/Drag and drop files here/i).parentElement

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    const dataTransfer = {
      files: [file],
      items: [file],
      types: ['Files']
    }

    // Test drag enter
    fireEvent.dragEnter(dropArea!, { dataTransfer })
    expect(dropArea).toHaveClass('border-blue-400') // Drag over styling

    // Test drag leave
    fireEvent.dragLeave(dropArea!, { dataTransfer })

    // Test drop
    fireEvent.drop(dropArea!, { dataTransfer })

    await waitFor(() => {
      expect(mockOnFilesSelected).toHaveBeenCalledWith([file])
    })
  })

  it('should validate file size', async () => {
    const user = userEvent.setup()
    render(<FileUploadComponent {...defaultProps} />)

    // Create a file that exceeds the size limit (51MB)
    const largeFile = new File(['x'.repeat(51 * 1024 * 1024)], 'large.pdf', {
      type: 'application/pdf'
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: [largeFile],
      writable: false,
    })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText(/File size exceeds 50MB limit/i)).toBeInTheDocument()
    })
  })

  it('should validate file type', async () => {
    render(<FileUploadComponent {...defaultProps} />)

    const invalidFile = new File(['test'], 'test.exe', { type: 'application/x-executable' })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: [invalidFile],
      writable: false,
    })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText(/File type not supported/i)).toBeInTheDocument()
    })
  })

  it('should show file previews', async () => {
    render(<FileUploadComponent {...defaultProps} />)

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
    })
  })

  it('should generate image previews for image files', async () => {
    render(<FileUploadComponent {...defaultProps} />)

    const imageFile = new File(['image content'], 'test.jpg', { type: 'image/jpeg' })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: [imageFile],
      writable: false,
    })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('test.jpg')).toBeInTheDocument()
      // Should generate preview URL for images
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(imageFile)
    })
  })

  it('should remove file previews', async () => {
    const user = userEvent.setup()
    render(<FileUploadComponent {...defaultProps} />)

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
    })

    const removeButton = screen.getByRole('button', { name: /remove/i })
    await user.click(removeButton)

    await waitFor(() => {
      expect(screen.queryByText('test.pdf')).not.toBeInTheDocument()
    })
  })

  it('should display uploaded files', () => {
    const uploadedFiles = [
      {
        id: 'file1',
        filename: 'uploaded.pdf',
        file_path: '/uploads/uploaded.pdf',
        created_at: Date.now()
      }
    ]

    render(<FileUploadComponent {...defaultProps} uploadedFiles={uploadedFiles} />)

    expect(screen.getByText('uploaded.pdf')).toBeInTheDocument()
  })

  it('should handle removing uploaded files', async () => {
    const user = userEvent.setup()
    const uploadedFiles = [
      {
        id: 'file1',
        filename: 'uploaded.pdf',
        file_path: '/uploads/uploaded.pdf',
        created_at: Date.now()
      }
    ]

    render(<FileUploadComponent {...defaultProps} uploadedFiles={uploadedFiles} />)

    const removeButton = screen.getByRole('button', { name: /remove uploaded file/i })
    await user.click(removeButton)

    expect(mockOnFileRemove).toHaveBeenCalledWith('file1')
  })

  it('should respect max files limit', async () => {
    render(<FileUploadComponent {...defaultProps} maxFiles={2} />)

    const files = [
      new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
      new File(['content2'], 'file2.pdf', { type: 'application/pdf' }),
      new File(['content3'], 'file3.pdf', { type: 'application/pdf' })
    ]

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: files,
      writable: false,
    })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText(/Maximum 2 files allowed/i)).toBeInTheDocument()
    })
  })

  it('should be disabled when disabled prop is true', () => {
    render(<FileUploadComponent {...defaultProps} disabled={true} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeDisabled()
  })

  it('should show upload progress', async () => {
    render(<FileUploadComponent {...defaultProps} />)

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })

    // Mock a file with upload progress
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
    })

    // Progress bar should be shown during upload
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('should handle multiple file selection', async () => {
    render(<FileUploadComponent {...defaultProps} />)

    const files = [
      new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
      new File(['content2'], 'file2.txt', { type: 'text/plain' })
    ]

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: files,
      writable: false,
    })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(mockOnFilesSelected).toHaveBeenCalledWith(files)
    })
  })

  it('should prevent default drag events', () => {
    render(<FileUploadComponent {...defaultProps} />)

    const dropArea = screen.getByText(/Drag and drop files here/i).parentElement

    const dragEvent = new Event('dragover', { bubbles: true })
    const preventDefaultSpy = jest.spyOn(dragEvent, 'preventDefault')

    fireEvent(dropArea!, dragEvent)

    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('should handle file read errors gracefully', async () => {
    // Mock FileReader to simulate error
    const mockFileReader = {
      readAsDataURL: jest.fn(),
      result: null,
      error: new Error('File read error'),
      onload: null,
      onerror: null
    }

    global.FileReader = jest.fn(() => mockFileReader) as any

    render(<FileUploadComponent {...defaultProps} />)

    const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    })
    fireEvent.change(fileInput)

    // Simulate error
    if (mockFileReader.onerror) {
      mockFileReader.onerror(new ProgressEvent('error'))
    }

    await waitFor(() => {
      expect(screen.getByText(/Error reading file/i)).toBeInTheDocument()
    })
  })

  it('should display file icons based on file type', async () => {
    render(<FileUploadComponent {...defaultProps} />)

    const files = [
      new File(['content'], 'document.pdf', { type: 'application/pdf' }),
      new File(['content'], 'image.jpg', { type: 'image/jpeg' }),
      new File(['content'], 'text.txt', { type: 'text/plain' })
    ]

    for (const file of files) {
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText(file.name)).toBeInTheDocument()
      })
    }
  })
})