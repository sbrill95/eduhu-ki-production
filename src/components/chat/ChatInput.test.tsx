import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatInput from './ChatInput'

// Mock FileUploadComponent
jest.mock('./FileUpload', () => {
  return function FileUploadComponent({ onFilesSelected, onFileRemove, uploadedFiles }: any) {
    return (
      <div data-testid="file-upload">
        <button
          onClick={() => onFilesSelected([new File(['content'], 'test.pdf', { type: 'application/pdf' })])}
          data-testid="mock-file-select"
        >
          Select Files
        </button>
        <button
          onClick={() => onFileRemove('file-123')}
          data-testid="mock-file-remove"
        >
          Remove File
        </button>
        {uploadedFiles.length > 0 && (
          <div data-testid="uploaded-files-count">{uploadedFiles.length}</div>
        )}
      </div>
    )
  }
})

jest.mock('@/lib/instant', () => ({
  FileUpload: {
    id: 'string',
    filename: 'string',
    file_path: 'string'
  }
}))

describe('ChatInput Component', () => {
  const mockOnSendMessage = jest.fn()

  const defaultProps = {
    onSendMessage: mockOnSendMessage,
    disabled: false
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render chat input textarea', () => {
    render(<ChatInput {...defaultProps} />)

    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('should handle text input', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Hello world')

    expect(textarea).toHaveValue('Hello world')
  })

  it('should send message on button click', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    const textarea = screen.getByRole('textbox')
    const sendButton = screen.getByRole('button', { name: /send/i })

    await user.type(textarea, 'Test message')
    await user.click(sendButton)

    expect(mockOnSendMessage).toHaveBeenCalledWith('Test message', undefined)
    expect(textarea).toHaveValue('')
  })

  it('should send message on Enter key', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    const textarea = screen.getByRole('textbox')

    await user.type(textarea, 'Test message')
    await user.keyboard('{Enter}')

    expect(mockOnSendMessage).toHaveBeenCalledWith('Test message', undefined)
    expect(textarea).toHaveValue('')
  })

  it('should not send message on Shift+Enter', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    const textarea = screen.getByRole('textbox')

    await user.type(textarea, 'Line 1')
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    await user.type(textarea, 'Line 2')

    expect(mockOnSendMessage).not.toHaveBeenCalled()
    expect(textarea).toHaveValue('Line 1\nLine 2')
  })

  it('should not send empty message', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    const sendButton = screen.getByRole('button', { name: /send/i })
    await user.click(sendButton)

    expect(mockOnSendMessage).not.toHaveBeenCalled()
  })

  it('should not send whitespace-only message', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    const textarea = screen.getByRole('textbox')
    const sendButton = screen.getByRole('button', { name: /send/i })

    await user.type(textarea, '   ')
    await user.click(sendButton)

    expect(mockOnSendMessage).not.toHaveBeenCalled()
  })

  it('should show file upload when attach button is clicked', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    const attachButton = screen.getByRole('button', { name: /attach/i })
    await user.click(attachButton)

    expect(screen.getByTestId('file-upload')).toBeInTheDocument()
  })

  it('should handle file selection', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    // Show file upload
    const attachButton = screen.getByRole('button', { name: /attach/i })
    await user.click(attachButton)

    // Select files
    const selectButton = screen.getByTestId('mock-file-select')
    await user.click(selectButton)

    // Should show attached files indicator
    await waitFor(() => {
      expect(screen.getByText('1 file attached')).toBeInTheDocument()
    })
  })

  it('should send message with file attachments', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    const textarea = screen.getByRole('textbox')

    // Show file upload and select files
    const attachButton = screen.getByRole('button', { name: /attach/i })
    await user.click(attachButton)

    const selectButton = screen.getByTestId('mock-file-select')
    await user.click(selectButton)

    // Type message and send
    await user.type(textarea, 'Message with file')
    const sendButton = screen.getByRole('button', { name: /send/i })
    await user.click(sendButton)

    expect(mockOnSendMessage).toHaveBeenCalledWith(
      'Message with file',
      expect.arrayContaining([expect.any(File)])
    )
  })

  it('should send files without message', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    // Show file upload and select files
    const attachButton = screen.getByRole('button', { name: /attach/i })
    await user.click(attachButton)

    const selectButton = screen.getByTestId('mock-file-select')
    await user.click(selectButton)

    // Send without typing message
    const sendButton = screen.getByRole('button', { name: /send/i })
    await user.click(sendButton)

    expect(mockOnSendMessage).toHaveBeenCalledWith(
      '',
      expect.arrayContaining([expect.any(File)])
    )
  })

  it('should handle file removal', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    // Show file upload and select files
    const attachButton = screen.getByRole('button', { name: /attach/i })
    await user.click(attachButton)

    const selectButton = screen.getByTestId('mock-file-select')
    await user.click(selectButton)

    // Remove file
    const removeButton = screen.getByTestId('mock-file-remove')
    await user.click(removeButton)

    // File count should be updated
    await waitFor(() => {
      expect(screen.queryByText('1 file attached')).not.toBeInTheDocument()
    })
  })

  it('should be disabled when disabled prop is true', () => {
    render(<ChatInput {...defaultProps} disabled={true} />)

    const textarea = screen.getByRole('textbox')
    const sendButton = screen.getByRole('button', { name: /send/i })

    expect(textarea).toBeDisabled()
    expect(sendButton).toBeDisabled()
  })

  it('should not send message when disabled', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} disabled={true} />)

    const textarea = screen.getByRole('textbox')

    // Try to type (should not work)
    await user.type(textarea, 'Test message')
    await user.keyboard('{Enter}')

    expect(mockOnSendMessage).not.toHaveBeenCalled()
  })

  it('should clear files after sending', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    // Show file upload and select files
    const attachButton = screen.getByRole('button', { name: /attach/i })
    await user.click(attachButton)

    const selectButton = screen.getByTestId('mock-file-select')
    await user.click(selectButton)

    // Send message
    const sendButton = screen.getByRole('button', { name: /send/i })
    await user.click(sendButton)

    // Files should be cleared
    await waitFor(() => {
      expect(screen.queryByText('1 file attached')).not.toBeInTheDocument()
    })
  })

  it('should hide file upload after sending', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    // Show file upload
    const attachButton = screen.getByRole('button', { name: /attach/i })
    await user.click(attachButton)

    expect(screen.getByTestId('file-upload')).toBeInTheDocument()

    // Send empty message (should hide file upload)
    const selectButton = screen.getByTestId('mock-file-select')
    await user.click(selectButton)

    const sendButton = screen.getByRole('button', { name: /send/i })
    await user.click(sendButton)

    await waitFor(() => {
      expect(screen.queryByTestId('file-upload')).not.toBeInTheDocument()
    })
  })

  it('should handle multiple file attachments', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    // Show file upload
    const attachButton = screen.getByRole('button', { name: /attach/i })
    await user.click(attachButton)

    // Select files multiple times
    const selectButton = screen.getByTestId('mock-file-select')
    await user.click(selectButton)
    await user.click(selectButton)

    await waitFor(() => {
      expect(screen.getByText('2 files attached')).toBeInTheDocument()
    })
  })

  it('should auto-resize textarea', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

    // Type multiple lines
    await user.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2{Shift>}{Enter}{/Shift}Line 3')

    // Textarea should expand (scrollHeight changes)
    expect(textarea.scrollHeight).toBeGreaterThan(textarea.clientHeight)
  })

  it('should focus textarea on mount', () => {
    render(<ChatInput {...defaultProps} />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveFocus()
  })

  it('should handle paste events', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    const textarea = screen.getByRole('textbox')

    // Simulate paste
    await user.click(textarea)
    await user.paste('Pasted text')

    expect(textarea).toHaveValue('Pasted text')
  })

  it('should show character count for long messages', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    const textarea = screen.getByRole('textbox')
    const longMessage = 'a'.repeat(1000)

    await user.type(textarea, longMessage)

    expect(screen.getByText(/1000 characters/i)).toBeInTheDocument()
  })

  it('should prevent message sending over character limit', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    const textarea = screen.getByRole('textbox')
    const veryLongMessage = 'a'.repeat(5000) // Assuming 4000 is the limit

    await user.type(textarea, veryLongMessage)

    const sendButton = screen.getByRole('button', { name: /send/i })
    await user.click(sendButton)

    expect(mockOnSendMessage).not.toHaveBeenCalled()
    expect(screen.getByText(/Message too long/i)).toBeInTheDocument()
  })
})