---
"@logosdx/fetch": minor
---

`totalTimeout` bounds the whole call across retries (#151)

- `totalTimeout` (and its `timeout` alias) was cleared when the first attempt settled, so retries ran unbounded (or until `attemptTimeout × maxAttempts` plus backoff when `attemptTimeout` was set). The timer now runs until the call settles, including retries, backoff waits, and the response body read. Slow downloads that used to finish past `totalTimeout` now reject.
- Retry backoff waits end as soon as the call is aborted, so `totalTimeout` or `abort()` during a backoff delay settles the call immediately. After a transport failure it rejects with `aborted: true` (`isTimeout()` for `totalTimeout`, `isCancelled()` for `abort()`, never `isConnectionLost()`); after a non-2xx response it resolves with that response.
- A timeout or abort while reading a 2xx body rejects with `status: 499` (was the response status), so `isTimeout()` / `isCancelled()` classify it and an `attemptTimeout` during the body read is retryable by default.
- A call that fails before fetching (header/param validation, a throwing `beforeRequest` hook) no longer leaves the total timer running to abort a caller-supplied `abortController` later.
- An async `onAfterReq` is now awaited. A slow callback counts against the timeouts, and a rejecting callback rejects the call with its error instead of becoming an unhandled rejection.
