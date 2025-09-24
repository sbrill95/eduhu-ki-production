'use client'

import { useState, useEffect } from 'react'

interface HealthStatus {
  status: string
  timestamp: string
  version: string
  environment: string
  services: {
    database: { status: string }
    ai: { status: string }
    memory: any
  }
  uptime: number
  deployment: {
    region: string
    url: string
  }
}

interface MonitoringMetrics {
  timestamp: string
  uptime: number
  system: {
    memory: any
    node_version: string
    platform: string
    environment: string
  }
  services: any
  performance: any
}

export default function MonitoringDashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [metrics, setMetrics] = useState<MonitoringMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    fetchData()

    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const fetchData = async () => {
    try {
      const [healthRes, metricsRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/monitor')
      ])

      if (healthRes.ok && metricsRes.ok) {
        const healthData = await healthRes.json()
        const metricsData = await metricsRes.json()

        setHealth(healthData)
        setMetrics(metricsData)
        setError(null)
      } else {
        throw new Error('Failed to fetch monitoring data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100'
      case 'unhealthy': return 'text-red-600 bg-red-100'
      case 'degraded': return 'text-yellow-600 bg-yellow-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m ${seconds % 60}s`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading monitoring data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Monitoring Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">eduhu.ki Monitoring Dashboard</h1>
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="mr-2"
                />
                Auto-refresh (30s)
              </label>
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Refresh Now
              </button>
            </div>
          </div>
          <p className="text-gray-600 mt-2">
            Last updated: {health?.timestamp ? new Date(health.timestamp).toLocaleString() : 'Never'}
          </p>
        </div>

        {/* Overall Health Status */}
        {health && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Overall Health Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(health.status)}`}>
                  {health.status.toUpperCase()}
                </div>
                <p className="text-gray-600 mt-1">System Status</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{formatUptime(health.uptime)}</div>
                <p className="text-gray-600">Uptime</p>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{health.environment}</div>
                <p className="text-gray-600">Environment</p>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{health.deployment?.region || 'local'}</div>
                <p className="text-gray-600">Region</p>
              </div>
            </div>
          </div>
        )}

        {/* Service Status */}
        {health && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Service Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">InstantDB</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(health.services.database.status)}`}>
                    {health.services.database.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600">Real-time database connection</p>
              </div>
              <div className="border rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">OpenAI API</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(health.services.ai.status)}`}>
                    {health.services.ai.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600">AI chat functionality</p>
              </div>
              <div className="border rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Memory Usage</h3>
                  <span className="text-sm font-medium">
                    {health.services.memory?.heapUsed || 0}MB
                  </span>
                </div>
                <p className="text-sm text-gray-600">Current memory consumption</p>
              </div>
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        {metrics && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Performance Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="border rounded p-4">
                <h3 className="font-medium mb-2">Memory Usage</h3>
                <div className="space-y-1 text-sm">
                  <div>RSS: {metrics.system.memory.rss_mb}MB</div>
                  <div>Heap: {metrics.system.memory.heap_used_mb}MB / {metrics.system.memory.heap_total_mb}MB</div>
                  <div>Usage: {metrics.system.memory.heap_used_percent}%</div>
                </div>
              </div>
              <div className="border rounded p-4">
                <h3 className="font-medium mb-2">System Info</h3>
                <div className="space-y-1 text-sm">
                  <div>Node: {metrics.system.node_version}</div>
                  <div>Platform: {metrics.system.platform}</div>
                  <div>Uptime: {formatUptime(metrics.uptime)}</div>
                </div>
              </div>
              <div className="border rounded p-4">
                <h3 className="font-medium mb-2">Event Loop</h3>
                <div className="space-y-1 text-sm">
                  <div>Utilization: {(metrics.performance.event_loop_utilization.utilization * 100).toFixed(1)}%</div>
                  <div>Active Handles: {metrics.performance.active_handles}</div>
                  <div>Active Requests: {metrics.performance.active_requests}</div>
                </div>
              </div>
              <div className="border rounded p-4">
                <h3 className="font-medium mb-2">Response Times</h3>
                <div className="space-y-1 text-sm">
                  <div>InstantDB: {metrics.services.instantdb?.response_time_ms || 'N/A'}ms</div>
                  <div>OpenAI: {metrics.services.openai?.response_time_ms || 'N/A'}ms</div>
                  <div>Internal: {metrics.services.internal?.response_time_ms || 'N/A'}ms</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">System Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-2">Deployment Info</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <div>Version: {health?.version || 'development'}</div>
                <div>Region: {health?.deployment?.region || 'local'}</div>
                <div>URL: {health?.deployment?.url || 'localhost'}</div>
              </div>
            </div>
            <div>
              <h3 className="font-medium mb-2">Quick Actions</h3>
              <div className="space-y-2">
                <a
                  href="/api/health"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
                >
                  View Health JSON
                </a>
                <a
                  href="/api/monitor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 ml-2"
                >
                  View Metrics JSON
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}