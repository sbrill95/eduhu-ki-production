/**
 * Performance Quality Gates for eduhu.ki
 * Tests Core Web Vitals and educational-specific performance requirements
 * Ensures optimal performance for teacher workflows on various devices
 */

import { test, expect, type Page } from '@playwright/test'

// Performance thresholds based on Google's Core Web Vitals
const PERFORMANCE_THRESHOLDS = {
  // Core Web Vitals - "Good" thresholds
  LCP: 2500, // Largest Contentful Paint (ms)
  FID: 100,  // First Input Delay (ms)
  CLS: 0.1,  // Cumulative Layout Shift (score)

  // Additional performance metrics for educational apps
  TTI: 3500, // Time to Interactive (ms)
  TTFB: 800, // Time to First Byte (ms)
  FCP: 1800, // First Contentful Paint (ms)

  // Teacher-specific requirements
  CHAT_RESPONSE_TIME: 2000, // Maximum acceptable AI response time (ms)
  MESSAGE_LOAD_TIME: 1000,  // Time to load message history (ms)
  PWA_INSTALL_TIME: 1500,   // PWA installation process time (ms)
}

test.describe('Core Web Vitals Performance', () => {
  test('Initial page load meets Core Web Vitals thresholds @performance', async ({ page }) => {
    // Enable performance metrics collection
    await page.addInitScript(() => {
      // Inject performance observer
      window.performanceMetrics = {
        lcp: 0,
        fid: 0,
        cls: 0,
        fcp: 0,
        ttfb: 0
      }

      // LCP Observer
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          window.performanceMetrics.lcp = entry.startTime
        }
      }).observe({ entryTypes: ['largest-contentful-paint'] })

      // FID Observer
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          window.performanceMetrics.fid = entry.processingStart - entry.startTime
        }
      }).observe({ entryTypes: ['first-input'] })

      // CLS Observer
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!entry.hadRecentInput) {
            window.performanceMetrics.cls += entry.value
          }
        }
      }).observe({ entryTypes: ['layout-shift'] })

      // FCP Observer
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            window.performanceMetrics.fcp = entry.startTime
          }
        }
      }).observe({ entryTypes: ['paint'] })
    })

    const startTime = Date.now()

    // Navigate to chat page
    await page.goto('/chat')

    // Wait for page to be fully interactive
    await page.waitForLoadState('networkidle')

    // Ensure main content is visible (LCP measurement)
    await expect(page.getByText('Teacher AI Assistant')).toBeVisible()
    await expect(page.getByText('Welcome to eduhu.ki!')).toBeVisible()

    // Interact with page to trigger FID measurement
    await page.getByPlaceholder(/Ask about lesson plans/).click()

    // Wait for metrics to be collected
    await page.waitForTimeout(2000)

    // Collect performance metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return {
        ...window.performanceMetrics,
        ttfb: navigation.responseStart - navigation.requestStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
        loadComplete: navigation.loadEventEnd - navigation.navigationStart
      }
    })

    // Assert Core Web Vitals thresholds
    console.log('Performance Metrics:', metrics)

    // Largest Contentful Paint - Critical for teacher perceived performance
    expect(metrics.lcp).toBeLessThan(PERFORMANCE_THRESHOLDS.LCP)

    // First Contentful Paint - Initial visual feedback
    expect(metrics.fcp).toBeLessThan(PERFORMANCE_THRESHOLDS.FCP)

    // Time to First Byte - Server response time
    expect(metrics.ttfb).toBeLessThan(PERFORMANCE_THRESHOLDS.TTFB)

    // Cumulative Layout Shift - Visual stability during loading
    expect(metrics.cls).toBeLessThan(PERFORMANCE_THRESHOLDS.CLS)

    // DOM Content Loaded - Basic interactivity
    expect(metrics.domContentLoaded).toBeLessThan(3000)
  })

  test('Mobile performance meets teacher requirements @performance', async ({ page }) => {
    // Simulate typical teacher mobile device (mid-range smartphone)
    await page.emulate({
      viewport: { width: 375, height: 667 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
    })

    // Simulate slower mobile network (teacher in classroom with poor WiFi)
    const client = await page.context().newCDPSession(page)
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 1.5 * 1024 * 1024 / 8, // 1.5 Mbps
      uploadThroughput: 750 * 1024 / 8, // 750 Kbps
      latency: 40 // 40ms latency
    })

    const startTime = Date.now()

    await page.goto('/chat')
    await page.waitForLoadState('networkidle')

    const loadTime = Date.now() - startTime

    // Mobile load time should be reasonable even on slower networks
    expect(loadTime).toBeLessThan(5000) // 5 seconds max for mobile

    // Verify mobile interface is responsive
    await expect(page.getByText('Teacher AI Assistant')).toBeVisible()
    await expect(page.getByPlaceholder(/Ask about lesson plans/)).toBeVisible()

    // Test mobile interaction performance
    const interactionStartTime = Date.now()
    await page.getByPlaceholder(/Ask about lesson plans/).fill('Test message')
    await page.getByRole('button', { name: /send/i }).click()

    const interactionTime = Date.now() - interactionStartTime
    expect(interactionTime).toBeLessThan(500) // UI should be responsive
  })
})

test.describe('Teacher Workflow Performance', () => {
  test('Chat response time meets educational standards @performance', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForLoadState('networkidle')

    // Mock AI response to control timing
    await page.route('/api/chat', async route => {
      // Simulate typical OpenAI response time
      await new Promise(resolve => setTimeout(resolve, 800))

      const mockStream = `
data: {"type": "content", "content": "Here are some effective teaching strategies for "}

data: {"type": "content", "content": "engaging your students in mathematics: "}

data: {"type": "content", "content": "1. Use manipulatives and visual aids to make abstract concepts concrete. "}

data: {"type": "content", "content": "2. Incorporate real-world problem solving that connects to students' lives. "}

data: {"type": "content", "content": "3. Implement collaborative learning activities and group work."}

data: {"type": "done"}
`

      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Transfer-Encoding': 'chunked'
        },
        body: mockStream
      })
    })

    const teacherQuestion = "How can I make my math lessons more engaging for middle school students?"

    const responseStartTime = Date.now()

    await page.getByPlaceholder(/Ask about lesson plans/).fill(teacherQuestion)
    await page.getByRole('button', { name: /send/i }).click()

    // Wait for AI response to complete
    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 10000 })

    const responseEndTime = Date.now()
    const totalResponseTime = responseEndTime - responseStartTime

    // Total response time (including UI updates) should be acceptable for teachers
    expect(totalResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CHAT_RESPONSE_TIME)

    console.log(`Chat response completed in ${totalResponseTime}ms`)

    // Verify response content appeared correctly
    const response = page.locator('[data-testid="assistant-message"]')
    await expect(response).toContainText('teaching strategies')
    await expect(response).toContainText('engaging')
  })

  test('Message history loads quickly for returning teachers @performance', async ({ page }) => {
    await page.goto('/chat')

    // Simulate a teacher with existing chat history
    // First, create some message history by mocking the database response
    await page.evaluate(() => {
      // Mock existing messages in localStorage or session storage
      const mockMessages = Array.from({ length: 25 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Test message ${i + 1} about lesson planning and teaching strategies`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        timestamp: Date.now() - (25 - i) * 60000 // Spread over last 25 minutes
      }))

      window.mockChatHistory = mockMessages
    })

    const loadStartTime = Date.now()

    // Refresh to trigger message loading
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Wait for messages to appear
    await page.waitForSelector('[data-testid="user-message"], [data-testid="assistant-message"]',
      { timeout: 5000 })

    const loadEndTime = Date.now()
    const historyLoadTime = loadEndTime - loadStartTime

    // Message history should load quickly for smooth teacher experience
    expect(historyLoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MESSAGE_LOAD_TIME)

    console.log(`Message history loaded in ${historyLoadTime}ms`)
  })

  test('Large conversation performance remains acceptable @performance', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForLoadState('networkidle')

    // Mock API to return immediate responses for bulk testing
    await page.route('/api/chat', route => {
      const response = `data: {"type": "content", "content": "Quick response for performance testing."}\n\ndata: {"type": "done"}`
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: response
      })
    })

    // Send multiple messages to simulate a long tutoring session
    const messageCount = 10
    const performanceResults = []

    for (let i = 1; i <= messageCount; i++) {
      const startTime = Date.now()

      await page.getByPlaceholder(/Ask about lesson plans/).fill(`Message ${i}: Teaching question`)
      await page.getByRole('button', { name: /send/i }).click()

      await page.waitForSelector(`[data-testid="assistant-message"]:nth-of-type(${i})`,
        { timeout: 5000 })

      const endTime = Date.now()
      performanceResults.push(endTime - startTime)
    }

    // Performance should not degrade significantly with conversation length
    const averageTime = performanceResults.reduce((a, b) => a + b, 0) / performanceResults.length
    const maxTime = Math.max(...performanceResults)

    expect(averageTime).toBeLessThan(1500) // Average should stay reasonable
    expect(maxTime).toBeLessThan(3000)     // No individual response should be too slow

    console.log(`Average response time across ${messageCount} messages: ${averageTime.toFixed(2)}ms`)
    console.log(`Maximum response time: ${maxTime}ms`)

    // UI should remain responsive
    const messageElements = await page.locator('[data-testid="user-message"], [data-testid="assistant-message"]').count()
    expect(messageElements).toBe(messageCount * 2) // User + AI messages
  })
})

test.describe('PWA Performance Requirements', () => {
  test('PWA installation process is performant @performance', async ({ page, context }) => {
    await page.goto('/chat')
    await page.waitForLoadState('networkidle')

    // Check if PWA can be installed (service worker registered)
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready
          return !!registration
        } catch (error) {
          return false
        }
      }
      return false
    })

    expect(swRegistered).toBe(true)

    // Verify PWA manifest loads quickly
    const manifestStartTime = Date.now()

    const manifestResponse = await page.request.get('/manifest.json')
    expect(manifestResponse.status()).toBe(200)

    const manifestLoadTime = Date.now() - manifestStartTime
    expect(manifestLoadTime).toBeLessThan(500) // Manifest should load quickly

    const manifest = await manifestResponse.json()

    // Verify essential PWA properties for teacher use
    expect(manifest.name).toBe('eduhu.ki')
    expect(manifest.short_name).toBe('eduhu.ki')
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons).toHaveLength(2)

    console.log(`PWA manifest loaded in ${manifestLoadTime}ms`)
  })

  test('Offline capability performance @performance', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForLoadState('networkidle')

    // Simulate going offline (teacher loses internet in classroom)
    await page.context().setOffline(true)

    // App should still be accessible offline
    await page.reload()

    // Basic interface should load from cache
    const offlineStartTime = Date.now()

    await page.waitForSelector('h1', { timeout: 10000 })

    const offlineLoadTime = Date.now() - offlineStartTime

    // Offline loading should be fast (served from cache)
    expect(offlineLoadTime).toBeLessThan(2000)

    // Verify basic functionality is available
    await expect(page.getByText('Teacher AI Assistant')).toBeVisible()
    await expect(page.getByPlaceholder(/Ask about lesson plans/)).toBeVisible()

    console.log(`Offline page loaded in ${offlineLoadTime}ms`)
  })
})

test.describe('Performance Monitoring and Alerts', () => {
  test('Performance metrics are collected correctly @performance', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForLoadState('networkidle')

    // Check if performance monitoring is active
    const metricsCollected = await page.evaluate(() => {
      // Check if performance observer APIs are being used
      return {
        hasPerformanceObserver: 'PerformanceObserver' in window,
        hasNavigationTiming: 'navigation' in performance,
        hasResourceTiming: performance.getEntriesByType('resource').length > 0,
        hasUserTiming: performance.getEntriesByType('measure').length >= 0
      }
    })

    expect(metricsCollected.hasPerformanceObserver).toBe(true)
    expect(metricsCollected.hasNavigationTiming).toBe(true)
    expect(metricsCollected.hasResourceTiming).toBe(true)

    console.log('Performance monitoring capabilities:', metricsCollected)
  })

  test('Resource loading performance @performance', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForLoadState('networkidle')

    // Check resource loading performance
    const resourceMetrics = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource')
      return resources.map(resource => ({
        name: resource.name,
        duration: resource.duration,
        transferSize: resource.transferSize || 0,
        type: resource.initiatorType
      })).filter(resource =>
        resource.name.includes('/chat') ||
        resource.name.includes('.js') ||
        resource.name.includes('.css') ||
        resource.name.includes('api/')
      )
    })

    console.log('Resource loading metrics:', resourceMetrics)

    // Critical resources should load quickly
    const criticalResources = resourceMetrics.filter(r =>
      r.name.includes('chat') || r.name.includes('api/'))

    for (const resource of criticalResources) {
      expect(resource.duration).toBeLessThan(2000) // Critical resources under 2s
    }

    // JavaScript bundles shouldn't be too large (impacts mobile teachers)
    const jsResources = resourceMetrics.filter(r => r.name.includes('.js'))
    const totalJsSize = jsResources.reduce((total, r) => total + r.transferSize, 0)

    // Total JS payload should be reasonable for mobile networks
    expect(totalJsSize).toBeLessThan(1024 * 1024) // Under 1MB total
  })
})