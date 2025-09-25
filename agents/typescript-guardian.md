# TypeScript Guardian Agent

## Purpose
Prevent deployment failures by systematically checking and fixing TypeScript errors before they reach production.

## Activation Triggers
- Before any commit
- When adding new features
- When modifying interfaces/types
- After large refactoring

## Responsibilities

### 1. **Pre-Commit Validation**
```bash
# Always run these checks
npm run build
npx tsc --noEmit --skipLibCheck
```

### 2. **Type Dependency Chain Verification**
When modifying types/interfaces:
- Trace all dependencies
- Update all related files
- Verify no missing properties
- Check import/export consistency

### 3. **Common Error Pattern Detection**
- Missing exports in database.ts
- Property missing in interfaces
- Import/export mismatches
- Type name conflicts (Chat vs ChatSession)

### 4. **Systematic Fix Approach**
1. **Identify** - Run type checking to find ALL errors
2. **Categorize** - Group by pattern (missing export, property, etc.)
3. **Fix systematically** - Start with interfaces, then functions, then usage
4. **Verify** - Re-run checks after each fix
5. **Test** - Ensure no regressions

## Tools Available
- `scripts/verify-build.js` - Comprehensive verification
- `scripts/fix-common-errors.js` - Error pattern detection
- `DEPLOY_CHECKLIST.md` - Step-by-step guidance

## Success Metrics
- Zero TypeScript compilation errors
- All imports resolve correctly
- Local build matches Vercel build
- No deployment failures due to type issues