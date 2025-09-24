# eduhu.ki Deployment Guide

## Production Deployment Setup

### Prerequisites
- Vercel CLI installed (`npm i -g vercel`)
- Git repository committed and pushed to GitHub
- OpenAI API key ready
- InstantDB app configured (ID: 39f14e13-9afb-4222-be45-3d2c231be3a1)

### 1. Initial Vercel Setup

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Link project (run from project root)
vercel link

# Set up project
vercel --prod
```

### 2. Environment Variables Configuration

#### Critical Security: Environment Variables Setup

**In Vercel Dashboard:**

1. Go to your project → Settings → Environment Variables
2. Add these variables:

```
Variable Name: OPENAI_API_KEY
Value: sk-your-actual-production-key-here
Environment: Production, Preview
```

```
Variable Name: NEXT_PUBLIC_INSTANTDB_APP_ID
Value: 39f14e13-9afb-4222-be45-3d2c231be3a1
Environment: Production, Preview, Development
```

```
Variable Name: NEXT_PUBLIC_AI_MODEL
Value: gpt-4o-mini
Environment: Production, Preview, Development
```

**Via Vercel CLI:**
```bash
vercel env add OPENAI_API_KEY production
vercel env add NEXT_PUBLIC_INSTANTDB_APP_ID production
vercel env add NEXT_PUBLIC_AI_MODEL production
```

### 3. Deployment Process

#### Automatic Deployment (Recommended)
```bash
# Push to main/master branch triggers automatic deployment
git add .
git commit -m "feat: production deployment configuration"
git push origin main
```

#### Manual Deployment
```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel
```

### 4. Post-Deployment Validation

#### Health Check
```bash
# Check health endpoint
curl https://your-app.vercel.app/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-XX-XXTXX:XX:XX.XXXZ",
  "version": "commit-hash",
  "environment": "production",
  "services": {
    "database": { "status": "healthy" },
    "ai": { "status": "healthy" }
  }
}
```

#### PWA Installation Test
1. Visit your deployed URL in Chrome/Edge
2. Look for "Install App" option in address bar
3. Verify offline functionality works

#### Core Web Vitals Check
```bash
# Run Lighthouse audit
npx lighthouse https://your-app.vercel.app --view

# Target metrics:
# - LCP (Largest Contentful Paint): < 2.5s
# - FID (First Input Delay): < 100ms
# - CLS (Cumulative Layout Shift): < 0.1
```

### 5. Domain Configuration (Optional)

#### Custom Domain Setup
1. Vercel Dashboard → Project → Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. SSL certificate is automatically provided

### 6. Monitoring Setup

#### Vercel Analytics (Built-in)
- Automatically enabled for Core Web Vitals
- View in Vercel Dashboard → Analytics

#### Health Monitoring Script
```bash
# Add to your monitoring system
#!/bin/bash
HEALTH_URL="https://your-app.vercel.app/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "✅ App is healthy"
else
    echo "❌ App health check failed (HTTP $RESPONSE)"
    # Add alerting logic here
fi
```

### 7. Rollback Procedures

#### Via Vercel Dashboard
1. Go to Deployments tab
2. Find previous working deployment
3. Click "Visit" to test
4. Click "Promote to Production" if confirmed working

#### Via CLI
```bash
# List deployments
vercel ls

# Rollback to specific deployment
vercel rollback [deployment-url] --timeout 30s
```

### 8. Security Checklist

- ✅ Environment variables are set as secrets in Vercel
- ✅ HTTPS is enforced (automatic with Vercel)
- ✅ Security headers configured in next.config.js
- ✅ API keys are not exposed to client-side code
- ✅ CORS policies are configured
- ✅ Content Security Policy headers set

### 9. Performance Optimization

#### Vercel Edge Functions
- API routes are automatically optimized
- InstantDB queries use edge functions when possible
- Static assets cached via Vercel CDN

#### Caching Strategy
- Service worker caches app shell and critical resources
- API responses cached appropriately
- Static assets have long-term caching

### 10. Troubleshooting

#### Common Issues
1. **Build Failure**: Check build logs in Vercel dashboard
2. **Environment Variables**: Verify all required vars are set
3. **API Errors**: Check function logs in Vercel dashboard
4. **InstantDB Connection**: Verify app ID in environment variables

#### Debug Commands
```bash
# Check deployment status
vercel inspect [deployment-url]

# View function logs
vercel logs [deployment-url]

# Test local production build
npm run build
npm run start
```

### 11. Maintenance

#### Regular Tasks
- Monitor health endpoint daily
- Check Core Web Vitals weekly
- Review Vercel usage metrics monthly
- Update dependencies monthly
- Security audit quarterly

#### Alerts Setup
Configure monitoring for:
- Health endpoint failures (>1 minute downtime)
- Core Web Vitals degradation (>20% decline)
- High error rates in function logs
- Unusual traffic patterns

---

## Emergency Contacts & Resources

- **Vercel Status**: https://vercel-status.com
- **InstantDB Status**: https://status.instantdb.com
- **OpenAI Status**: https://status.openai.com
- **Health Check**: https://your-app.vercel.app/api/health