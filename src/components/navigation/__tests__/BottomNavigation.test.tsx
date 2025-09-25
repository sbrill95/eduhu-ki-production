import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter, usePathname } from 'next/navigation'
import BottomNavigation from '../BottomNavigation'

// Mock Next.js navigation hooks
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn()
}))

const mockPush = jest.fn()
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>

describe('Bottom Navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers() // Use real timers for this component
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn()
    } as any)
    mockUsePathname.mockReturnValue('/')
  })

  afterEach(() => {
    jest.useFakeTimers() // Restore fake timers after each test
  })

  describe('Visual States and Layout', () => {
    it('should render all three navigation items', () => {
      render(<BottomNavigation />)

      expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /library/i })).toBeInTheDocument()
    })

    it('should highlight active navigation item based on pathname', () => {
      mockUsePathname.mockReturnValue('/')
      render(<BottomNavigation />)

      const homeButton = screen.getByRole('button', { name: /home/i })
      const chatButton = screen.getByRole('button', { name: /new chat/i })

      expect(homeButton).toHaveClass('text-primary')
      expect(chatButton).toHaveClass('text-gray-500')
    })

    it('should show appropriate icons for each section', () => {
      render(<BottomNavigation />)

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(3)

      // Each button should have an SVG icon
      buttons.forEach(button => {
        expect(button.querySelector('svg')).toBeInTheDocument()
      })
    })

    it('should have minimum 44px touch targets for accessibility', () => {
      render(<BottomNavigation />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveClass('p-2')
        expect(button).toHaveClass('flex-1')
      })
    })
  })

  describe('Navigation Behavior', () => {
    it('should navigate to home when home button is clicked', async () => {
      const user = userEvent.setup({ delay: null })
      render(<BottomNavigation />)

      const homeButton = screen.getByRole('button', { name: /home/i })
      await user.click(homeButton)

      expect(mockPush).toHaveBeenCalledWith('/')
    })

    it('should generate new chat session when chat button is clicked', async () => {
      const user = userEvent.setup({ delay: null })
      render(<BottomNavigation />)

      const chatButton = screen.getByRole('button', { name: /new chat/i })
      await user.click(chatButton)

      expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/chat\/.+/))
    })

    it('should navigate to library when library button is clicked', async () => {
      const user = userEvent.setup({ delay: null })
      render(<BottomNavigation />)

      const libraryButton = screen.getByRole('button', { name: /library/i })
      await user.click(libraryButton)

      expect(mockPush).toHaveBeenCalledWith('/library')
    })

    it('should handle deep linking correctly', () => {
      mockUsePathname.mockReturnValue('/chat/some-session-id')
      render(<BottomNavigation />)

      const chatButton = screen.getByRole('button', { name: /new chat/i })
      expect(chatButton).toHaveClass('text-primary')
    })
  })

  describe('Responsive Design', () => {
    it('should show labels on all screen sizes', () => {
      render(<BottomNavigation />)

      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('New Chat')).toBeInTheDocument()
      expect(screen.getByText('Library')).toBeInTheDocument()
    })
  })

  describe('Accessibility Features', () => {
    it('should have proper ARIA labels for screen readers', () => {
      render(<BottomNavigation />)

      expect(screen.getByRole('button', { name: /home/i })).toHaveAttribute('aria-label', 'Home')
      expect(screen.getByRole('button', { name: /new chat/i })).toHaveAttribute('aria-label', 'New Chat')
      expect(screen.getByRole('button', { name: /library/i })).toHaveAttribute('aria-label', 'Library')
    })
  })

  describe('Error Handling', () => {
    it('should fallback to default state when pathname is undefined', () => {
      mockUsePathname.mockReturnValue(undefined as any)
      
      expect(() => render(<BottomNavigation />)).not.toThrow()
      
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveClass('text-gray-500')
      })
    })

    it('should handle missing router gracefully', () => {
      mockUseRouter.mockReturnValue(undefined as any)
      
      expect(() => render(<BottomNavigation />)).not.toThrow()
    })
  })

  describe('Teacher Workflow Integration', () => {
    it('should provide clear navigation between core teacher functions', () => {
      render(<BottomNavigation />)

      // Should provide access to main teacher workflows
      expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument() 
      expect(screen.getByRole('button', { name: /library/i })).toBeInTheDocument()
    })

    it('should maintain context across navigation', async () => {
      const user = userEvent.setup({ delay: null })
      render(<BottomNavigation />)

      const chatButton = screen.getByRole('button', { name: /new chat/i })
      await user.click(chatButton)

      // Should create new chat session with UUID
      expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/chat\/[0-9a-f-]{36}$/))
    })
  })
})
