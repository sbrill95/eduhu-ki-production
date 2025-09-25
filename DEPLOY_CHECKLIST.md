# 🚀 MANDATORY DEPLOYMENT CHECKLIST

## ⚠️ NEVER DEPLOY WITHOUT THESE CHECKS

### 1. **LOCAL BUILD VERIFICATION (REQUIRED)**
```bash
# MUST pass locally before any commit
npm run build
```
If this fails locally, **IT WILL FAIL on Vercel**. Fix ALL errors first.

### 2. **TYPE CHECKING (REQUIRED)**
```bash
# Quick type verification
npx tsc --noEmit --skipLibCheck
```

### 3. **COMPREHENSIVE VERIFICATION (RECOMMENDED)**
```bash
# Full verification suite
npm run verify-build
```

## 🛑 DEPLOYMENT FAILURE PATTERNS TO AVOID

### Pattern 1: Missing Property Errors
**Symptoms:** `Property 'X' does not exist on type 'Y'`
**Fix:** Always update ENTIRE type chain when adding properties:
1. Function parameter types
2. Interface definitions
3. All usage locations

### Pattern 2: Missing Export Errors
**Symptoms:** `Module has no exported member 'X'`
**Fix:** Verify exports exist before importing:
```bash
# Search for export
grep -n "export.*functionName" src/lib/targetFile.ts
```

### Pattern 3: Import/Export Mismatches
**Symptoms:** `Cannot find module` or type mismatches
**Fix:** Use exact export names, verify paths

## 🎯 GOLDEN RULE

**If `npm run build` fails locally, STOP. Do not commit. Do not push.**

Fix locally first. This prevents wasted time and failed deployments.

## 🔧 Quick Fix Commands

```bash
# Find missing exports
grep -r "import.*{.*}" src/ | grep "@/"

# Check all TypeScript files
find src -name "*.ts" -o -name "*.tsx" | xargs npx tsc --noEmit

# Verify specific module exports
grep -n "export" src/lib/database.ts
```