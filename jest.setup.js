import '@testing-library/jest-dom'

// Mock IntersectionObserver for components that might use it
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock ResizeObserver for responsive components
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock window.matchMedia for responsive design tests (only in jsdom environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Mock window.scrollTo for tests (only in jsdom environment)
if (typeof global.scrollTo === 'undefined') {
  global.scrollTo = jest.fn()
}

// Suppress console.log in tests unless VERBOSE_TESTS is set
if (!process.env.VERBOSE_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  }
}

// Mock Service Worker for PWA tests (only in browser environment)
if (typeof navigator !== 'undefined' && navigator) {
  global.navigator.serviceWorker = {
    register: jest.fn(() => Promise.resolve()),
    ready: Promise.resolve({
      unregister: jest.fn(() => Promise.resolve()),
    }),
  }
}

// Set up fake timers by default (can be overridden in individual tests)
beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
})

// Clean up mocks after each test
afterEach(() => {
  jest.clearAllMocks()
})