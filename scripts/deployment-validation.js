#!/usr/bin/env node

/**
 * Deployment Validation Script for eduhu.ki
 * Validates deployment health and functionality
 */

const https = require('https')
const http = require('http')
const { URL } = require('url')
const { execSync } = require('child_process')

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

class DeploymentValidator {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl
    this.errors = []
    this.warnings = []
    this.isProduction = baseUrl.includes('vercel.app') || baseUrl.includes('eduhu.ki')
  }

  async validateDeployment() {
    logHeader(`Deployment Validation for ${this.baseUrl}`)

    try {
      await this.checkHealthEndpoint()
      await this.checkCoreRoutes()
      await this.checkPWAFunctionality()
      await this.checkAPIEndpoints()
      await this.checkSecurityHeaders()
      await this.checkPerformance()

      this.reportResults()

      if (this.errors.length > 0) {
        process.exit(1)
      }
    } catch (error) {
      logError(`Deployment validation failed: ${error.message}`)
      process.exit(1)
    }
  }

  async checkHealthEndpoint() {
    logHeader('Checking Health Endpoint')

    try {
      const response = await this.makeRequest('/api/health')

      if (response.statusCode === 200) {
        const healthData = JSON.parse(response.body)

        logSuccess('Health endpoint responding')

        // Validate health response structure
        if (healthData.status === 'healthy') {
          logSuccess('Application reports healthy status')
        } else {
          this.errors.push(`Application reports unhealthy status: ${healthData.status}`)
        }

        // Check services
        if (healthData.services) {
          if (healthData.services.database?.status === 'healthy') {
            logSuccess('InstantDB connection healthy')
          } else {
            this.errors.push('InstantDB connection unhealthy')
          }

          if (healthData.services.ai?.status === 'healthy') {
            logSuccess('OpenAI API connection healthy')
          } else {
            this.errors.push('OpenAI API connection unhealthy')
          }
        }

        // Check environment
        if (this.isProduction && healthData.environment !== 'production') {
          this.warnings.push(`Environment mismatch: expected production, got ${healthData.environment}`)
        }

        // Check version info
        if (healthData.version && healthData.version !== 'development') {
          logSuccess(`Deployment version: ${healthData.version.substring(0, 8)}...`)
        }

      } else {
        this.errors.push(`Health endpoint returned status ${response.statusCode}`)
      }
    } catch (error) {
      this.errors.push(`Health endpoint failed: ${error.message}`)
    }
  }

  async checkCoreRoutes() {
    logHeader('Checking Core Routes')

    const routes = [
      { path: '/', name: 'Home page' },
      { path: '/chat', name: 'Chat page' },
      { path: '/manifest.json', name: 'PWA manifest' },
    ]

    for (const route of routes) {
      try {
        const response = await this.makeRequest(route.path)

        if (response.statusCode === 200) {
          logSuccess(`${route.name} accessible`)

          // Special validation for manifest
          if (route.path === '/manifest.json') {
            const manifest = JSON.parse(response.body)
            if (manifest.name && manifest.start_url) {
              logSuccess('PWA manifest is valid')
            } else {
              this.warnings.push('PWA manifest missing required fields')
            }
          }
        } else {
          this.errors.push(`${route.name} returned status ${response.statusCode}`)
        }
      } catch (error) {
        this.errors.push(`${route.name} failed: ${error.message}`)
      }
    }
  }

  async checkPWAFunctionality() {
    logHeader('Checking PWA Functionality')

    try {
      // Check manifest
      const manifestResponse = await this.makeRequest('/manifest.json')
      if (manifestResponse.statusCode === 200) {
        const manifest = JSON.parse(manifestResponse.body)

        const requiredFields = ['name', 'short_name', 'start_url', 'display', 'theme_color']
        const missingFields = requiredFields.filter(field => !manifest[field])

        if (missingFields.length === 0) {
          logSuccess('PWA manifest has all required fields')
        } else {
          this.warnings.push(`PWA manifest missing: ${missingFields.join(', ')}`)
        }

        // Check icons
        if (manifest.icons && manifest.icons.length > 0) {
          logSuccess(`PWA manifest has ${manifest.icons.length} icons`)
        } else {
          this.warnings.push('PWA manifest has no icons')
        }
      }

      // Check if service worker is registered (would need browser testing)
      // For now, just check if the file exists
      try {
        const swResponse = await this.makeRequest('/sw.js')
        if (swResponse.statusCode === 200) {
          logSuccess('Service worker file accessible')
        } else {
          this.warnings.push('Service worker file not found')
        }
      } catch (error) {
        this.warnings.push('Service worker check failed')
      }

    } catch (error) {
      this.warnings.push(`PWA functionality check failed: ${error.message}`)
    }
  }

  async checkAPIEndpoints() {
    logHeader('Checking API Endpoints')

    const apiEndpoints = [
      { path: '/api/health', name: 'Health API' },
      { path: '/api/monitor', name: 'Monitoring API' },
    ]

    for (const endpoint of apiEndpoints) {
      try {
        const response = await this.makeRequest(endpoint.path)

        if (response.statusCode === 200) {
          logSuccess(`${endpoint.name} responding`)

          // Try to parse JSON response
          try {
            JSON.parse(response.body)
            logSuccess(`${endpoint.name} returns valid JSON`)
          } catch (error) {
            this.warnings.push(`${endpoint.name} returns invalid JSON`)
          }
        } else {
          this.errors.push(`${endpoint.name} returned status ${response.statusCode}`)
        }
      } catch (error) {
        this.errors.push(`${endpoint.name} failed: ${error.message}`)
      }
    }

    // Test chat API with a simple request (if in development)
    if (!this.isProduction) {
      try {
        const chatResponse = await this.makeRequest('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'test' })
        })

        // Note: This might fail if OpenAI key is not configured, which is OK for validation
        if (chatResponse.statusCode === 200 || chatResponse.statusCode === 500) {
          logSuccess('Chat API endpoint accessible')
        } else {
          this.warnings.push(`Chat API returned unexpected status: ${chatResponse.statusCode}`)
        }
      } catch (error) {
        this.warnings.push('Chat API test failed (may be due to missing API key)')
      }
    }
  }

  async checkSecurityHeaders() {
    logHeader('Checking Security Headers')

    const requiredHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
      'Referrer-Policy'
    ]

    try {
      const response = await this.makeRequest('/')

      requiredHeaders.forEach(header => {
        const headerKey = header.toLowerCase()
        if (response.headers[headerKey]) {
          logSuccess(`${header} header present`)
        } else {
          this.warnings.push(`${header} header missing`)
        }
      })

      // Check HTTPS in production
      if (this.isProduction && !this.baseUrl.startsWith('https://')) {
        this.errors.push('Production deployment should use HTTPS')
      }

      // Check HSTS header in production
      if (this.isProduction) {
        const hstsHeader = response.headers['strict-transport-security']
        if (hstsHeader) {
          logSuccess('HSTS header present')
        } else {
          this.warnings.push('HSTS header missing in production')
        }
      }

    } catch (error) {
      this.warnings.push(`Security headers check failed: ${error.message}`)
    }
  }

  async checkPerformance() {
    logHeader('Checking Performance')

    try {
      const startTime = Date.now()
      const response = await this.makeRequest('/')
      const responseTime = Date.now() - startTime

      if (responseTime < 1000) {
        logSuccess(`Home page response time: ${responseTime}ms`)
      } else if (responseTime < 3000) {
        logWarning(`Home page response time: ${responseTime}ms (could be better)`)
      } else {
        this.warnings.push(`Home page response time: ${responseTime}ms (too slow)`)
      }

      // Check for compression
      if (response.headers['content-encoding']) {
        logSuccess(`Content compression enabled: ${response.headers['content-encoding']}`)
      } else {
        this.warnings.push('Content compression not detected')
      }

      // Check cache headers
      const cacheControl = response.headers['cache-control']
      if (cacheControl) {
        logSuccess(`Cache-Control header present: ${cacheControl}`)
      } else {
        this.warnings.push('Cache-Control header missing')
      }

    } catch (error) {
      this.warnings.push(`Performance check failed: ${error.message}`)
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
        timeout: 10000, // 10 second timeout
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
            body
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

  reportResults() {
    logHeader('Deployment Validation Results')

    if (this.errors.length === 0 && this.warnings.length === 0) {
      logSuccess('🎉 Deployment validation passed!')
      return
    }

    if (this.errors.length > 0) {
      log('\nCRITICAL ISSUES:', 'red')
      this.errors.forEach(error => logError(error))
    }

    if (this.warnings.length > 0) {
      log('\nWARNINGS:', 'yellow')
      this.warnings.forEach(warning => logWarning(warning))
    }

    log(`\nSummary: ${this.errors.length} error(s), ${this.warnings.length} warning(s)`)

    if (this.errors.length > 0) {
      log('\n🚫 Deployment validation failed', 'red')
    } else {
      log('\n✅ Deployment validation passed with warnings', 'yellow')
    }
  }
}

// CLI usage
if (require.main === module) {
  const baseUrl = process.argv[2] || 'http://localhost:3000'
  const validator = new DeploymentValidator(baseUrl)
  validator.validateDeployment()
}

module.exports = DeploymentValidator