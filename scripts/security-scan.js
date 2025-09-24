#!/usr/bin/env node

/**
 * Security Scanning Script for eduhu.ki
 * Performs comprehensive security checks before deployment
 */

const fs = require('fs')
const path = require('path')
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

class SecurityScanner {
  constructor() {
    this.errors = []
    this.warnings = []
    this.projectRoot = path.resolve(__dirname, '..')
  }

  async runAllChecks() {
    logHeader('Security Scan Starting')

    try {
      await this.checkEnvironmentVariables()
      await this.checkDependencies()
      await this.scanSourceCode()
      await this.checkFilePermissions()
      await this.validateConfiguration()
      await this.checkSecurityHeaders()

      this.reportResults()

      if (this.errors.length > 0) {
        process.exit(1)
      }
    } catch (error) {
      logError(`Security scan failed: ${error.message}`)
      process.exit(1)
    }
  }

  async checkEnvironmentVariables() {
    logHeader('Checking Environment Variables')

    const envFiles = ['.env.local', '.env.production.example', '.env.example']

    for (const envFile of envFiles) {
      const envPath = path.join(this.projectRoot, envFile)

      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8')

        // Check for potential secrets in env files
        const sensitivePatterns = [
          { pattern: /sk-[a-zA-Z0-9]{20,}/, message: 'OpenAI API key found' },
          { pattern: /password\s*=\s*[^#\n]+/, message: 'Password found' },
          { pattern: /secret\s*=\s*[^#\n]+/, message: 'Secret found' },
          { pattern: /token\s*=\s*[^#\n]+/, message: 'Token found' },
        ]

        sensitivePatterns.forEach(({ pattern, message }) => {
          if (pattern.test(content)) {
            if (envFile === '.env.local') {
              this.warnings.push(`${message} in ${envFile} (OK for development)`)
            } else if (content.includes('your-') || content.includes('-here')) {
              logSuccess(`${envFile}: Template values detected (secure)`)
            } else {
              this.errors.push(`${message} in ${envFile} (should be template)`)
            }
          }
        })

        logSuccess(`Environment file ${envFile} checked`)
      }
    }

    // Check if .env.local is properly gitignored
    const gitignorePath = path.join(this.projectRoot, '.gitignore')
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8')
      if (gitignoreContent.includes('.env')) {
        logSuccess('Environment files are properly gitignored')
      } else {
        this.errors.push('Environment files are not gitignored')
      }
    }
  }

  async checkDependencies() {
    logHeader('Checking Dependencies for Vulnerabilities')

    try {
      // Run npm audit
      execSync('npm audit --audit-level=moderate', {
        stdio: 'pipe',
        cwd: this.projectRoot
      })
      logSuccess('No moderate or high severity vulnerabilities found')
    } catch (error) {
      const output = error.stdout?.toString() || error.stderr?.toString() || ''

      if (output.includes('found') && output.includes('vulnerabilities')) {
        // Parse the audit results
        const lines = output.split('\n')
        const vulnerabilityInfo = lines.find(line => line.includes('vulnerabilities'))

        if (vulnerabilityInfo?.includes('high') || vulnerabilityInfo?.includes('critical')) {
          this.errors.push(`High/Critical vulnerabilities found: ${vulnerabilityInfo}`)
        } else {
          this.warnings.push(`Vulnerabilities found: ${vulnerabilityInfo}`)
        }
      } else {
        this.warnings.push('Unable to check dependencies for vulnerabilities')
      }
    }

    // Check for outdated dependencies
    try {
      execSync('npm outdated', {
        stdio: 'pipe',
        cwd: this.projectRoot
      })
      logSuccess('All dependencies are up to date')
    } catch (error) {
      this.warnings.push('Some dependencies are outdated - consider updating')
    }
  }

  async scanSourceCode() {
    logHeader('Scanning Source Code for Security Issues')

    const sourceFiles = this.getSourceFiles()
    const sensitivePatterns = [
      {
        pattern: /sk-[a-zA-Z0-9]{20,}/g,
        message: 'OpenAI API key hardcoded',
        severity: 'error'
      },
      {
        pattern: /password\s*[:=]\s*['"][^'"]+['"]/gi,
        message: 'Hardcoded password',
        severity: 'error'
      },
      {
        pattern: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
        message: 'Hardcoded API key',
        severity: 'error'
      },
      {
        pattern: /console\.log\(/g,
        message: 'Console.log statement (remove for production)',
        severity: 'warning'
      },
      {
        pattern: /debugger;?/g,
        message: 'Debugger statement',
        severity: 'warning'
      },
      {
        pattern: /alert\(/g,
        message: 'Alert statement',
        severity: 'warning'
      },
      {
        pattern: /eval\(/g,
        message: 'Eval usage (potential security risk)',
        severity: 'error'
      },
      {
        pattern: /innerHTML\s*=\s*[^'"]/g,
        message: 'Direct innerHTML usage (potential XSS risk)',
        severity: 'warning'
      }
    ]

    let issuesFound = 0

    sourceFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8')
      const relativePath = path.relative(this.projectRoot, file)

      sensitivePatterns.forEach(({ pattern, message, severity }) => {
        const matches = content.match(pattern)
        if (matches) {
          const count = matches.length
          const issueMessage = `${relativePath}: ${message} (${count} occurrence${count > 1 ? 's' : ''})`

          if (severity === 'error') {
            this.errors.push(issueMessage)
          } else {
            this.warnings.push(issueMessage)
          }
          issuesFound++
        }
      })
    })

    if (issuesFound === 0) {
      logSuccess('No security issues found in source code')
    } else {
      log(`Found ${issuesFound} potential security issues`)
    }
  }

  async checkFilePermissions() {
    logHeader('Checking File Permissions')

    const sensitiveFiles = [
      '.env.local',
      'package.json',
      'next.config.js',
      'vercel.json'
    ]

    sensitiveFiles.forEach(file => {
      const filePath = path.join(this.projectRoot, file)
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath)
        // Check if file is world-readable (basic check for Unix systems)
        if (process.platform !== 'win32') {
          const mode = stats.mode & parseInt('777', 8)
          if (mode & parseInt('004', 8)) {
            this.warnings.push(`${file} is world-readable`)
          }
        }
        logSuccess(`${file} permissions checked`)
      }
    })
  }

  async validateConfiguration() {
    logHeader('Validating Configuration Files')

    // Check Next.js config
    const nextConfigPath = path.join(this.projectRoot, 'next.config.js')
    if (fs.existsSync(nextConfigPath)) {
      const content = fs.readFileSync(nextConfigPath, 'utf8')

      if (content.includes('poweredByHeader: false')) {
        logSuccess('X-Powered-By header is disabled')
      } else {
        this.warnings.push('Consider disabling X-Powered-By header')
      }

      if (content.includes('Strict-Transport-Security')) {
        logSuccess('HSTS header configured')
      } else {
        this.warnings.push('Consider adding HSTS header')
      }
    }

    // Check Vercel config
    const vercelConfigPath = path.join(this.projectRoot, 'vercel.json')
    if (fs.existsSync(vercelConfigPath)) {
      const content = fs.readFileSync(vercelConfigPath, 'utf8')
      const config = JSON.parse(content)

      if (config.headers && config.headers.length > 0) {
        logSuccess('Security headers configured in Vercel')
      } else {
        this.warnings.push('Consider adding security headers to Vercel config')
      }
    }
  }

  async checkSecurityHeaders() {
    logHeader('Validating Security Headers Configuration')

    const requiredHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
      'Referrer-Policy',
      'Strict-Transport-Security'
    ]

    const nextConfigPath = path.join(this.projectRoot, 'next.config.js')
    if (fs.existsSync(nextConfigPath)) {
      const content = fs.readFileSync(nextConfigPath, 'utf8')

      requiredHeaders.forEach(header => {
        if (content.includes(header)) {
          logSuccess(`${header} header configured`)
        } else {
          this.warnings.push(`${header} header not found`)
        }
      })
    }
  }

  getSourceFiles() {
    const files = []
    const extensions = ['.ts', '.tsx', '.js', '.jsx']

    const walkDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })

      entries.forEach(entry => {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          if (!['node_modules', '.next', '.git', 'dist', 'build'].includes(entry.name)) {
            walkDir(fullPath)
          }
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath)
        }
      })
    }

    walkDir(this.projectRoot)
    return files
  }

  reportResults() {
    logHeader('Security Scan Results')

    if (this.errors.length === 0 && this.warnings.length === 0) {
      logSuccess('🎉 No security issues found!')
      return
    }

    if (this.errors.length > 0) {
      log('\nCRITICAL ISSUES (must fix):', 'red')
      this.errors.forEach(error => logError(error))
    }

    if (this.warnings.length > 0) {
      log('\nWARNINGS (should fix):', 'yellow')
      this.warnings.forEach(warning => logWarning(warning))
    }

    log(`\nSummary: ${this.errors.length} error(s), ${this.warnings.length} warning(s)`)

    if (this.errors.length > 0) {
      log('\n🔒 Fix all critical issues before deploying to production', 'red')
    } else {
      log('\n✅ No critical security issues found', 'green')
    }
  }
}

// Run the security scan
if (require.main === module) {
  const scanner = new SecurityScanner()
  scanner.runAllChecks()
}

module.exports = SecurityScanner