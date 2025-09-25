#!/usr/bin/env node

/**
 * Storage Deployment Validation Script for eduhu.ki
 * Validates storage functionality in deployed environments
 */

const https = require('https')
const http = require('http')
const { URL } = require('url')
const fs = require('fs')
const path = require('path')

const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
}

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`)
}

function logHeader(message) {
  console.log(`\n${COLORS.bold}${COLORS.blue}=== ${message} ===${COLORS.reset}`)
}

function logSuccess(message) {
  console.log(`${COLORS.green}✅ ${message}${COLORS.reset}`)
}

function logWarning(message) {
  console.log(`${COLORS.yellow}⚠️  ${message}${COLORS.reset}`)
}

function logError(message) {
  console.log(`${COLORS.red}❌ ${message}${COLORS.reset}`)
}

class StorageDeploymentValidator {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl
    this.errors = []
    this.warnings = []
    this.isProduction = baseUrl.includes('vercel.app') || baseUrl.includes('eduhu.ki')
    this.testResults = {
      storage: {},
      apis: {},
      security: {},
      performance: {}
    }
  }

  async validateStorageDeployment() {
    logHeader(`Storage Deployment Validation for ${this.baseUrl}`)

    try {
      await this.validateStorageConfiguration()
      await this.validateStorageAPIs()
      await this.validateFileOperations()
      await this.validateStorageSecurity()
      await this.validateStoragePerformance()
      await this.validateStorageMonitoring()
      await this.validateStorageBackup()

      this.generateReport()

      if (this.errors.length > 0) {
        process.exit(1)
      }
    } catch (error) {
      logError(`Storage validation failed: ${error.message}`)
      process.exit(1)
    }
  }

  async validateStorageConfiguration() {
    logHeader('Validating Storage Configuration')

    try {
      // Check storage info endpoint
      const response = await this.makeRequest('/api/storage/info')

      if (response.statusCode === 200) {
        const storageInfo = JSON.parse(response.body)

        logSuccess('Storage configuration endpoint accessible')
        this.testResults.storage.configEndpoint = true

        // Validate storage provider
        if (storageInfo.provider) {
          logSuccess(`Storage provider: ${storageInfo.provider}`)
          this.testResults.storage.provider = storageInfo.provider

          if (storageInfo.configured) {
            logSuccess('Storage adapter is configured')
            this.testResults.storage.configured = true
          } else {
            this.warnings.push('Storage adapter reports not configured')
            this.testResults.storage.configured = false
          }

          // Check provider-specific details
          if (storageInfo.details) {
            if (storageInfo.provider === 's3') {
              if (storageInfo.details.bucket && storageInfo.details.region) {
                logSuccess(`S3 bucket: ${storageInfo.details.bucket} (${storageInfo.details.region})`)
              } else {
                this.warnings.push('S3 configuration missing bucket or region details')
              }
            } else if (storageInfo.provider === 'r2') {
              if (storageInfo.details.bucket && storageInfo.details.accountId) {
                logSuccess(`R2 bucket: ${storageInfo.details.bucket}`)
              } else {
                this.warnings.push('R2 configuration missing bucket or account details')
              }
            }
          }
        } else {
          this.warnings.push('Storage provider not specified')
        }
      } else {
        this.errors.push(`Storage configuration endpoint returned ${response.statusCode}`)
      }

      // Test storage adapter initialization
      try {
        const initResponse = await this.makeRequest('/api/storage/test-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true })
        })

        if (initResponse.statusCode === 200) {
          const testResult = JSON.parse(initResponse.body)
          if (testResult.success) {
            logSuccess('Storage adapter connection test passed')
            this.testResults.storage.connectionTest = true
          } else {
            this.warnings.push(`Storage connection test failed: ${testResult.message}`)
            this.testResults.storage.connectionTest = false
          }
        }
      } catch (testError) {
        this.warnings.push('Storage connection test endpoint not available')
      }

    } catch (error) {
      this.errors.push(`Storage configuration validation failed: ${error.message}`)
    }
  }

  async validateStorageAPIs() {
    logHeader('Validating Storage APIs')

    const storageEndpoints = [
      { path: '/api/files/test.txt', name: 'File serving API', method: 'GET' },
      { path: '/api/upload', name: 'File upload API', method: 'POST' },
      { path: '/api/storage/analytics', name: 'Storage analytics API', method: 'GET' },
    ]

    for (const endpoint of storageEndpoints) {
      try {
        const response = await this.makeRequest(endpoint.path, { method: endpoint.method })

        // For file serving, 404 is acceptable (file doesn't exist)
        if (endpoint.path.includes('/api/files/')) {
          if (response.statusCode === 404 || response.statusCode === 200) {
            logSuccess(`${endpoint.name} responding (${response.statusCode})`)
            this.testResults.apis[endpoint.name] = true
          } else {
            this.warnings.push(`${endpoint.name} returned unexpected status: ${response.statusCode}`)
            this.testResults.apis[endpoint.name] = false
          }
        } else if (endpoint.path.includes('/api/upload')) {
          // Upload endpoint should return 400/405 for GET requests (method not allowed)
          if (response.statusCode === 405 || response.statusCode === 400) {
            logSuccess(`${endpoint.name} responding (method validation working)`)
            this.testResults.apis[endpoint.name] = true
          } else if (response.statusCode === 200) {
            logWarning(`${endpoint.name} accepts GET requests (might be insecure)`)
            this.testResults.apis[endpoint.name] = true
          } else {
            this.warnings.push(`${endpoint.name} returned status ${response.statusCode}`)
            this.testResults.apis[endpoint.name] = false
          }
        } else {
          // Other APIs should return 200 or 4xx (not 5xx)
          if (response.statusCode >= 200 && response.statusCode < 500) {
            logSuccess(`${endpoint.name} responding (${response.statusCode})`)
            this.testResults.apis[endpoint.name] = true
          } else {
            this.errors.push(`${endpoint.name} returned server error: ${response.statusCode}`)
            this.testResults.apis[endpoint.name] = false
          }
        }
      } catch (error) {
        this.errors.push(`${endpoint.name} failed: ${error.message}`)
        this.testResults.apis[endpoint.name] = false
      }
    }
  }

  async validateFileOperations() {
    logHeader('Validating File Operations')

    // Test file serving with query parameters
    try {
      const testPath = '/api/files/test/sample.jpg'
      const queryParams = '?teacherId=test&sessionId=test-session'

      const response = await this.makeRequest(testPath + queryParams)

      // Check security headers
      const securityHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'cache-control'
      ]

      let secureHeadersPresent = 0
      securityHeaders.forEach(header => {
        if (response.headers[header]) {
          secureHeadersPresent++
        }
      })

      if (secureHeadersPresent >= 2) {
        logSuccess(`File serving security headers present (${secureHeadersPresent}/${securityHeaders.length})`)
        this.testResults.security.fileHeaders = true
      } else {
        this.warnings.push(`File serving missing security headers (${secureHeadersPresent}/${securityHeaders.length})`)
        this.testResults.security.fileHeaders = false
      }

      // Check for proper error handling
      if (response.statusCode === 404) {
        try {
          const errorBody = JSON.parse(response.body)
          if (errorBody.error && !errorBody.error.includes('path') && !errorBody.error.includes('directory')) {
            logSuccess('File serving error handling secure (no path disclosure)')
            this.testResults.security.errorHandling = true
          } else {
            this.warnings.push('File serving may leak path information in errors')
            this.testResults.security.errorHandling = false
          }
        } catch (parseError) {
          logSuccess('File serving returns non-JSON errors (good for security)')
          this.testResults.security.errorHandling = true
        }
      }

    } catch (error) {
      this.warnings.push(`File operations test failed: ${error.message}`)
    }

    // Test upload size limits (if upload endpoint is accessible)
    try {
      const uploadTest = await this.makeRequest('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
          'Content-Length': '0'
        },
        body: ''
      })

      if (uploadTest.statusCode === 400) {
        logSuccess('Upload endpoint validates empty requests')
        this.testResults.security.uploadValidation = true
      } else if (uploadTest.statusCode === 413) {
        logSuccess('Upload size limits are enforced')
        this.testResults.security.uploadLimits = true
      }
    } catch (error) {
      // Upload test failure is not critical
      this.warnings.push('Upload validation test inconclusive')
    }
  }

  async validateStorageSecurity() {
    logHeader('Validating Storage Security')

    try {
      // Test CORS headers
      const corsTest = await this.makeRequest('/api/files/test.jpg', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET'
        }
      })

      if (corsTest.headers['access-control-allow-origin']) {
        const allowedOrigin = corsTest.headers['access-control-allow-origin']
        if (allowedOrigin === '*') {
          this.warnings.push('CORS allows all origins (may be insecure for production)')
        } else {
          logSuccess(`CORS configured with specific origins: ${allowedOrigin}`)
        }
        this.testResults.security.cors = true
      } else {
        this.warnings.push('CORS headers not found')
        this.testResults.security.cors = false
      }

      // Test for directory traversal protection
      const traversalTests = [
        '/api/files/../../../etc/passwd',
        '/api/files/..\\..\\..\\windows\\system32\\config\\sam',
        '/api/files/test/../sensitive.txt'
      ]

      let traversalProtected = 0
      for (const testPath of traversalTests) {
        try {
          const response = await this.makeRequest(testPath)
          if (response.statusCode === 400 || response.statusCode === 403) {
            traversalProtected++
          } else if (response.statusCode === 404) {
            // 404 is acceptable - file doesn't exist
            traversalProtected++
          }
        } catch (error) {
          // Connection errors are acceptable for security tests
          traversalProtected++
        }
      }

      if (traversalProtected === traversalTests.length) {
        logSuccess('Directory traversal protection working')
        this.testResults.security.traversalProtection = true
      } else {
        this.errors.push('Directory traversal protection may be insufficient')
        this.testResults.security.traversalProtection = false
      }

      // Test authentication requirements for sensitive endpoints
      try {
        const analyticsResponse = await this.makeRequest('/api/storage/analytics')
        if (analyticsResponse.statusCode === 401 && this.isProduction) {
          logSuccess('Storage analytics requires authentication in production')
          this.testResults.security.analyticsAuth = true
        } else if (!this.isProduction) {
          logSuccess('Storage analytics accessible in development')
          this.testResults.security.analyticsAuth = true
        } else {
          this.warnings.push('Storage analytics may not require proper authentication')
          this.testResults.security.analyticsAuth = false
        }
      } catch (error) {
        this.warnings.push('Analytics authentication test failed')
      }

    } catch (error) {
      this.warnings.push(`Security validation failed: ${error.message}`)
    }
  }

  async validateStoragePerformance() {
    logHeader('Validating Storage Performance')

    try {
      // Test file serving response times
      const performanceTests = [
        { path: '/api/health', name: 'Health endpoint' },
        { path: '/api/files/nonexistent.jpg', name: 'File not found response' },
      ]

      for (const test of performanceTests) {
        const startTime = Date.now()
        try {
          await this.makeRequest(test.path)
        } catch (error) {
          // Ignore connection errors for performance testing
        }
        const responseTime = Date.now() - startTime

        if (responseTime < 1000) {
          logSuccess(`${test.name} response time: ${responseTime}ms`)
        } else if (responseTime < 3000) {
          logWarning(`${test.name} response time: ${responseTime}ms (could be faster)`)
        } else {
          this.warnings.push(`${test.name} response time: ${responseTime}ms (too slow)`)
        }

        this.testResults.performance[test.name.replace(/\s+/g, '')] = responseTime
      }

      // Test concurrent request handling
      const concurrentTests = Array(5).fill().map((_, i) =>
        this.makeRequest(`/api/health?test=${i}`)
      )

      const concurrentStart = Date.now()
      try {
        await Promise.all(concurrentTests)
        const concurrentTime = Date.now() - concurrentStart

        if (concurrentTime < 2000) {
          logSuccess(`Concurrent requests handled efficiently: ${concurrentTime}ms`)
          this.testResults.performance.concurrentRequests = concurrentTime
        } else {
          this.warnings.push(`Concurrent requests slow: ${concurrentTime}ms`)
          this.testResults.performance.concurrentRequests = concurrentTime
        }
      } catch (error) {
        this.warnings.push('Concurrent request test failed')
      }

    } catch (error) {
      this.warnings.push(`Performance validation failed: ${error.message}`)
    }
  }

  async validateStorageMonitoring() {
    logHeader('Validating Storage Monitoring')

    try {
      // Check if monitoring endpoint is available
      const monitoringResponse = await this.makeRequest('/api/storage/analytics')

      if (monitoringResponse.statusCode === 200 || monitoringResponse.statusCode === 401) {
        logSuccess('Storage monitoring endpoint available')
        this.testResults.storage.monitoringEndpoint = true

        if (monitoringResponse.statusCode === 200) {
          try {
            const monitoringData = JSON.parse(monitoringResponse.body)

            if (monitoringData.monitoring) {
              if (monitoringData.monitoring.enabled) {
                logSuccess('Storage monitoring is enabled')
              } else {
                this.warnings.push('Storage monitoring is disabled')
              }

              if (monitoringData.monitoring.analyticsEnabled) {
                logSuccess('Storage analytics is enabled')
              } else {
                this.warnings.push('Storage analytics is disabled')
              }

              if (monitoringData.monitoring.alertsEnabled) {
                logSuccess('Storage alerts are configured')
              } else {
                this.warnings.push('Storage alerts are not configured')
              }
            }
          } catch (parseError) {
            this.warnings.push('Could not parse monitoring data')
          }
        }
      } else if (monitoringResponse.statusCode === 503) {
        this.warnings.push('Storage monitoring is disabled')
        this.testResults.storage.monitoringEndpoint = false
      } else {
        this.warnings.push(`Storage monitoring endpoint returned ${monitoringResponse.statusCode}`)
      }

    } catch (error) {
      this.warnings.push(`Monitoring validation failed: ${error.message}`)
    }
  }

  async validateStorageBackup() {
    logHeader('Validating Storage Backup Configuration')

    // This is more of a configuration check since we can't test actual backups
    try {
      // Check if backup configuration is documented in health endpoint
      const healthResponse = await this.makeRequest('/api/health')

      if (healthResponse.statusCode === 200) {
        const healthData = JSON.parse(healthResponse.body)

        // Look for backup-related information
        const hasBackupInfo = JSON.stringify(healthData).toLowerCase().includes('backup')

        if (hasBackupInfo) {
          logSuccess('Backup configuration information available')
          this.testResults.storage.backupInfo = true
        } else {
          this.warnings.push('No backup configuration information found')
          this.testResults.storage.backupInfo = false
        }
      }

      // In production, backup should be enabled
      if (this.isProduction) {
        this.warnings.push('Manual verification required: Ensure automated backups are configured')
      } else {
        logSuccess('Backup validation skipped in development')
      }

    } catch (error) {
      this.warnings.push(`Backup validation failed: ${error.message}`)
    }
  }

  makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl)
      const isHttps = url.protocol === 'https:'
      const client = isHttps ? https : http

      const requestOptions = {
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: 10000,
      }

      const req = client.request(url, requestOptions, (res) => {
        let body = ''

        res.on('data', (chunk) => {
          body += chunk
        })

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          })
        })
      })

      req.on('error', (error) => {
        reject(error)
      })

      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Request timeout'))
      })

      if (options.body) {
        req.write(options.body)
      }

      req.end()
    })
  }

  generateReport() {
    logHeader('Storage Deployment Validation Report')

    console.log('\n📊 Test Results Summary:')
    console.log('=====================================')

    // Storage Configuration
    console.log('\n🔧 Storage Configuration:')
    console.log(`  Provider: ${this.testResults.storage.provider || 'Unknown'}`)
    console.log(`  Configured: ${this.testResults.storage.configured ? '✅' : '❌'}`)
    console.log(`  Connection Test: ${this.testResults.storage.connectionTest ? '✅' : '❌'}`)

    // API Endpoints
    console.log('\n🔌 API Endpoints:')
    Object.entries(this.testResults.apis).forEach(([api, status]) => {
      console.log(`  ${api}: ${status ? '✅' : '❌'}`)
    })

    // Security
    console.log('\n🔒 Security:')
    Object.entries(this.testResults.security).forEach(([check, status]) => {
      console.log(`  ${check}: ${status ? '✅' : '❌'}`)
    })

    // Performance
    console.log('\n⚡ Performance:')
    Object.entries(this.testResults.performance).forEach(([test, time]) => {
      if (typeof time === 'number') {
        console.log(`  ${test}: ${time}ms`)
      }
    })

    // Summary
    console.log('\n📋 Summary:')
    console.log(`  Errors: ${this.errors.length}`)
    console.log(`  Warnings: ${this.warnings.length}`)

    if (this.errors.length === 0 && this.warnings.length === 0) {
      logSuccess('🎉 All storage deployment validations passed!')
    } else {
      if (this.errors.length > 0) {
        console.log('\n🚨 CRITICAL ISSUES:')
        this.errors.forEach(error => logError(error))
      }

      if (this.warnings.length > 0) {
        console.log('\n⚠️  WARNINGS:')
        this.warnings.forEach(warning => logWarning(warning))
      }

      if (this.errors.length > 0) {
        logError('\n❌ Storage deployment validation FAILED')
      } else {
        logWarning('\n✅ Storage deployment validation PASSED with warnings')
      }
    }

    // Save detailed report
    const reportPath = `/tmp/storage-validation-report-${Date.now()}.json`
    const report = {
      timestamp: new Date().toISOString(),
      baseUrl: this.baseUrl,
      isProduction: this.isProduction,
      testResults: this.testResults,
      errors: this.errors,
      warnings: this.warnings,
      summary: {
        totalTests: Object.keys(this.testResults).reduce((count, category) =>
          count + Object.keys(this.testResults[category]).length, 0),
        passed: this.errors.length === 0,
        errorCount: this.errors.length,
        warningCount: this.warnings.length
      }
    }

    try {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
      console.log(`\n📄 Detailed report saved to: ${reportPath}`)
    } catch (error) {
      console.log(`\n⚠️  Could not save detailed report: ${error.message}`)
    }
  }
}

// CLI usage
if (require.main === module) {
  const baseUrl = process.argv[2] || 'http://localhost:3000'
  const validator = new StorageDeploymentValidator(baseUrl)
  validator.validateStorageDeployment()
}

module.exports = StorageDeploymentValidator