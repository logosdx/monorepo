---
"@logosdx/utils": minor
"@logosdx/fetch": minor
---

Rate-limit token waits now observe the request's abort signal (#145)

`@logosdx/utils`:

- New `waitWithAbort()` flow-control helper: a `wait()` whose sleep races an `AbortSignal`, with guaranteed timer/listener cleanup on both outcomes.
- `RateLimitTokenBucket.waitForToken` and `waitAndConsume` settle promptly when the caller's `abortController` fires — before, during, or after the wait — and an aborted caller never consumes a token (including the tokens-available fast path).
- `waitForToken` now resolves `boolean` instead of `void`: `true` = token available, `false` = aborted (do not consume). Existing callers that ignore the return value are unaffected.
- Aborted waits record their elapsed time in bucket stats so `averageWaitTime` stays accurate.

`@logosdx/fetch`:

- A request whose `totalTimeout`/`timeout` fires (or that is manually aborted) while parked in a `rateLimitPolicy` token wait now rejects within milliseconds instead of waiting out the full window, and no longer consumes a token for the dead request.
- The abort path now throws a proper `FetchError` (`status: 499`, `aborted: true`, `timedOut` reflecting whether `totalTimeout` caused it) instead of a bare `Error`.
- New `ratelimit-abort` engine event — the terminal pair of `ratelimit-wait` for aborted waits, carrying the actual waited milliseconds.
