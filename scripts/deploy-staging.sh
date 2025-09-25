#!/bin/bash

# Staging Deployment Script for eduhu.ki
# Handles storage configuration and deployment validation for staging environment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="/tmp/eduhu-staging-deployment-${TIMESTAMP}.log"

# Environment variables (staging-specific defaults)
ENVIRONMENT=staging
VERCEL_PROJECT_ID=${VERCEL_PROJECT_ID}
VERCEL_ORG_ID=${VERCEL_ORG_ID}
VERCEL_TOKEN=${VERCEL_TOKEN}
STORAGE_PROVIDER=${STORAGE_PROVIDER:-s3}

# Staging-specific settings
STAGING_BRANCH=${STAGING_BRANCH:-develop}
ALLOW_WARNINGS=${ALLOW_WARNINGS:-true}

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] ✅ $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ❌ $1${NC}" | tee -a "$LOG_FILE"
}

# Error handling
cleanup() {
    log "Cleaning up temporary files..."
    # Add cleanup logic here if needed
}

error_exit() {
    log_error "Staging deployment failed: $1"
    cleanup
    if [ "$ALLOW_WARNINGS" != "true" ]; then
        exit 1
    fi
}

# Header
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    eduhu.ki Staging Deployment Script                       ║${NC}"
echo -e "${BLUE}║                         Storage-Enabled Preview                             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo

log "Starting staging deployment..."
log "Environment: $ENVIRONMENT"
log "Storage Provider: $STORAGE_PROVIDER"
log "Branch: $STAGING_BRANCH"
log "Project Root: $PROJECT_ROOT"
log "Log File: $LOG_FILE"

# Check current branch
check_branch() {
    log "Checking current branch..."

    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

    if [ "$CURRENT_BRANCH" != "$STAGING_BRANCH" ]; then
        log_warning "Current branch is '$CURRENT_BRANCH', expected '$STAGING_BRANCH'"
        log "This may be intentional for testing. Continuing..."
    else
        log_success "On correct branch: $STAGING_BRANCH"
    fi
}

# Prerequisites check (more lenient for staging)
check_prerequisites() {
    log "Checking prerequisites..."

    # Check if we're in the right directory
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        error_exit "package.json not found. Please run from project root."
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        error_exit "Node.js is not installed"
    fi

    # Check npm
    if ! command -v npm &> /dev/null; then
        error_exit "npm is not installed"
    fi

    # Check Vercel CLI (install if missing)
    if ! command -v vercel &> /dev/null; then
        log_warning "Vercel CLI not found. Installing..."
        npm install -g vercel
    fi

    # Check required environment variables (more lenient for staging)
    if [ -z "$VERCEL_TOKEN" ]; then
        log_warning "VERCEL_TOKEN environment variable is missing"
        log "You may be prompted to log in to Vercel"
    fi

    log_success "Prerequisites check completed"
}

# Validate storage configuration (more lenient for staging)
validate_storage_config() {
    log "Validating staging storage configuration..."

    case $STORAGE_PROVIDER in
        s3)
            # Check for staging-specific bucket
            BUCKET_NAME=${AWS_S3_BUCKET_NAME:-eduhu-files-staging}
            if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
                log_warning "AWS S3 environment variables are missing. Staging may use local storage fallback."
            else
                log_success "AWS S3 configuration found for staging"
                log "Bucket: $BUCKET_NAME"
            fi
            ;;
        r2)
            # Check for staging-specific bucket
            BUCKET_NAME=${R2_BUCKET_NAME:-eduhu-files-staging}
            if [ -z "$R2_ACCESS_KEY_ID" ] || [ -z "$R2_SECRET_ACCESS_KEY" ] || [ -z "$R2_ACCOUNT_ID" ]; then
                log_warning "CloudFlare R2 environment variables are missing. Staging may use local storage fallback."
            else
                log_success "CloudFlare R2 configuration found for staging"
                log "Bucket: $BUCKET_NAME"
            fi
            ;;
        local)
            log_success "Using local storage for staging (development mode)"
            ;;
        *)
            log_warning "Unknown storage provider: $STORAGE_PROVIDER. Using fallback."
            ;;
    esac
}

# Build the application (with more relaxed error handling)
build_application() {
    log "Building staging application..."

    cd "$PROJECT_ROOT"

    # Install dependencies
    log "Installing dependencies..."
    npm ci

    # Run type checking (warnings allowed)
    log "Running type checking..."
    if npx tsc --noEmit; then
        log_success "Type checking passed"
    else
        log_warning "Type checking had issues, but continuing for staging"
    fi

    # Run linting (warnings allowed)
    log "Running linter..."
    if npm run lint; then
        log_success "Linting passed"
    else
        log_warning "Linting had issues, but continuing for staging"
    fi

    # Run tests (failures allowed in staging)
    log "Running tests..."
    if npm run test:unit 2>/dev/null || npm test 2>/dev/null; then
        log_success "Tests passed"
    else
        log_warning "Some tests failed, but continuing with staging deployment"
    fi

    # Build the application
    log "Building Next.js application..."
    if npm run build; then
        log_success "Application build completed"
    else
        log_error "Build failed"
        if [ "$ALLOW_WARNINGS" != "true" ]; then
            exit 1
        fi
    fi
}

# Deploy to Vercel (staging/preview)
deploy_to_vercel() {
    log "Deploying to Vercel (staging)..."

    cd "$PROJECT_ROOT"

    # Set environment variables for deployment
    if [ -n "$VERCEL_ORG_ID" ]; then
        export VERCEL_ORG_ID="$VERCEL_ORG_ID"
    fi
    if [ -n "$VERCEL_PROJECT_ID" ]; then
        export VERCEL_PROJECT_ID="$VERCEL_PROJECT_ID"
    fi

    # Deploy to staging (preview)
    log "Executing Vercel preview deployment..."

    DEPLOY_ARGS=""
    if [ -n "$VERCEL_TOKEN" ]; then
        DEPLOY_ARGS="--token=$VERCEL_TOKEN"
    fi

    if vercel $DEPLOY_ARGS --yes; then
        log_success "Vercel staging deployment completed"
    else
        error_exit "Vercel staging deployment failed"
        if [ "$ALLOW_WARNINGS" != "true" ]; then
            exit 1
        fi
    fi

    # Get staging deployment URL
    if [ -n "$VERCEL_TOKEN" ]; then
        STAGING_URL=$(vercel ls --token="$VERCEL_TOKEN" | grep "https" | head -n 1 | awk '{print $1}')
    else
        log_warning "Cannot determine staging URL without VERCEL_TOKEN"
    fi

    if [ -n "$STAGING_URL" ]; then
        log_success "Staging URL: $STAGING_URL"
        echo "STAGING_URL=$STAGING_URL" >> "$LOG_FILE"
    fi
}

# Validate staging deployment (basic checks)
validate_deployment() {
    log "Validating staging deployment..."

    if [ -z "$STAGING_URL" ]; then
        log_warning "Staging URL not available, skipping deployment validation"
        return
    fi

    # Wait for deployment to be ready
    log "Waiting for deployment to be ready..."
    sleep 15

    # Basic health check
    log "Running basic health check..."
    if command -v curl &> /dev/null; then
        if curl -s "$STAGING_URL/api/health" > /dev/null; then
            log_success "Health endpoint is accessible"
        else
            log_warning "Health endpoint test failed"
        fi
    else
        log_warning "curl not available, skipping health check"
    fi

    # Run staging-specific validation if available
    if [ -f "$SCRIPT_DIR/deployment-validation.js" ]; then
        log "Running deployment validation script..."
        if node "$SCRIPT_DIR/deployment-validation.js" "$STAGING_URL"; then
            log_success "Deployment validation passed"
        else
            log_warning "Deployment validation had issues, but staging deployment may still be functional"
        fi
    fi
}

# Post-deployment tasks for staging
post_deployment() {
    log "Running post-deployment tasks for staging..."

    # Create staging environment summary
    log "Creating staging environment summary..."

    cat > "/tmp/staging-summary-${TIMESTAMP}.txt" << EOF
Staging Deployment Summary
========================

Timestamp: $(date)
Environment: $ENVIRONMENT
Storage Provider: $STORAGE_PROVIDER
Branch: $STAGING_BRANCH (actual: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"))
Commit: $(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

EOF

    if [ -n "$STAGING_URL" ]; then
        echo "Staging URL: $STAGING_URL" >> "/tmp/staging-summary-${TIMESTAMP}.txt"
        echo "Health Check: $STAGING_URL/api/health" >> "/tmp/staging-summary-${TIMESTAMP}.txt"
    fi

    echo "" >> "/tmp/staging-summary-${TIMESTAMP}.txt"
    echo "Storage Configuration:" >> "/tmp/staging-summary-${TIMESTAMP}.txt"
    echo "- Provider: $STORAGE_PROVIDER" >> "/tmp/staging-summary-${TIMESTAMP}.txt"

    case $STORAGE_PROVIDER in
        s3)
            echo "- Bucket: ${AWS_S3_BUCKET_NAME:-eduhu-files-staging}" >> "/tmp/staging-summary-${TIMESTAMP}.txt"
            echo "- Region: ${AWS_S3_REGION:-us-east-1}" >> "/tmp/staging-summary-${TIMESTAMP}.txt"
            ;;
        r2)
            echo "- Bucket: ${R2_BUCKET_NAME:-eduhu-files-staging}" >> "/tmp/staging-summary-${TIMESTAMP}.txt"
            echo "- Account: ${R2_ACCOUNT_ID:-not-configured}" >> "/tmp/staging-summary-${TIMESTAMP}.txt"
            ;;
        local)
            echo "- Local storage (development mode)" >> "/tmp/staging-summary-${TIMESTAMP}.txt"
            ;;
    esac

    log "Staging summary saved to: /tmp/staging-summary-${TIMESTAMP}.txt"

    # Test basic functionality
    log "Testing basic staging functionality..."

    if [ -n "$STAGING_URL" ]; then
        cat > /tmp/staging_test.js << EOF
// Basic staging functionality test
const https = require('https');
const http = require('http');

const testStagingEndpoints = async (baseUrl) => {
    const endpoints = [
        { path: '/', name: 'Home page' },
        { path: '/api/health', name: 'Health API' },
    ];

    for (const endpoint of endpoints) {
        try {
            const url = new URL(endpoint.path, baseUrl);
            const client = url.protocol === 'https:' ? https : http;

            await new Promise((resolve, reject) => {
                const req = client.get(url, (res) => {
                    if (res.statusCode >= 200 && res.statusCode < 400) {
                        console.log('✅', endpoint.name, 'accessible');
                        resolve();
                    } else {
                        console.log('⚠️', endpoint.name, 'returned', res.statusCode);
                        resolve(); // Don't fail staging for this
                    }
                });
                req.on('error', (err) => {
                    console.log('⚠️', endpoint.name, 'failed:', err.message);
                    resolve(); // Don't fail staging for this
                });
                req.setTimeout(5000, () => {
                    req.destroy();
                    console.log('⚠️', endpoint.name, 'timeout');
                    resolve();
                });
            });
        } catch (error) {
            console.log('⚠️', endpoint.name, 'error:', error.message);
        }
    }
};

testStagingEndpoints('$STAGING_URL').then(() => {
    console.log('✅ Basic staging tests completed');
    process.exit(0);
}).catch(error => {
    console.log('⚠️ Staging tests had issues:', error.message);
    process.exit(0); // Don't fail staging deployment
});
EOF

        node /tmp/staging_test.js
        rm -f /tmp/staging_test.js
    fi

    log_success "Post-deployment tasks completed"
}

# Main execution flow
main() {
    log "═══════════════════════════════════════════════════════════════════════════════"
    log "                           STAGING DEPLOYMENT STARTING"
    log "═══════════════════════════════════════════════════════════════════════════════"

    check_branch
    check_prerequisites
    validate_storage_config
    build_application
    deploy_to_vercel
    validate_deployment
    post_deployment

    log "═══════════════════════════════════════════════════════════════════════════════"
    log_success "                      STAGING DEPLOYMENT COMPLETED"
    log "═══════════════════════════════════════════════════════════════════════════════"

    echo
    echo -e "${GREEN}🎉 Staging deployment completed!${NC}"
    echo -e "${BLUE}📋 Log file: $LOG_FILE${NC}"

    if [ -n "$STAGING_URL" ]; then
        echo -e "${BLUE}🌐 Staging URL: $STAGING_URL${NC}"
        echo -e "${BLUE}🔍 Health Check: $STAGING_URL/api/health${NC}"
    fi

    echo -e "${YELLOW}💡 Note: This is a staging deployment. Use deploy-production.sh for production.${NC}"
    echo
}

# Execute main function
main "$@"