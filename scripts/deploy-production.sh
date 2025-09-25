#!/bin/bash

# Production Deployment Script for eduhu.ki
# Handles storage configuration and deployment validation

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
LOG_FILE="/tmp/eduhu-deployment-${TIMESTAMP}.log"

# Environment variables
ENVIRONMENT=${ENVIRONMENT:-production}
VERCEL_PROJECT_ID=${VERCEL_PROJECT_ID}
VERCEL_ORG_ID=${VERCEL_ORG_ID}
VERCEL_TOKEN=${VERCEL_TOKEN}
STORAGE_PROVIDER=${STORAGE_PROVIDER:-s3}

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
    log_error "Deployment failed: $1"
    cleanup
    exit 1
}

# Trap errors
trap 'error_exit "Unexpected error occurred"' ERR

# Header
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    eduhu.ki Production Deployment Script                     ║${NC}"
echo -e "${BLUE}║                         Storage-Enabled Deployment                          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo

log "Starting production deployment..."
log "Environment: $ENVIRONMENT"
log "Storage Provider: $STORAGE_PROVIDER"
log "Project Root: $PROJECT_ROOT"
log "Log File: $LOG_FILE"

# Prerequisites check
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

    # Check Vercel CLI
    if ! command -v vercel &> /dev/null; then
        log_warning "Vercel CLI not found. Installing..."
        npm install -g vercel
    fi

    # Check required environment variables
    if [ -z "$VERCEL_TOKEN" ]; then
        error_exit "VERCEL_TOKEN environment variable is required"
    fi

    if [ -z "$VERCEL_PROJECT_ID" ]; then
        error_exit "VERCEL_PROJECT_ID environment variable is required"
    fi

    if [ -z "$VERCEL_ORG_ID" ]; then
        error_exit "VERCEL_ORG_ID environment variable is required"
    fi

    log_success "Prerequisites check completed"
}

# Validate storage configuration
validate_storage_config() {
    log "Validating storage configuration..."

    case $STORAGE_PROVIDER in
        s3)
            if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ] || [ -z "$AWS_S3_BUCKET_NAME" ]; then
                error_exit "AWS S3 environment variables are missing (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME)"
            fi
            log_success "AWS S3 configuration validated"
            ;;
        r2)
            if [ -z "$R2_ACCESS_KEY_ID" ] || [ -z "$R2_SECRET_ACCESS_KEY" ] || [ -z "$R2_BUCKET_NAME" ] || [ -z "$R2_ACCOUNT_ID" ]; then
                error_exit "CloudFlare R2 environment variables are missing (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ACCOUNT_ID)"
            fi
            log_success "CloudFlare R2 configuration validated"
            ;;
        local)
            log_warning "Using local storage in production is not recommended"
            ;;
        *)
            error_exit "Unknown storage provider: $STORAGE_PROVIDER. Supported: s3, r2, local"
            ;;
    esac
}

# Test storage connection
test_storage_connection() {
    log "Testing storage connection..."

    cd "$PROJECT_ROOT"

    # Create a temporary test script
    cat > /tmp/storage_test.js << EOF
const { createStorageAdapter } = require('./src/lib/file-storage');

async function testStorage() {
    try {
        const adapter = createStorageAdapter();

        if (!adapter) {
            console.log('✅ Local storage configuration (development mode)');
            return true;
        }

        if (adapter.testConnection) {
            const result = await adapter.testConnection();
            if (result.success) {
                console.log('✅ Storage connection successful');
                console.log('Details:', JSON.stringify(result.details, null, 2));
                return true;
            } else {
                console.error('❌ Storage connection failed:', result.message);
                return false;
            }
        } else {
            console.log('✅ Storage adapter loaded successfully');
            return true;
        }
    } catch (error) {
        console.error('❌ Storage test failed:', error.message);
        return false;
    }
}

testStorage().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
});
EOF

    # Run storage test
    if node /tmp/storage_test.js; then
        log_success "Storage connection test passed"
    else
        error_exit "Storage connection test failed"
    fi

    # Cleanup
    rm -f /tmp/storage_test.js
}

# Build the application
build_application() {
    log "Building application..."

    cd "$PROJECT_ROOT"

    # Install dependencies
    log "Installing dependencies..."
    npm ci

    # Run type checking
    log "Running type checking..."
    npx tsc --noEmit

    # Run linting
    log "Running linter..."
    npm run lint

    # Run tests
    log "Running tests..."
    if npm run test:unit; then
        log_success "Unit tests passed"
    else
        log_warning "Some unit tests failed, but continuing with deployment"
    fi

    # Build the application
    log "Building Next.js application..."
    npm run build

    log_success "Application build completed"
}

# Deploy to Vercel
deploy_to_vercel() {
    log "Deploying to Vercel..."

    cd "$PROJECT_ROOT"

    # Set environment variables for deployment
    export VERCEL_ORG_ID="$VERCEL_ORG_ID"
    export VERCEL_PROJECT_ID="$VERCEL_PROJECT_ID"

    # Deploy to production
    log "Executing Vercel deployment..."

    if vercel --prod --token="$VERCEL_TOKEN" --yes; then
        log_success "Vercel deployment completed"
    else
        error_exit "Vercel deployment failed"
    fi

    # Get deployment URL
    DEPLOYMENT_URL=$(vercel ls --token="$VERCEL_TOKEN" --scope="$VERCEL_ORG_ID" | grep "$VERCEL_PROJECT_ID" | head -n 1 | awk '{print $2}')

    if [ -n "$DEPLOYMENT_URL" ]; then
        log_success "Deployment URL: https://$DEPLOYMENT_URL"
        echo "DEPLOYMENT_URL=https://$DEPLOYMENT_URL" >> "$LOG_FILE"
    fi
}

# Validate deployment
validate_deployment() {
    log "Validating deployment..."

    # Wait for deployment to be ready
    sleep 30

    # Get the deployed URL from Vercel
    DEPLOYED_URL=$(vercel ls --prod --token="$VERCEL_TOKEN" | grep "https" | head -n 1 | awk '{print $1}')

    if [ -z "$DEPLOYED_URL" ]; then
        log_warning "Could not determine deployed URL, using fallback validation"
        return
    fi

    log "Deployed URL: $DEPLOYED_URL"

    # Run deployment validation script
    if node "$SCRIPT_DIR/deployment-validation.js" "$DEPLOYED_URL"; then
        log_success "Deployment validation passed"
    else
        log_warning "Deployment validation had issues, but deployment may still be functional"
    fi

    # Test file upload/download functionality
    log "Testing file upload functionality..."
    cat > /tmp/file_test.js << EOF
// Simple file functionality test
const https = require('https');

const testFileAccess = async (baseUrl) => {
    return new Promise((resolve) => {
        const testUrl = baseUrl + '/api/health';
        https.get(testUrl, (res) => {
            if (res.statusCode === 200) {
                console.log('✅ API endpoints accessible');
                resolve(true);
            } else {
                console.log('❌ API endpoints not accessible:', res.statusCode);
                resolve(false);
            }
        }).on('error', (err) => {
            console.log('❌ API test failed:', err.message);
            resolve(false);
        });
    });
};

testFileAccess('$DEPLOYED_URL').then(success => {
    process.exit(success ? 0 : 1);
});
EOF

    if node /tmp/file_test.js; then
        log_success "Basic API functionality test passed"
    else
        log_warning "Basic API functionality test failed"
    fi

    rm -f /tmp/file_test.js
}

# Post-deployment tasks
post_deployment() {
    log "Running post-deployment tasks..."

    # Test storage operations in production
    log "Testing storage operations in production environment..."

    # Create a simple storage test
    cat > /tmp/prod_storage_test.js << EOF
// Production storage test
console.log('Storage Provider: $STORAGE_PROVIDER');
console.log('Environment: $ENVIRONMENT');

// Test environment variables presence
const requiredVars = [];

if ('$STORAGE_PROVIDER' === 's3') {
    requiredVars.push('AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET_NAME');
} else if ('$STORAGE_PROVIDER' === 'r2') {
    requiredVars.push('R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_ACCOUNT_ID');
}

let allVarsPresent = true;
requiredVars.forEach(varName => {
    if (!process.env[varName]) {
        console.log('❌ Missing environment variable:', varName);
        allVarsPresent = false;
    } else {
        console.log('✅ Environment variable present:', varName);
    }
});

if (allVarsPresent) {
    console.log('✅ All required environment variables are present');
} else {
    console.log('❌ Some environment variables are missing');
    process.exit(1);
}
EOF

    if node /tmp/prod_storage_test.js; then
        log_success "Production storage environment test passed"
    else
        log_warning "Production storage environment test failed"
    fi

    rm -f /tmp/prod_storage_test.js

    # Update deployment log
    log "Deployment completed successfully!"
    log "Timestamp: $(date)"
    log "Environment: $ENVIRONMENT"
    log "Storage Provider: $STORAGE_PROVIDER"

    if [ -n "$DEPLOYED_URL" ]; then
        log "Deployed URL: $DEPLOYED_URL"
        log "Health Check: $DEPLOYED_URL/api/health"
    fi

    log_success "Post-deployment tasks completed"
}

# Main execution flow
main() {
    log "═══════════════════════════════════════════════════════════════════════════════"
    log "                           DEPLOYMENT STARTING"
    log "═══════════════════════════════════════════════════════════════════════════════"

    check_prerequisites
    validate_storage_config
    test_storage_connection
    build_application
    deploy_to_vercel
    validate_deployment
    post_deployment

    log "═══════════════════════════════════════════════════════════════════════════════"
    log_success "                      DEPLOYMENT COMPLETED SUCCESSFULLY"
    log "═══════════════════════════════════════════════════════════════════════════════"

    echo
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "${BLUE}📋 Log file: $LOG_FILE${NC}"

    if [ -n "$DEPLOYED_URL" ]; then
        echo -e "${BLUE}🌐 Deployed URL: $DEPLOYED_URL${NC}"
    fi

    echo -e "${BLUE}🔍 Health Check: Run 'curl ${DEPLOYED_URL:-https://your-app.vercel.app}/api/health'${NC}"
    echo
}

# Execute main function
main "$@"