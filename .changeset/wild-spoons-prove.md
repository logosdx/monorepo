---
"@logosdx/fetch": major
---

## Breaking Changes to Retry Configuration

### Simplified `retryConfig` API

- **`retryConfig` can now be set to `false`** to disable retries entirely (previously required `maxAttempts: 0`)
- **`baseDelay` is now only a `number`** - removed function signature `(error: FetchError, attempt: number) => number`
  - Custom delay logic should now be handled through the `shouldRetry` function
  - `baseDelay` is used for exponential backoff calculations when `shouldRetry` returns `true`

### Enhanced `shouldRetry` Behavior

The `shouldRetry` function now has full control over retry delays:
- Return `true` to retry with default exponential backoff (using `baseDelay`)
- Return `false` to stop retrying
- Return a `number` (milliseconds) to specify an exact delay, overriding exponential backoff

### Migration Guide

**Before:**
```typescript
// Disable retries
new FetchEngine({
    retryConfig: { maxAttempts: 0 }
})

// Custom delay function
new FetchEngine({
    retryConfig: {
        baseDelay: (error, attempt) => attempt * 1000
    }
})
```

**After:**
```typescript
// Disable retries
new FetchEngine({
    retryConfig: false
})

// Custom delay through shouldRetry
new FetchEngine({
    retryConfig: {
        baseDelay: 1000,
        shouldRetry: (error, attempt) => attempt * 1000
    }
})
```
