import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import BottomNavigation from '../BottomNavigation'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn()
}))

const mockPush = jest.fn()
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>

describe('Bottom Navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue({
      push: mockPush,
      pathname: '/home'
    } as any)
  })

  describe('Visual States and Layout', () => {
    it('should render all three navigation items', () => {
      render(<BottomNavigation />)

      expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /library/i })).toBeInTheDocument()
    })

    it('should highlight active navigation item', () => {
      render(<BottomNavigation activeTab="home" />)

      const homeButton = screen.getByRole('button', { name: /home/i })
      const chatButton = screen.getByRole('button', { name: /new chat/i })

      expect(homeButton).toHaveClass('bg-blue-100', 'text-blue-600')
      expect(chatButton).not.toHaveClass('bg-blue-100', 'text-blue-600')
    })

    it('should show appropriate icons for each section', () => {
      render(<BottomNavigation />)

      // Home icon
      expect(screen.getByTestId('home-icon')).toBeInTheDocument()

      // Owl icon for chat
      expect(screen.getByTestId('owl-icon')).toBeInTheDocument()

      // Library icon
      expect(screen.getByTestId('library-icon')).toBeInTheDocument()
    })

    it('should have minimum 44px touch targets for accessibility', () => {
      render(<BottomNavigation />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button)
        const minTouchTarget = 44 // pixels

        expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(minTouchTarget)
        expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(minTouchTarget)
      })
    })
  })

  describe('Navigation Behavior', () => {
    it('should navigate to home when home button is clicked', async () => {
      const user = userEvent.setup()
      render(<BottomNavigation activeTab="chat" />)

      const homeButton = screen.getByRole('button', { name: /home/i })
      await user.click(homeButton)

      expect(mockPush).toHaveBeenCalledWith('/')
    })

    it('should navigate to new chat when owl button is clicked', async () => {
      const user = userEvent.setup()
      render(<BottomNavigation activeTab="home" />)

      const chatButton = screen.getByRole('button', { name: /new chat/i })
      await user.click(chatButton)

      expect(mockPush).toHaveBeenCalledWith('/chat/new')
    })

    it('should navigate to library when library button is clicked', async () => {
      const user = userEvent.setup()
      render(<BottomNavigation activeTab="home" />)

      const libraryButton = screen.getByRole('button', { name: /library/i })
      await user.click(libraryButton)

      expect(mockPush).toHaveBeenCalledWith('/library')
    })

    it('should preserve state when switching tabs', async () => {
      const user = userEvent.setup()
      const mockOnTabChange = jest.fn()

      render(<BottomNavigation activeTab="home" onTabChange={mockOnTabChange} />)

      const chatButton = screen.getByRole('button', { name: /new chat/i })
      await user.click(chatButton)

      expect(mockOnTabChange).toHaveBeenCalledWith('chat')
    })

    it('should handle deep linking correctly', () => {
      mockUseRouter.mockReturnValue({
        push: mockPush,
        pathname: '/library'
      } as any)

      render(<BottomNavigation />)

      const libraryButton = screen.getByRole('button', { name: /library/i })
      expect(libraryButton).toHaveClass('bg-blue-100', 'text-blue-600')
    })
  })

  describe('Teacher-Specific Features', () => {
    it('should show new chat badge on owl icon when indicated', () => {
      render(<BottomNavigation hasNewChatBadge={true} />)

      expect(screen.getByTestId('new-chat-badge')).toBeInTheDocument()
      expect(screen.getByTestId('new-chat-badge')).toHaveClass('bg-red-500')
    })

    it('should indicate unsaved work in current session', () => {
      render(<BottomNavigation hasUnsavedWork={true} activeTab="chat" />)

      const chatButton = screen.getByRole('button', { name: /new chat/i })
      expect(chatButton).toHaveAttribute('aria-describedby', 'unsaved-work-warning')
      expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
    })

    it('should show notification dots for pending activities', () => {
      render(<BottomNavigation notifications={{ home: 2, library: 1 }} />)

      expect(screen.getByTestId('home-notification')).toHaveTextContent('2')
      expect(screen.getByTestId('library-notification')).toHaveTextContent('1')
    })
  })

  describe('Responsive Design', () => {
    it('should adapt to small screens', () => {
      // Mock small screen
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 320
      })

      render(<BottomNavigation />)

      const navigation = screen.getByRole('navigation')
      expect(navigation).toHaveClass('fixed', 'bottom-0', 'w-full')
    })

    it('should show labels on larger screens', () => {
      // Mock larger screen
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      })

      render(<BottomNavigation />)

      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('New Chat')).toBeInTheDocument()
      expect(screen.getByText('Library')).toBeInTheDocument()
    })

    it('should handle orientation changes gracefully', () => {
      render(<BottomNavigation />)

      // Simulate orientation change
      fireEvent(window, new Event('orientationchange'))

      const navigation = screen.getByRole('navigation')
      expect(navigation).toBeInTheDocument()
      expect(navigation).toHaveClass('flex')
    })
  })

  describe('Accessibility Features', () => {
    it('should have proper ARIA labels for screen readers', () => {
      render(<BottomNavigation activeTab="home" />)

      const homeButton = screen.getByRole('button', { name: /home/i })
      expect(homeButton).toHaveAttribute('aria-current', 'page')

      const chatButton = screen.getByRole('button', { name: /new chat/i })
      expect(chatButton).toHaveAttribute('aria-label', 'Start new chat conversation')
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<BottomNavigation />)

      const homeButton = screen.getByRole('button', { name: /home/i })

      // Tab to navigate
      await user.tab()
      expect(homeButton).toHaveFocus()

      // Enter to activate
      await user.keyboard('{Enter}')
      expect(mockPush).toHaveBeenCalledWith('/')
    })

    it('should announce state changes to screen readers', async () => {
      const user = userEvent.setup()
      render(<BottomNavigation activeTab="home" />)

      const chatButton = screen.getByRole('button', { name: /new chat/i })
      await user.click(chatButton)

      await waitFor(() => {
        expect(chatButton).toHaveAttribute('aria-current', 'page')
      })
    })

    it('should have appropriate focus indicators', () => {
      render(<BottomNavigation />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-blue-500')
      })
    })
  })

  describe('Performance and Interaction', () => {
    it('should handle rapid tab switching without issues', async () => {
      const user = userEvent.setup()
      render(<BottomNavigation />)

      const homeButton = screen.getByRole('button', { name: /home/i })
      const chatButton = screen.getByRole('button', { name: /new chat/i })
      const libraryButton = screen.getByRole('button', { name: /library/i })

      // Rapid clicks
      await user.click(homeButton)
      await user.click(chatButton)
      await user.click(libraryButton)
      await user.click(homeButton)

      expect(mockPush).toHaveBeenCalledTimes(4)
    })

    it('should debounce navigation calls', async () => {
      const user = userEvent.setup()
      render(<BottomNavigation />)

      const chatButton = screen.getByRole('button', { name: /new chat/i })

      // Multiple rapid clicks
      await user.click(chatButton)
      await user.click(chatButton)
      await user.click(chatButton)

      // Should only navigate once due to debouncing
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledTimes(1)
      })
    })

    it('should maintain performance with many notification updates', () => {
      const { rerender } = render(<BottomNavigation notifications={{ home: 1 }} />)

      // Simulate many rapid notification updates
      for (let i = 2; i <= 100; i++) {
        rerender(<BottomNavigation notifications={{ home: i }} />)
      }

      expect(screen.getByTestId('home-notification')).toHaveTextContent('100')
    })
  })

  describe('Error Handling', () => {
    it('should handle navigation errors gracefully', async () => {
      const user = userEvent.setup()
      mockPush.mockRejectedValue(new Error('Navigation failed'))

      render(<BottomNavigation />)

      const homeButton = screen.getByRole('button', { name: /home/i })
      await user.click(homeButton)

      // Should not crash the component
      expect(homeButton).toBeInTheDocument()
    })

    it('should fallback to default state when props are invalid', () => {
      // @ts-ignore - Testing invalid props
      render(<BottomNavigation activeTab="invalid-tab" />)

      // Should render without crashing
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })

    it('should handle missing router gracefully', () => {
      mockUseRouter.mockReturnValue(null as any)

      render(<BottomNavigation />)

      // Should still render the navigation
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })
  })

  describe('Teacher Workflow Integration', () => {
    it('should integrate with lesson planning workflow', async () => {
      const user = userEvent.setup()
      render(<BottomNavigation
        activeTab="home"
        workflowContext="lesson-planning"
        onWorkflowContinue={jest.fn()}
      />)

      const chatButton = screen.getByRole('button', { name: /new chat/i })
      await user.click(chatButton)

      expect(mockPush).toHaveBeenCalledWith('/chat/new?context=lesson-planning')
    })

    it('should show contextual hints for teachers', () => {
      render(<BottomNavigation
        activeTab="home"
        showTeacherHints={true}
        teacherLevel="beginner"
      />)

      expect(screen.getByText(/start a conversation with ai/i)).toBeInTheDocument()
      expect(screen.getByText(/save your teaching materials/i)).toBeInTheDocument()
    })
  })
})