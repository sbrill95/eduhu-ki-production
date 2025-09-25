# S3 Storage Implementation

## Overview

This document describes the S3 storage adapter implementation for the eduhu.ki educational platform. The implementation provides cloud storage functionality using AWS S3, with automatic fallback to local storage for development environments.

## Architecture

### Core Components

1. **S3StorageAdapter Class** - Main implementation of cloud storage operations
2. **Storage Factory** - Automatically selects between S3 and local storage
3. **Integration Layer** - Seamlessly integrates with existing file upload pipeline
4. **Monitoring API** - Provides storage configuration information

### File Structure

```
src/lib/file-storage.ts          # Core storage implementation
src/app/api/upload/route.ts      # File upload API with S3 integration
src/app/api/storage/info/route.ts # Storage monitoring endpoint
scripts/test-s3-integration.js   # Integration test script
```

## Configuration

### Environment Variables

Add these to your `.env.local` file:

```bash
# AWS S3 Configuration (Server-side only - NEVER expose to client)
AWS_ACCESS_KEY_ID=your-aws-access-key-id-here
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key-here
AWS_S3_BUCKET_NAME=your-s3-bucket-name-here
AWS_S3_REGION=us-east-1
```

### AWS IAM Permissions

Your AWS IAM user needs these S3 permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:HeadObject"
            ],
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::your-bucket-name"
        }
    ]
}
```

## Features

### 1. Automatic Storage Selection

The system automatically chooses between S3 and local storage:

```typescript
// Automatically uses S3 if configured, falls back to local storage
const fileUrl = await saveFileToCloudStorage(file, filename)
```

### 2. File Organization

S3 files are organized with a hierarchical structure:

```
bucket/
├── uploads/
│   └── 2025/
│       └── 01/
│           └── filename.ext
├── thumbnails/
│   └── 2025/
│       └── 01/
│           └── filename_thumb.jpg
└── temp/
    └── temporary-files
```

### 3. Comprehensive Error Handling

- Network error detection
- Access permission validation
- Bucket existence verification
- Automatic fallback mechanisms

### 4. Performance Features

- Signed URLs for secure file access
- Presigned upload URLs for direct client uploads
- Optimized thumbnail storage
- Proper caching headers

## Usage

### Basic File Upload

```typescript
import { saveFileToCloudStorage } from '@/lib/file-storage'

// Automatically uses S3 if configured, local storage otherwise
const fileUrl = await saveFileToCloudStorage(file, 'unique-filename.jpg')
```

### Storage Information

```typescript
import { getStorageInfo } from '@/lib/file-storage'

const info = getStorageInfo()
console.log(`Using ${info.type} storage`) // 's3' or 'local'
```

### Direct S3 Operations

```typescript
import { S3StorageAdapter } from '@/lib/file-storage'

const s3 = new S3StorageAdapter()

if (s3.isConfigured()) {
    // Upload file
    const fileUrl = await s3.saveFile(file, filename)

    // Generate signed URL
    const signedUrl = await s3.generateSignedUrl(filename, 3600)

    // Delete file
    const deleted = await s3.deleteFile(filename)
}
```

## API Endpoints

### File Upload

```http
POST /api/upload
Content-Type: multipart/form-data

Parameters:
- file: File to upload
- teacherId: ID of the teacher uploading
- sessionId: (optional) Chat session ID
- messageId: (optional) Message ID
```

### Storage Info

```http
GET /api/storage/info

Response:
{
  "success": true,
  "storage": {
    "type": "s3",
    "configured": true,
    "details": {
      "bucket": "eduhu-files",
      "region": "us-east-1"
    }
  }
}
```

## Integration with InstantDB

The S3 adapter integrates seamlessly with the existing InstantDB schema:

```typescript
// File upload record in database
const fileUpload = {
  teacher_id: teacherId,
  session_id: sessionId,
  filename: uniqueFilename,
  original_filename: file.name,
  file_type: file.type,
  file_size: file.size,
  file_url: s3FileUrl,  // S3 URL or local URL
  thumbnail_url: thumbnailUrl,
  created_at: Date.now(),
  processing_status: 'pending'
}
```

## Multi-Session Chat Integration

Files uploaded through the S3 adapter maintain full integration with the multi-session chat architecture:

1. **Session Context**: Files are linked to specific chat sessions
2. **Teacher Memory**: File metadata is preserved in teacher memory
3. **Cross-Session Access**: Files can be referenced across different chat sessions
4. **AI Integration**: Extracted text from files is available for AI processing

## Testing

### Integration Test Script

Run the integration test to verify configuration:

```bash
node scripts/test-s3-integration.js
```

### Manual Testing

1. Configure S3 credentials in `.env.local`
2. Start the development server: `npm run dev`
3. Upload a file through the web interface
4. Check the S3 bucket for the uploaded file
5. Verify thumbnail generation (for images)

### Unit Tests

```bash
npm test -- src/lib/__tests__/file-storage.test.ts
```

## Production Deployment

### 1. Environment Setup

Set environment variables in your deployment platform:

```bash
AWS_ACCESS_KEY_ID=prod-access-key
AWS_SECRET_ACCESS_KEY=prod-secret-key
AWS_S3_BUCKET_NAME=eduhu-files-production
AWS_S3_REGION=us-east-1
```

### 2. S3 Bucket Configuration

- Create production S3 bucket
- Configure CORS policy for web uploads
- Set up lifecycle policies for old files
- Enable versioning if needed

### 3. CDN Integration (Optional)

Consider CloudFront for better performance:

```typescript
const fileUrl = `https://cdn.yourdomain.com/${s3Key}`
```

## Security Considerations

1. **Credentials**: Never expose AWS credentials to the client
2. **Signed URLs**: Use signed URLs for sensitive content
3. **File Validation**: All files are validated before upload
4. **Access Control**: Files are organized by teacher ID
5. **Content-Type**: Proper MIME type detection and validation

## Performance Optimizations

1. **Parallel Uploads**: Thumbnail generation runs asynchronously
2. **Caching**: Files include proper cache headers
3. **Compression**: JPEG thumbnails use optimal compression
4. **Connection Pooling**: AWS SDK handles connection reuse

## Monitoring and Logging

- Upload success/failure rates
- Processing time metrics
- Storage usage tracking
- Error rate monitoring

## Troubleshooting

### Common Issues

1. **AccessDenied Error**: Check IAM permissions
2. **NoSuchBucket Error**: Verify bucket name and region
3. **NetworkingError**: Check internet connectivity
4. **Local Fallback**: S3 not configured, using local storage

### Debug Mode

Enable debug logging in development:

```bash
DEBUG=aws-sdk node your-script.js
```

## Future Enhancements

1. **Multi-Region Support**: Store files in multiple regions
2. **CDN Integration**: Automatic CloudFront distribution
3. **Advanced Thumbnails**: Video preview generation
4. **Batch Operations**: Bulk file operations
5. **Storage Analytics**: Detailed usage reporting