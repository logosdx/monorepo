---
"@logos-ui/fetch": minor
"@logos-ui/utils": minor
---

Added configurable retry mechanism to FetchEngine:

- Added ability to configure an external abort controller per request

- Added retry configuration with the following options:
  - `maxAttempts`: Maximum number of retry attempts (default: 3)
  - `baseDelay`: Base delay between retries in ms (default: 1000)
  - `maxDelay`: Maximum delay between retries in ms (default: 10000)
  - `useExponentialBackoff`: Whether to use exponential backoff (default: true)
  - `retryableStatusCodes`: Status codes that trigger a retry (default: [408, 429, 499, 500, 502, 503, 504])
  - `shouldRetry`: Custom function to determine if a request should be retried

- Added retry-related features:
  - Exponential backoff with configurable delays
  - Per-request retry configuration override
  - New 'fetch-retry' event emitted before each retry attempt
  - Retry attempt count included in all fetch events
  - Enhanced error handling with attempt tracking

- Enhanced error handling:
  - Added attempt count to FetchError
  - Added step tracking ('fetch', 'parse', 'response') to errors
  - Improved error classification and handling

- Added utility improvements:
  - New attempt/attemptSync helpers for error handling
  - Enhanced error event data with more context

