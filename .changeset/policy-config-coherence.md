---
"@logosdx/fetch": minor
"@logosdx/utils": patch
---

Policy config coherence: every config surface now drives the behavior it reports

`@logosdx/fetch`:

- Runtime `engine.config.set()` on a policy key (`retry`, `dedupePolicy`, `cachePolicy`, `rateLimitPolicy`, `cookies`) now actually reconfigures the running policy — previously it updated `config.get()` and response metadata while behavior kept the construction-time values. Validation runs before the store mutates: setting a key owned by a `plugins:`-array plugin throws, changing the cache adapter throws (the adapter is construction-only), and a rejected `set()` — single-key or multi-key merge — commits nothing.
- `attemptTimeout` now fires when retrying is disabled (`retry: false` / `maxAttempts: 0`); previously the zero-attempts path never armed the per-attempt timer, so such requests ran to the endpoint's full latency.
- `clearCache`, `clearCacheKey`, `deleteCache`, `invalidateCache`, `invalidatePath`, and `cacheStats` now work when the cache/dedupe plugin is installed via the `plugins:` array or `engine.use()` — previously they silently no-oped unless the config key was used.
- `res.config.retry` now reports the retry config the request actually ran with (per-call overrides included) instead of the engine-level default, and is typed `Required<RetryConfig>`.
- A falsy explicit policy key (`dedupePolicy: false`) plus the same-name plugin now warns and installs the plugin instead of throwing; truthy key + same-name plugin still throws.

`@logosdx/utils`:

- `PathValue` now distributes over union types, so dotted paths into keys typed like `RetryConfig | false` resolve to the object member's value type instead of `never` — `config.set('retry.maxAttempts', 5)` typechecks again.
