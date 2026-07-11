---
"@logosdx/fetch": minor
---

Config keys and `plugins` now compose instead of silently replacing each other

Previously, passing any `plugins: [...]` array silently dropped ALL policy config keys — `retry`, `dedupePolicy`, `cachePolicy`, `rateLimitPolicy`, `cookies` — including the default retry plugin that owns `attemptTimeout` firing and the `FetchError.timedOut` stamp. A custom `plugins: [authPlugin()]` alongside `rateLimitPolicy: {...}` left the engine with no rate limiting and no retries, with no warning.

Now:

- Config-key policies always install; the `plugins` array is additive.
- A policy may only exist once: passing both a policy's config key and its plugin, or the same policy plugin twice, throws at construction with a message naming the collision.
- A `retryPlugin(...)` in the array with no explicit `retry` key replaces the auto-installed default (customization, not a conflict).

Behavior change to note: `plugins: []` no longer uninstalls the default retry plugin — it is now a no-op, same as omitting it. To disable retries, use `retry: false` (keeps `attemptTimeout`/`timedOut` machinery, performs no retries).
