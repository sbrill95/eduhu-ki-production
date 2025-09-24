// Core Web Vitals monitoring and reporting
// This handles client-side performance metrics collection

export interface WebVital {
  name: string
  value: number
  id: string
  navigationType?: string
}

export interface CoreWebVitalsReport {
  lcp?: number // Largest Contentful Paint
  fid?: number // First Input Delay
  cls?: number // Cumulative Layout Shift
  fcp?: number // First Contentful Paint
  ttfb?: number // Time to First Byte
  timestamp: string
  url: string
  userAgent: string
  connection?: {
    effectiveType?: string
    rtt?: number
    downlink?: number
  }
}

// Store metrics temporarily before sending
const metricsQueue: WebVital[] = []
let reportTimeout: NodeJS.Timeout | null = null

export function reportWebVital(metric: WebVital) {
  // Add to queue
  metricsQueue.push(metric)

  // Clear existing timeout
  if (reportTimeout) {
    clearTimeout(reportTimeout)
  }

  // Send metrics after a delay or when queue is full
  reportTimeout = setTimeout(() => {
    sendMetrics()
  }, 5000) // Send after 5 seconds of inactivity

  if (metricsQueue.length >= 10) {
    sendMetrics() // Send immediately if queue is full
  }
}

async function sendMetrics() {
  if (metricsQueue.length === 0) return

  try {
    // Prepare the report
    const report: CoreWebVitalsReport = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    }

    // Add connection info if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      report.connection = {
        effectiveType: connection?.effectiveType,
        rtt: connection?.rtt,
        downlink: connection?.downlink,
      }
    }

    // Process metrics from queue
    const currentMetrics = [...metricsQueue]
    metricsQueue.length = 0 // Clear queue

    currentMetrics.forEach(metric => {
      switch (metric.name) {
        case 'LCP':
          report.lcp = metric.value
          break
        case 'FID':
          report.fid = metric.value
          break
        case 'CLS':
          report.cls = metric.value
          break
        case 'FCP':
          report.fcp = metric.value
          break
        case 'TTFB':
          report.ttfb = metric.value
          break
      }
    })

    // Send to monitoring endpoint
    await fetch('/api/monitor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'core_web_vitals',
        data: report,
        metrics: currentMetrics
      }),
    })

    console.log('Core Web Vitals reported:', report)
  } catch (error) {
    console.error('Failed to report Core Web Vitals:', error)

    // Re-add metrics to queue if sending failed
    metricsQueue.unshift(...metricsQueue)
  } finally {
    reportTimeout = null
  }
}

// Performance observer for additional metrics
export function initPerformanceMonitoring() {
  if (typeof window === 'undefined') return

  // Monitor navigation timing
  if ('PerformanceObserver' in window) {
    try {
      // Observe navigation entries
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming

            // Report TTFB
            reportWebVital({
              name: 'TTFB',
              value: navEntry.responseStart - navEntry.fetchStart,
              id: 'ttfb-' + Math.random().toString(36).substr(2, 9),
            })
          }
        }
      })

      navObserver.observe({ type: 'navigation', buffered: true })

      // Observe resource timing
      const resourceObserver = new PerformanceObserver((list) => {
        const resources = list.getEntries().filter(entry =>
          entry.name.includes('.js') ||
          entry.name.includes('.css') ||
          entry.name.includes('.png') ||
          entry.name.includes('.jpg') ||
          entry.name.includes('.webp')
        )

        if (resources.length > 0) {
          console.log('Resource loading performance:', resources)
        }
      })

      resourceObserver.observe({ type: 'resource', buffered: true })

    } catch (error) {
      console.warn('Performance monitoring setup failed:', error)
    }
  }

  // Monitor long tasks
  if ('PerformanceObserver' in window) {
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.warn('Long task detected:', {
            duration: entry.duration,
            startTime: entry.startTime,
          })

          // Report as custom metric
          if (entry.duration > 50) {
            reportWebVital({
              name: 'Long Task',
              value: entry.duration,
              id: 'lt-' + Math.random().toString(36).substr(2, 9),
            })
          }
        }
      })

      longTaskObserver.observe({ type: 'longtask', buffered: true })
    } catch (error) {
      console.warn('Long task monitoring setup failed:', error)
    }
  }

  // Report on page unload
  window.addEventListener('beforeunload', () => {
    if (metricsQueue.length > 0) {
      sendMetrics()
    }
  })

  // Report periodically for long-lived pages
  setInterval(() => {
    if (metricsQueue.length > 0) {
      sendMetrics()
    }
  }, 60000) // Every minute
}

// Check Core Web Vitals thresholds
export function analyzePerformance(report: CoreWebVitalsReport): {
  score: 'good' | 'needs-improvement' | 'poor'
  issues: string[]
  recommendations: string[]
} {
  const issues: string[] = []
  const recommendations: string[] = []
  let poorCount = 0
  let needsImprovementCount = 0

  // LCP thresholds: Good < 2.5s, Poor > 4s
  if (report.lcp) {
    if (report.lcp > 4000) {
      poorCount++
      issues.push('LCP is poor (>4s)')
      recommendations.push('Optimize server response times and image loading')
    } else if (report.lcp > 2500) {
      needsImprovementCount++
      issues.push('LCP needs improvement (>2.5s)')
      recommendations.push('Consider image optimization and lazy loading')
    }
  }

  // FID thresholds: Good < 100ms, Poor > 300ms
  if (report.fid) {
    if (report.fid > 300) {
      poorCount++
      issues.push('FID is poor (>300ms)')
      recommendations.push('Reduce JavaScript execution time and optimize event handlers')
    } else if (report.fid > 100) {
      needsImprovementCount++
      issues.push('FID needs improvement (>100ms)')
      recommendations.push('Consider code splitting and reducing main thread work')
    }
  }

  // CLS thresholds: Good < 0.1, Poor > 0.25
  if (report.cls) {
    if (report.cls > 0.25) {
      poorCount++
      issues.push('CLS is poor (>0.25)')
      recommendations.push('Set size attributes on images and avoid inserting content above existing content')
    } else if (report.cls > 0.1) {
      needsImprovementCount++
      issues.push('CLS needs improvement (>0.1)')
      recommendations.push('Reserve space for dynamic content and use CSS aspect ratio')
    }
  }

  // TTFB thresholds: Good < 800ms, Poor > 1800ms
  if (report.ttfb) {
    if (report.ttfb > 1800) {
      poorCount++
      issues.push('TTFB is poor (>1.8s)')
      recommendations.push('Optimize server performance and consider CDN usage')
    } else if (report.ttfb > 800) {
      needsImprovementCount++
      issues.push('TTFB needs improvement (>800ms)')
    }
  }

  // Determine overall score
  let score: 'good' | 'needs-improvement' | 'poor'
  if (poorCount > 0) {
    score = 'poor'
  } else if (needsImprovementCount > 0) {
    score = 'needs-improvement'
  } else {
    score = 'good'
  }

  return { score, issues, recommendations }
}