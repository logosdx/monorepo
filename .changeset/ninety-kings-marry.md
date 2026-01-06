---
"@logosdx/utils": major
"@logosdx/observer": patch
"@logosdx/fetch": patch
---

**BREAKING**: `RateLimitTokenBucket` constructor now accepts an options object instead of positional arguments.

```ts
// Before
new RateLimitTokenBucket(capacity, refillIntervalMs)

// After
new RateLimitTokenBucket({ capacity, refillIntervalMs })
```

### New Features

- **Persistence support**: Configure `save` and `load` functions to persist rate limiter state to external backends (e.g., Redis)
- **`initialState`**: Restore bucket from a previous state structure
- **`state` getter**: Get the minimal state structure for persistence
- **`isSaveable` getter**: Check if both save and load functions are configured
- **`hasTokens(count?)`**: Check if tokens are available without consuming them
- **`rateLimit()` now accepts a bucket instance**: Pass an existing `RateLimitTokenBucket` via the `bucket` option
- **Auto-persistence in `rateLimit()`**: When using a saveable bucket, automatically calls `load()` before checking and `save()` after consuming
