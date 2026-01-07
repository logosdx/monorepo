---
"@logosdx/fetch": minor
---

feat(fetch): add attemptTimeout and totalTimeout for granular retry control

**New timeout options:**
- `totalTimeout` - caps the entire request lifecycle including all retries
- `attemptTimeout` - per-attempt timeout that allows retries to continue

**New FetchError properties and methods:**
- `timedOut` flag distinguishes timeout-caused aborts from manual aborts
- `isCancelled()` - returns true if manually aborted (not timeout)
- `isTimeout()` - returns true if a timeout fired
- `isConnectionLost()` - returns true if server/network dropped the connection

**Deprecation:**
- `timeout` is now an alias for `totalTimeout` (backwards compatible)

This enables scenarios like "retry up to 3 times with 5s per attempt, but cap total time at 30s" which was previously impossible since timeout aborts prevented all retries.
