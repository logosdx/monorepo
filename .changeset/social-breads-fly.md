---
"@logosdx/fetch": major
---

**BREAKING CHANGE**: Rename `retryConfig` option to `retry`

- Rename `retryConfig` to `retry` in FetchEngine constructor options
- Rename `retryConfig` to `retry` in FetchConfig and RequestOpts interfaces
- Add support for `retry: true` to enable default retry configuration
- Maintain existing support for `retry: false` to disable retries
- Maintain existing support for `retry: {...}` for custom RetryConfig objects

**Migration:**

```typescript
// Before
const api = new FetchEngine({
    retryConfig: { maxAttempts: 3 }
});

// After
const api = new FetchEngine({
    retry: { maxAttempts: 3 }
    // or retry: true for defaults
    // or retry: false to disable
});
```
