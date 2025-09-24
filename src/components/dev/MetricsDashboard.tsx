'use client'

import React, { useState, useEffect } from 'react'
import { PerformanceMonitor, AlertManager } from '@/lib/metrics'
import { CacheManager } from '@/lib/cache'
import { testDatabaseConnection } from '@/lib/database'

interface DashboardProps {
  isVisible: boolean
  onToggle: () => void
}

export default function MetricsDashboard({ isVisible, onToggle }: DashboardProps) {
  const [metrics, setMetrics] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [dbHealth, setDbHealth] = useState<any>(null)
  const [cacheStats, setCacheStats] = useState<any>(null)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isVisible) {
      // Initial load
      refreshMetrics()

      // Set up auto-refresh
      const interval = setInterval(refreshMetrics, 5000) // Refresh every 5 seconds
      setRefreshInterval(interval)

      return () => {
        if (interval) clearInterval(interval)
      }
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval)
        setRefreshInterval(null)
      }
    }
  }, [isVisible])

  const refreshMetrics = async () => {
    try {
      const [dashboardMetrics, activeAlerts, connectionHealth, cacheStatistics] = await Promise.all([
        PerformanceMonitor.getDashboardMetrics(),
        AlertManager.getActiveAlerts(),
        testDatabaseConnection(),
        CacheManager.getCacheStats()
      ])

      setMetrics(dashboardMetrics)
      setAlerts(activeAlerts)
      setDbHealth(connectionHealth)
      setCacheStats(cacheStatistics)
    } catch (error) {
      console.error('Failed to refresh metrics:', error)
    }
  }

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 z-50 text-sm font-medium"
      >
        📊 Metrics
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-96 max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <h3 className="font-semibold text-gray-900">System Metrics</h3>
        <button
          onClick={onToggle}
          className="text-gray-500 hover:text-gray-700 text-xl font-bold"
        >
          ×
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Database Health */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2 flex items-center">
            <span className={`w-3 h-3 rounded-full mr-2 ${
              dbHealth?.connected ? 'bg-green-500' : 'bg-red-500'
            }`}></span>
            Database Health
          </h4>
          <div className="text-sm text-gray-600 space-y-1">
            <div>Status: {dbHealth?.connected ? '✅ Connected' : '❌ Disconnected'}</div>
            {dbHealth?.latency && (
              <div>Latency: {dbHealth.latency}ms</div>
            )}
            {dbHealth?.details?.appId && (
              <div className="font-mono text-xs">App: {dbHealth.details.appId}</div>
            )}
          </div>
        </div>

        {/* Cache Statistics */}
        {cacheStats && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Cache Performance</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Active Entries: {cacheStats.active}</div>
              <div>Expired: {cacheStats.expired}</div>
              <div>Hit Rate: {(cacheStats.hitRate * 100).toFixed(1)}%</div>
            </div>
          </div>
        )}

        {/* Query Performance */}
        {metrics?.database && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Query Performance</h4>
            <div className="text-sm text-gray-600 space-y-1">
              {metrics.database.queryPerformance && (
                <>
                  <div>Avg Response: {Math.round(metrics.database.queryPerformance.avg)}ms</div>
                  <div>P95: {Math.round(metrics.database.queryPerformance.p95)}ms</div>
                  <div>Query Count: {metrics.database.queryPerformance.count}</div>
                </>
              )}
              {metrics.database.slowQueries && (
                <div className="text-orange-600">
                  Slow Queries: {metrics.database.slowQueries.count}
                </div>
              )}
            </div>
          </div>
        )}

        {/* API Performance */}
        {metrics?.api && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">API Performance</h4>
            <div className="text-sm text-gray-600 space-y-1">
              {metrics.api.requestDuration && (
                <>
                  <div>Avg Response: {Math.round(metrics.api.requestDuration.avg)}ms</div>
                  <div>Request Count: {metrics.api.requestDuration.count}</div>
                </>
              )}
              <div className={`${
                metrics.api.errorRate > 5 ? 'text-red-600' : 'text-green-600'
              }`}>
                Error Rate: {metrics.api.errorRate?.toFixed(1) || 0}%
              </div>
            </div>
          </div>
        )}

        {/* Educational Analytics */}
        {metrics?.educational && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Educational Metrics</h4>
            <div className="text-sm text-gray-600 space-y-1">
              {metrics.educational.avgResponseTime && (
                <div>AI Response: {Math.round(metrics.educational.avgResponseTime.avg)}ms</div>
              )}
              {metrics.educational.topicDistribution && (
                <div className="mt-2">
                  <div className="font-medium text-gray-700">Top Topics:</div>
                  {Object.entries(metrics.educational.topicDistribution).slice(0, 3).map(([topic, count]) => (
                    <div key={topic} className="flex justify-between">
                      <span className="capitalize">{topic.replace('-', ' ')}</span>
                      <span>{String(count)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* System Resources */}
        {metrics?.system && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">System Resources</h4>
            <div className="text-sm text-gray-600 space-y-1">
              {metrics.system.memoryUsage && (
                <div>Memory: {Math.round(metrics.system.memoryUsage.avg / 1024 / 1024)}MB</div>
              )}
              {metrics.system.connectionHealth && (
                <>
                  <div>DB Connections: {metrics.system.connectionHealth.active}/{metrics.system.connectionHealth.total}</div>
                  <div className="capitalize">Health: {metrics.system.connectionHealth.health}</div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Active Alerts */}
        {alerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
            <h4 className="font-medium text-red-900 mb-2">🚨 Active Alerts</h4>
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <div key={index} className="text-sm">
                  <div className={`font-medium ${
                    alert.severity === 'critical' ? 'text-red-700' :
                    alert.severity === 'high' ? 'text-red-600' :
                    alert.severity === 'medium' ? 'text-orange-600' :
                    'text-yellow-600'
                  }`}>
                    {alert.severity.toUpperCase()}: {alert.type}
                  </div>
                  <div className="text-red-700">{alert.message}</div>
                  <div className="text-red-500 text-xs">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-2">
          <button
            onClick={refreshMetrics}
            className="flex-1 bg-blue-100 text-blue-700 px-3 py-2 rounded text-sm font-medium hover:bg-blue-200"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => {
              CacheManager.clearCache()
              AlertManager.clearAlerts()
              refreshMetrics()
            }}
            className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded text-sm font-medium hover:bg-gray-200"
          >
            🧹 Clear
          </button>
        </div>

        {/* Footer */}
        <div className="text-xs text-gray-500 text-center border-t border-gray-200 pt-2">
          eduhu.ki Backend Architecture v2.0
        </div>
      </div>
    </div>
  )
}

// Hook for easy integration
export function useMetricsDashboard() {
  const [isVisible, setIsVisible] = useState(false)

  // Only show in development
  const isDevelopment = process.env.NODE_ENV === 'development'

  const toggle = () => setIsVisible(!isVisible)

  return {
    isVisible: isDevelopment && isVisible,
    toggle: isDevelopment ? toggle : () => {},
    component: isDevelopment ? (
      <MetricsDashboard isVisible={isVisible} onToggle={toggle} />
    ) : null
  }
}