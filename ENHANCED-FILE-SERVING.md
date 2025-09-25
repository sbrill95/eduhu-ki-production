# Enhanced File Serving API Route

## Overview

The enhanced file serving route (`/api/files/[...path]/route.ts`) provides secure, authenticated file serving with S3 integration and comprehensive analytics logging. It supports both local storage (development) and S3 storage (production) with automatic fallback capabilities.

## Key Features

### 1. **S3 Integration with Local Storage Fallback**
- **Development Mode**: Files are served from local storage (`uploads/` directory)
- **Production Mode**: Files are served from S3 with local storage fallback
- **Automatic Detection**: Uses `createStorageAdapter()` to determine available storage
- **Seamless Fallback**: If S3 is configured but file not found, falls back to local storage

### 2. **Authentication and Authorization**
- **Teacher ID Validation**: Extract teacher ID from query parameters
- **Session Access Control**: Validate session ownership using `validateSessionAccess()`
- **File Ownership Validation**: Check database records to ensure teacher owns the file
- **Security Headers**: Add appropriate security headers for different file types

### 3. **Comprehensive Analytics Logging**
All file access attempts are logged to the `usage_analytics` table with:
- **Successful Access**: File served, response time, storage source, file metadata
- **Failed Access**: Error details, attempted paths, security violations
- **System Errors**: Internal server errors, configuration issues

### 4. **Enhanced Security Measures**
- **Path Traversal Protection**: Prevents `../` and `~` attacks
- **File Type Validation**: MIME type detection and appropriate headers
- **Error Sanitization**: Generic error messages to prevent information leakage
- **Access Logging**: All access attempts logged for security monitoring

### 5. **Production-Ready Features**
- **Response Time Tracking**: Monitor file serving performance
- **Storage Source Headers**: Debug headers showing where files are served from
- **Comprehensive Error Handling**: Graceful degradation when services are unavailable
- **HEAD Request Support**: File metadata without downloading content

## API Usage

### Basic File Access
```
GET /api/files/2024/12/document.pdf
```

### Authenticated Access
```
GET /api/files/2024/12/document.pdf?teacherId=teacher_123
```

### Session-Based Access
```
GET /api/files/2024/12/document.pdf?teacherId=teacher_123&sessionId=session_456
```

### Thumbnail Access
```
GET /api/files/thumbnails/2024/12/image_thumb.jpg
```

### File Metadata (HEAD Request)
```
HEAD /api/files/2024/12/document.pdf?teacherId=teacher_123
```

## Response Headers

### Standard Headers
- `Content-Type`: MIME type based on file extension
- `Content-Length`: File size in bytes
- `Cache-Control`: Caching directives (1 year for static files)
- `Content-Disposition`: Inline for images/PDFs, attachment for others

### Debug Headers
- `X-Served-From`: `local` | `s3` | `unknown` - indicates storage source
- `X-File-Path`: Original file path from request
- `X-Content-Type-Options`: `nosniff` - security header
- `X-Frame-Options`: `DENY` - security header

## Analytics Events

### Event Types Logged
1. **`file_access`**: Successful file serving
2. **`file_access_failed`**: Failed file access (not found, permission denied)
3. **`file_serving_error`**: System-level errors

### Metadata Structure
```json
{
  "file_id": "file_upload_record_id",
  "filename": "original_filename.pdf",
  "file_path": "2024/12/document.pdf",
  "served_from": "local|s3",
  "file_size": 1234567,
  "is_thumbnail": false,
  "response_time_ms": 45,
  "error_message": "File not found" // for failed events
}
```

## Storage Configuration

### Local Storage (Development)
- Files stored in `uploads/` directory
- Organized by date: `uploads/YYYY/MM/filename`
- Thumbnails in `uploads/thumbnails/YYYY/MM/filename`

### S3 Storage (Production)
- Configured via environment variables:
  - `AWS_S3_BUCKET_NAME`
  - `AWS_S3_REGION`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
- Folder structure: `uploads/YYYY/MM/filename`
- Signed URLs for secure access
- Automatic fallback to local storage

## Security Considerations

### Path Traversal Protection
- Rejects paths containing `..` or `~`
- Validates file path structure
- Prevents access to system files

### Access Control
- Teacher can only access their own files
- Session validation for additional security
- Database-backed ownership verification

### Error Handling
- Generic error messages to prevent information disclosure
- Detailed logging for security monitoring
- Graceful degradation when services unavailable

## Error Responses

### 400 Bad Request
- Missing file path
- Invalid file path (path traversal attempt)

### 403 Forbidden
- Unauthorized session access
- File ownership violation
- Access denied

### 404 Not Found
- File not found in both local and S3 storage
- Invalid file path

### 500 Internal Server Error
- Database connection issues
- S3 configuration problems
- System-level errors

## Testing

Use the provided test suite (`test-enhanced-file-route.js`) to verify:
- Security validation
- Authentication flows
- Storage fallback mechanisms
- Error handling
- Analytics logging

```bash
node test-enhanced-file-route.js
```

## Implementation Details

### S3 Integration Flow
1. **Check Local Storage**: Attempt to serve from local storage first
2. **S3 Fallback**: If not found locally and S3 configured, try S3
3. **Generate Signed URL**: Create temporary signed URL for S3 access
4. **Fetch and Serve**: Download from S3 and serve to client
5. **Analytics Logging**: Log access attempt with storage source

### Database Integration
- Query `file_uploads` table for ownership verification
- Log all access attempts to `usage_analytics` table
- Use InstantDB transactions for consistency

### Performance Optimizations
- Response time tracking for monitoring
- Appropriate caching headers
- Efficient error handling
- Background analytics logging (non-blocking)

## Environment Variables

Required for S3 integration:
```env
AWS_S3_BUCKET_NAME=your-bucket-name
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

Optional for local development:
```env
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Production Deployment Checklist

- [ ] S3 bucket configured and accessible
- [ ] AWS credentials set in environment
- [ ] Database schema includes `usage_analytics` table
- [ ] File upload directory has proper permissions
- [ ] Monitoring set up for analytics events
- [ ] Security headers validated
- [ ] Performance benchmarks established