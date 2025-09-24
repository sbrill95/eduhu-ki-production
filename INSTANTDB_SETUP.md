# InstantDB Real Application Setup - Phase 2A

## URGENT: Manual Setup Required

This guide will walk you through creating a real InstantDB application to replace the current demo-app-id configuration.

## Step 1: Create InstantDB Account & Application

1. **Visit InstantDB Dashboard**: https://www.instantdb.com/dash
2. **Sign Up/Sign In**: Create an account or log into existing account
3. **Create New Application**:
   - Click "Create New App" or similar button
   - Name: `eduhu-ki-production`
   - Description: `PWA for teacher AI assistance`
4. **Copy App ID**: Once created, copy the generated App ID (format: similar to `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

## Step 2: Update Environment Configuration

Replace the current demo-app-id in `.env.local`:

```env
# InstantDB Configuration
# Replace with your actual InstantDB app ID
NEXT_PUBLIC_INSTANTDB_APP_ID=YOUR_REAL_APP_ID_HERE

# OpenAI Configuration (Server-side only - NEVER expose to client)
OPENAI_API_KEY=your-openai-api-key-here
NEXT_PUBLIC_AI_MODEL=gpt-4o-mini
```

## Step 3: Database Schema Setup

### Required Tables:

#### 1. Chats Table
```typescript
{
  id: string (primary key, auto-generated)
  title: string (required)
  created_at: number (timestamp)
  updated_at: number (timestamp)
}
```

#### 2. Messages Table
```typescript
{
  id: string (primary key, auto-generated)
  chat_id: string (foreign key -> chats.id, required)
  content: string (required)
  role: 'user' | 'assistant' (required)
  timestamp: number (required)
}
```

### Schema Creation in InstantDB Dashboard:

1. **Access Schema Section**: In your InstantDB app dashboard, look for "Schema" or "Database Schema"
2. **Create 'chats' Table**:
   - Table name: `chats`
   - Add fields:
     - `id` (string, primary key)
     - `title` (string, required)
     - `created_at` (number)
     - `updated_at` (number)

3. **Create 'messages' Table**:
   - Table name: `messages`
   - Add fields:
     - `id` (string, primary key)
     - `chat_id` (string, required)
     - `content` (string, required)
     - `role` (string, required, enum: 'user' | 'assistant')
     - `timestamp` (number, required)
   - **Set Foreign Key**: `chat_id` references `chats.id`

## Step 4: Test Database Connection

After completing the setup:

1. **Start Development Server**: `npm run dev`
2. **Open Browser**: Navigate to `http://localhost:3001/chat`
3. **Send Test Message**: Try sending a message in the chat
4. **Verify Persistence**:
   - Refresh the page
   - Check if chat history persists
   - Look for any console errors

## Expected Results

✅ **Success Criteria**:
- Chat messages persist across browser refresh
- No "demo-app-id" warnings in console
- Database connection established successfully
- Messages save to InstantDB in real-time

❌ **Failure Indicators**:
- Console errors about invalid app ID
- Messages disappear on page refresh
- Connection timeout errors
- Demo app warnings still appearing

## Troubleshooting

### Common Issues:
1. **Invalid App ID**: Double-check the app ID format and ensure no extra spaces
2. **CORS Issues**: Verify domain whitelist in InstantDB dashboard
3. **Schema Mismatch**: Ensure table names and field types match exactly
4. **Environment Variables**: Restart development server after changing .env.local

### Quick Verification Commands:
```bash
# Check environment variables are loaded
echo $NEXT_PUBLIC_INSTANTDB_APP_ID

# Restart dev server to reload .env.local
npm run dev
```

## Next Steps After Setup

Once the real InstantDB application is working:
1. Phase 2B: Database Integration (75 minutes)
2. Phase 2C: Schema Optimization (40 minutes)
3. Integration testing and deployment preparation

## Support

If you encounter issues:
1. Check InstantDB documentation: https://www.instantdb.com/docs
2. Verify all steps in this guide
3. Check console for specific error messages
4. Ensure development server restart after environment changes