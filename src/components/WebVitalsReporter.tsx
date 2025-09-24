'use client'

import { useEffect } from 'react'
import { reportWebVital, initPerformanceMonitoring } from '@/lib/core-web-vitals'

export default function WebVitalsReporter() {
  useEffect(() => {
    // Initialize performance monitoring
    initPerformanceMonitoring()

    // Import web-vitals library dynamically to avoid SSR issues
    import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
      onCLS(reportWebVital)
      onINP(reportWebVital) // FID has been replaced with INP in newer versions
      onFCP(reportWebVital)
      onLCP(reportWebVital)
      onTTFB(reportWebVital)
    }).catch(error => {
      console.warn('Web Vitals library not available:', error)
    })
  }, [])

  return null // This component doesn't render anything
}