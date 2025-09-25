# Production Storage Environment Setup Guide
## eduhu.ki Educational Platform

This comprehensive guide covers the complete setup and configuration of production storage environment for the eduhu.ki educational platform, including AWS S3, CloudFlare R2, security, monitoring, and deployment validation.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Storage Provider Options](#storage-provider-options)
4. [AWS S3 Setup](#aws-s3-setup)
5. [CloudFlare R2 Setup](#cloudflare-r2-setup)
6. [Environment Configuration](#environment-configuration)
7. [Security Configuration](#security-configuration)
8. [Deployment Configuration](#deployment-configuration)
9. [Monitoring & Analytics](#monitoring--analytics)
10. [Validation & Testing](#validation--testing)
11. [Troubleshooting](#troubleshooting)
12. [Maintenance](#maintenance)

---

## Overview

The eduhu.ki platform supports multiple cloud storage providers with automatic failover to local storage during development. The storage system includes:

- **File Upload/Download**: Secure file operations with validation
- **Thumbnail Generation**: Automatic thumbnail creation for images
- **Access Control**: Teacher-based file ownership and session validation
- **Monitoring**: Real-time analytics and performance monitoring
- **Security**: CORS policies, rate limiting, and secure file serving

### Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   File Upload   │    │   Storage Layer  │    │  Cloud Storage  │
│      API        │───▶│   (Adapters)     │───▶│  (S3 / R2)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Monitoring    │    │   File Serving   │    │   Local Fallback│
│   & Analytics   │    │      API         │    │   (Development) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

---

## Prerequisites

### System Requirements

- Node.js 18.x or higher
- npm or yarn package manager
- Git for version control

### Account Requirements

- **For AWS S3**: AWS Account with billing enabled
- **For CloudFlare R2**: CloudFlare Account with R2 enabled
- **For Deployment**: Vercel Account (recommended) or similar platform
- **For Monitoring**: Optional - Slack webhook for alerts

### Development Environment

```bash
# Clone the repository
git clone <repository-url>
cd eduhu-test

# Install dependencies
npm install

# Copy environment template
cp .env.development.example .env.local
```

---

## Storage Provider Options

### Comparison

| Feature | AWS S3 | CloudFlare R2 | Local Storage |
|---------|--------|---------------|---------------|
| **Cost** | Usage-based | Lower egress costs | Free (dev only) |
| **Performance** | High | High | Development only |
| **Global CDN** | CloudFront required | Built-in | Not applicable |
| **API Compatibility** | Native S3 | S3-compatible | File system |
| **Recommended For** | Enterprise | Cost-effective | Development |

### Configuration Priority

The storage adapter follows this priority order:

1. **Explicitly configured provider** (via `STORAGE_PROVIDER` env var)
2. **Auto-detected CloudFlare R2** (if credentials available)
3. **Auto-detected AWS S3** (if credentials available)
4. **Local storage fallback** (development only)

---

## AWS S3 Setup

### Step 1: Create S3 Infrastructure

#### Option A: Using CloudFormation (Recommended)

```bash
# Deploy the S3 infrastructure
aws cloudformation deploy \
  --template-file aws-s3-setup.json \
  --stack-name eduhu-storage-production \
  --parameter-overrides \
    EnvironmentName=production \
    ProjectName=eduhu \
  --capabilities CAPABILITY_NAMED_IAM

# Get the outputs
aws cloudformation describe-stacks \
  --stack-name eduhu-storage-production \
  --query 'Stacks[0].Outputs'
```

#### Option B: Manual Setup

1. **Create S3 Bucket**:
   ```bash
   aws s3 mb s3://eduhu-files-production --region us-east-1
   ```

2. **Create IAM User**:
   ```bash
   aws iam create-user --user-name eduhu-app-user-production
   ```

3. **Apply IAM Policy**:
   ```bash
   aws iam put-user-policy \
     --user-name eduhu-app-user-production \
     --policy-name FileStoragePolicy \
     --policy-document file://aws-iam-policies.json
   ```

4. **Create Access Keys**:
   ```bash
   aws iam create-access-key --user-name eduhu-app-user-production
   ```

### Step 2: Configure Bucket Policies

```bash
# Apply bucket policy
aws s3api put-bucket-policy \
  --bucket eduhu-files-production \
  --policy file://bucket-policy.json

# Configure CORS
aws s3api put-bucket-cors \
  --bucket eduhu-files-production \
  --cors-configuration file://cors-config.json

# Configure lifecycle rules
aws s3api put-bucket-lifecycle-configuration \
  --bucket eduhu-files-production \
  --lifecycle-configuration file://lifecycle-config.json
```

### Step 3: Environment Variables

Add to Vercel environment variables:

```bash
# Production environment
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET_NAME=eduhu-files-production
AWS_S3_REGION=us-east-1
STORAGE_PROVIDER=s3
```

---

## CloudFlare R2 Setup

### Step 1: Create R2 Bucket

#### Via CloudFlare Dashboard

1. Navigate to R2 Object Storage
2. Click "Create bucket"
3. Name: `eduhu-files-production`
4. Location: Eastern North America (ENAM)
5. Click "Create bucket"

#### Via Terraform (Recommended)

```hcl
# Use the terraform configuration from cloudflare-r2-setup.json
terraform init
terraform plan -var="cloudflare_api_token=YOUR_TOKEN"
terraform apply
```

### Step 2: Create API Tokens

1. **R2 Token**:
   - Go to R2 dashboard → "Manage R2 API tokens"
   - Click "Create API token"
   - Token name: `eduhu-production-access`
   - Permissions: Read & Write
   - TTL: No expiry
   - Save Access Key ID and Secret Access Key

2. **CloudFlare API Token** (optional, for automation):
   - Go to My Profile → API Tokens
   - Create Custom Token
   - Permissions: Account:Cloudflare R2:Edit
   - Include all zones from account

### Step 3: Configure CORS

```bash
# Using CloudFlare API
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/{account_id}/r2/buckets/eduhu-files-production/cors" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data @cloudflare-cors-config.json
```

### Step 4: Environment Variables

Add to Vercel environment variables:

```bash
# Production environment
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=eduhu-files-production
R2_ACCOUNT_ID=your-account-id
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
STORAGE_PROVIDER=r2
```

---

## Environment Configuration

### Production Environment (`.env.production`)

```bash
# Storage Provider Selection
STORAGE_PROVIDER=s3  # or 'r2' for CloudFlare R2

# AWS S3 Configuration (if using S3)
AWS_ACCESS_KEY_ID=your-production-aws-access-key
AWS_SECRET_ACCESS_KEY=your-production-aws-secret-key
AWS_S3_BUCKET_NAME=eduhu-files-production
AWS_S3_REGION=us-east-1

# CloudFlare R2 Configuration (if using R2)
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=eduhu-files-production
R2_ACCOUNT_ID=your-account-id

# Storage Limits
NEXT_PUBLIC_MAX_FILE_SIZE_MB=10
NEXT_PUBLIC_MAX_FILES_PER_TEACHER=100
MAX_STORAGE_PER_TEACHER_GB=2

# Security Configuration
ALLOWED_FILE_EXTENSIONS=jpg,jpeg,png,gif,webp,pdf,doc,docx,txt,csv,md
CORS_ALLOWED_ORIGINS=https://your-domain.com,https://your-app.vercel.app
FILE_ACCESS_TOKEN_SECRET=your-file-access-token-secret
SIGNED_URL_EXPIRES_MINUTES=60

# Monitoring & Alerts
STORAGE_MONITORING_ENABLED=true
STORAGE_ANALYTICS_ENABLED=true
STORAGE_ALERT_EMAIL=admin@your-domain.com
STORAGE_ALERT_WEBHOOK=https://hooks.slack.com/your-webhook-url

# File Cleanup
FILE_CLEANUP_ENABLED=true
FILE_CLEANUP_INTERVAL_HOURS=24
TEMP_FILE_TTL_HOURS=72
```

### Staging Environment (`.env.staging`)

```bash
# Use staging-specific buckets and settings
STORAGE_PROVIDER=s3
AWS_S3_BUCKET_NAME=eduhu-files-staging
R2_BUCKET_NAME=eduhu-files-staging

# More permissive limits for testing
NEXT_PUBLIC_MAX_FILE_SIZE_MB=25
NEXT_PUBLIC_MAX_FILES_PER_TEACHER=200
MAX_STORAGE_PER_TEACHER_GB=5

# More frequent cleanup
FILE_CLEANUP_INTERVAL_HOURS=12
TEMP_FILE_TTL_HOURS=24
```

### Development Environment (`.env.local`)

```bash
# Use local storage for development
STORAGE_PROVIDER=local

# Optional: Test with cloud storage
# AWS_ACCESS_KEY_ID=your-dev-aws-access-key
# AWS_S3_BUCKET_NAME=eduhu-files-dev

# Generous limits for development
NEXT_PUBLIC_MAX_FILE_SIZE_MB=50
MAX_STORAGE_PER_TEACHER_GB=10

# Disable cleanup for development
FILE_CLEANUP_ENABLED=false
```

---

## Security Configuration

### IAM Policies (AWS S3)

The IAM policy provides minimal required permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::eduhu-files-production",
      "Condition": {
        "StringLike": {
          "s3:prefix": ["uploads/*", "thumbnails/*"]
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::eduhu-files-production/uploads/*",
        "arn:aws:s3:::eduhu-files-production/thumbnails/*"
      ]
    }
  ]
}
```

### CORS Configuration

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": [
        "https://your-domain.com",
        "https://*.vercel.app"
      ],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposedHeaders": ["ETag"],
      "MaxAge": 3600
    }
  ]
}
```

### Content Security Policy

The platform implements CSP headers for file uploads:

```javascript
// In next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; img-src 'self' data: https:; media-src 'self' data: blob:;"
  }
]
```

### File Upload Security

- **File Type Validation**: Only allowed extensions accepted
- **Size Limits**: Configurable per-teacher and per-file limits
- **Path Traversal Protection**: All file paths sanitized
- **Rate Limiting**: Upload frequency limits per teacher
- **Virus Scanning**: Optional integration with cloud scanning services

---

## Deployment Configuration

### Vercel Configuration

Update `vercel.json` for production storage:

```json
{
  "functions": {
    "src/app/api/files/[...path]/route.ts": {
      "maxDuration": 30
    },
    "src/app/api/upload/route.ts": {
      "maxDuration": 60
    }
  },
  "env": {
    "STORAGE_PROVIDER": "s3"
  }
}
```

### CI/CD Pipeline

The enhanced GitHub Actions workflow includes:

1. **Storage Validation**: Tests storage configuration
2. **Environment-Specific Deployment**: Production vs staging buckets
3. **Post-Deployment Validation**: Verifies storage functionality

Key workflow features:

```yaml
# .github/workflows/ci-cd.yml
- name: Test storage integration
  run: node -e "console.log('Storage Provider:', process.env.STORAGE_PROVIDER)"

- name: Validate storage configuration pre-deployment
  run: |
    node -e "
      const { createStorageAdapter } = require('./src/lib/file-storage');
      const adapter = createStorageAdapter();
      console.log('✅ Storage adapter configured');
    "
```

### Deployment Scripts

#### Production Deployment

```bash
# Run production deployment
./scripts/deploy-production.sh

# With custom storage provider
STORAGE_PROVIDER=r2 ./scripts/deploy-production.sh
```

#### Staging Deployment

```bash
# Run staging deployment
./scripts/deploy-staging.sh
```

Both scripts include:
- Storage configuration validation
- Connection testing
- Post-deployment validation
- Rollback capabilities

---

## Monitoring & Analytics

### Storage Monitoring Service

The platform includes comprehensive monitoring:

```javascript
// Automatic monitoring of all storage operations
import { storageMonitoring } from '@/lib/storage-monitoring'

// Manual metric recording
storageMonitoring.recordFileUpload({
  success: true,
  responseTime: 250,
  fileSize: 1024000,
  storageProvider: 's3',
  teacherId: 'teacher-123'
})
```

### Analytics Dashboard

Access storage analytics via:

```bash
# Get analytics data
curl https://your-app.vercel.app/api/storage/analytics

# Get specific time range
curl "https://your-app.vercel.app/api/storage/analytics?timeRange=48"

# Export as CSV
curl "https://your-app.vercel.app/api/storage/analytics?format=csv"
```

### Alerts Configuration

#### Slack Webhooks

```bash
# Environment variable
STORAGE_ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

#### Email Alerts

```bash
# Environment variable
STORAGE_ALERT_EMAIL=admin@your-domain.com
```

Alert triggers:
- Error rate > 5%
- Response time > 5 seconds
- Storage quota > 80%
- Access denied errors
- System failures

### Monitoring Endpoints

- **Health Check**: `/api/health` - Overall system health
- **Storage Info**: `/api/storage/info` - Storage configuration
- **Analytics**: `/api/storage/analytics` - Usage statistics

---

## Validation & Testing

### Deployment Validation

Run comprehensive storage validation:

```bash
# Validate local development
node scripts/validate-storage-deployment.js

# Validate staging
node scripts/validate-storage-deployment.js https://staging.vercel.app

# Validate production
node scripts/validate-storage-deployment.js https://your-app.vercel.app
```

### Validation Checks

The validation script tests:

1. **Storage Configuration**:
   - Provider detection
   - Credential validation
   - Bucket accessibility

2. **API Endpoints**:
   - File serving API
   - Upload API availability
   - Analytics API

3. **Security**:
   - CORS headers
   - Directory traversal protection
   - Authentication requirements

4. **Performance**:
   - Response times
   - Concurrent request handling

5. **File Operations**:
   - Upload validation
   - File serving security
   - Error handling

### Manual Testing

#### Test File Upload

```bash
# Test file upload (requires valid session)
curl -X POST https://your-app.vercel.app/api/upload \
  -F "file=@test-image.jpg" \
  -F "teacherId=test-teacher-id" \
  -F "sessionId=test-session-id"
```

#### Test File Access

```bash
# Test file download
curl "https://your-app.vercel.app/api/files/uploads/2024/01/filename.jpg?teacherId=test-teacher"
```

#### Test Storage Info

```bash
# Get storage configuration
curl https://your-app.vercel.app/api/storage/info

# Test storage connection
curl -X POST https://your-app.vercel.app/api/storage/info \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

## Troubleshooting

### Common Issues

#### 1. Storage Configuration Not Detected

**Symptoms**: Files saved locally instead of cloud storage

**Solutions**:
```bash
# Check environment variables
node -e "console.log(process.env.STORAGE_PROVIDER)"

# Validate storage adapter
curl https://your-app.vercel.app/api/storage/info

# Test connection
curl -X POST https://your-app.vercel.app/api/storage/info -d '{"test":true}'
```

#### 2. Access Denied Errors

**Symptoms**: 403 errors when uploading/accessing files

**AWS S3 Solutions**:
```bash
# Verify bucket policy
aws s3api get-bucket-policy --bucket eduhu-files-production

# Check IAM permissions
aws iam get-user-policy --user-name eduhu-app-user-production --policy-name FileStoragePolicy
```

**CloudFlare R2 Solutions**:
```bash
# Verify API token permissions
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/r2/buckets
```

#### 3. CORS Issues

**Symptoms**: Browser blocks file requests

**Solutions**:
```bash
# Check CORS configuration
aws s3api get-bucket-cors --bucket eduhu-files-production

# Update CORS policy
aws s3api put-bucket-cors --bucket eduhu-files-production --cors-configuration file://cors-config.json
```

#### 4. Performance Issues

**Symptoms**: Slow file uploads/downloads

**Diagnostic Commands**:
```bash
# Check storage performance
node scripts/validate-storage-deployment.js https://your-app.vercel.app

# Monitor analytics
curl "https://your-app.vercel.app/api/storage/analytics?timeRange=1"
```

**Solutions**:
- Enable CDN (CloudFlare for R2 is automatic)
- Optimize file sizes
- Check network connectivity
- Consider regional bucket placement

#### 5. Monitoring Not Working

**Symptoms**: No analytics data or alerts

**Solutions**:
```bash
# Check monitoring configuration
node -e "console.log(require('./src/lib/storage-monitoring').MONITORING_CONFIG)"

# Verify database connections
curl https://your-app.vercel.app/api/health

# Test webhook
curl -X POST WEBHOOK_URL -d '{"text":"Test alert"}'
```

### Debug Mode

Enable detailed logging:

```bash
# Environment variables
DEBUG_STORAGE_OPERATIONS=true
LOG_FILE_ACCESS_ATTEMPTS=true
VERBOSE_ERROR_MESSAGES=true
```

### Health Checks

Regular health monitoring:

```bash
#!/bin/bash
# Health check script

HEALTH_URL="https://your-app.vercel.app/api/health"
STORAGE_URL="https://your-app.vercel.app/api/storage/info"

echo "=== Health Check ==="
curl -s "$HEALTH_URL" | jq '.status'

echo "=== Storage Check ==="
curl -s "$STORAGE_URL" | jq '.configured'

echo "=== Storage Test ==="
curl -s -X POST "$STORAGE_URL" -d '{"test":true}' | jq '.success'
```

---

## Maintenance

### Regular Tasks

#### Daily

- [ ] Monitor health endpoints
- [ ] Check error rates in analytics
- [ ] Verify alert system functionality

#### Weekly

- [ ] Review storage usage statistics
- [ ] Analyze performance metrics
- [ ] Check for security alerts

#### Monthly

- [ ] Update dependencies
- [ ] Review access logs
- [ ] Optimize storage costs
- [ ] Update documentation

### Backup Strategy

#### AWS S3 Backup

```bash
# Enable cross-region replication
aws s3api put-bucket-replication \
  --bucket eduhu-files-production \
  --replication-configuration file://replication-config.json

# Set up lifecycle management
aws s3api put-bucket-lifecycle-configuration \
  --bucket eduhu-files-production \
  --lifecycle-configuration file://lifecycle-config.json
```

#### CloudFlare R2 Backup

```bash
# R2 doesn't have built-in replication, use scheduled backup script
node scripts/backup-r2-files.js
```

### Cost Optimization

#### AWS S3

- Use S3 Intelligent-Tiering
- Implement lifecycle rules
- Monitor data transfer costs
- Consider Reserved Capacity

#### CloudFlare R2

- Leverage free egress
- Use R2's built-in CDN
- Monitor operation costs
- Optimize file structure

### Security Updates

#### Quarterly

- [ ] Rotate access keys
- [ ] Review IAM policies
- [ ] Update CORS configurations
- [ ] Audit file access logs
- [ ] Test disaster recovery

#### Annually

- [ ] Security audit
- [ ] Penetration testing
- [ ] Policy compliance review
- [ ] Documentation updates

### Scaling Considerations

#### High Traffic

- Enable CDN caching
- Implement multi-region deployment
- Use CloudFront with S3
- Consider dedicated upload endpoints

#### High Storage

- Implement data archiving
- Use glacier storage classes
- Optimize file compression
- Consider file deduplication

---

## Support and Resources

### Documentation Links

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [CloudFlare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Next.js File Upload Best Practices](https://nextjs.org/docs/api-routes/introduction)

### Monitoring Tools

- [AWS CloudWatch](https://aws.amazon.com/cloudwatch/)
- [CloudFlare Analytics](https://developers.cloudflare.com/analytics/)
- [Vercel Analytics](https://vercel.com/analytics)

### Emergency Contacts

- **Production Issues**: admin@your-domain.com
- **Storage Alerts**: Slack channel #storage-alerts
- **Emergency Escalation**: On-call rotation

---

## Conclusion

This production storage setup provides:

✅ **Multi-provider support** (AWS S3, CloudFlare R2, local fallback)
✅ **Comprehensive security** (IAM policies, CORS, file validation)
✅ **Real-time monitoring** (analytics, alerts, health checks)
✅ **Automated deployment** (CI/CD integration, validation scripts)
✅ **Production-ready** (scaling, backup, maintenance procedures)

The configuration supports both cost-effective CloudFlare R2 and enterprise-grade AWS S3, with seamless switching between providers based on requirements.

For additional support or configuration assistance, refer to the troubleshooting section or contact the development team.