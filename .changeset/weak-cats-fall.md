---
"@logosdx/utils": minor
---

## @logosdx/utils

### Added

- `feat(retry):` Add `throwLastError` option to throw original error instead of `RetryError`
- `feat(retry):` Add `onRetry` callback invoked before each retry attempt with the last error
- `feat(retry):` Add `onRetryExhausted` callback to return fallback values when retries are exhausted
