---
type: Domain
description: HTTP client (`FetchEngine`) with resilience policies, plugins, cookie jar, and resolve-on-response error model.
---

# fetch

## What it does

`@logosdx/fetch` is a full-featured HTTP client built around `FetchEngine`. It supports resilience policies (dedupe, caching, rate-limiting, retry), lifecycle hooks, cookie management via `CookieJar`, request/response serialization, method-specific config, and event emission for all lifecycle stages.

## Artifacts

- [`skills/logosdx/references/fetch.md`](../../skills/logosdx/references/fetch.md) — skill reference (1236 LOC) covering plugins, policies, hooks, events

## CLI code

- [`packages/fetch/src/engine/`](../../packages/fetch/src/engine) — `FetchEngine` class, `FetchPromise`, lifecycle types, event map
- [`packages/fetch/src/plugins/`](../../packages/fetch/src/plugins) — `DedupePolicy`, `CachePolicy`, `RateLimitPolicy`, `retryPlugin`, `cookiePlugin`, `CookieJar`, `MemoryAdapter`
- [`packages/fetch/src/options/`](../../packages/fetch/src/options) — `ConfigStore`, engine config and request config types
- [`packages/fetch/src/properties/`](../../packages/fetch/src/properties) — `HeadersManager`, `ParamsManager`, `PropertyStore`
- [`packages/fetch/src/state/`](../../packages/fetch/src/state) — `FetchState`
- [`packages/fetch/src/serializers/`](../../packages/fetch/src/serializers) — `endpointSerializer`, `requestSerializer`
- [`packages/fetch/src/helpers/`](../../packages/fetch/src/helpers) — `FetchError`, `isFetchError`
- [`packages/fetch/src/types.ts`](../../packages/fetch/src/types.ts) — all public type exports, including the `FetchResponse` discriminated union (546 LOC)
- [`packages/fetch/src/index.ts`](../../packages/fetch/src/index.ts) — barrel exports; also creates and exports a default `baseEngine` instance bound to `globalThis.location.origin`

## Docs

- [`docs/packages/fetch/index.md`](../packages/fetch/index.md) — overview
- [`docs/packages/fetch/advanced.md`](../packages/fetch/advanced.md) — advanced patterns (722 LOC)
- [`docs/packages/fetch/configuration.md`](../packages/fetch/configuration.md) — engine config reference
- [`docs/packages/fetch/events.md`](../packages/fetch/events.md) — lifecycle event reference, including `response-4xx`/`response-5xx`
- [`docs/packages/fetch/hooks.md`](../packages/fetch/hooks.md) — request/response hook usage
- [`docs/packages/fetch/plugins.md`](../packages/fetch/plugins.md) — plugin reference (dedupe, cache, rate-limit)
- [`docs/packages/fetch/policies.md`](../packages/fetch/policies.md) — resilience policy docs (1094 LOC)
- [`docs/packages/fetch/requests.md`](../packages/fetch/requests.md) — request patterns
- [`docs/packages/fetch/resilience.md`](../packages/fetch/resilience.md) — retry and circuit breaker docs, including outcome-based retry (`FetchResponse | FetchError`)
- [`packages/fetch/plan.md`](../../packages/fetch/plan.md) — internal design plan (542 LOC)

## Coupling

- Depends on `@logosdx/utils` for `attempt`, flow control, and validation helpers.
- Depends on `@logosdx/observer` for event emission; `FetchEngine` emits typed lifecycle events.
- `@logosdx/react` wraps `FetchEngine` via `createFetchContext` in [`packages/react/src/fetch.ts`](../../packages/react/src/fetch.ts); also exports `useQuery`, `useMutation`, `useAsync`, `createApiHooks`. A change to `FetchResponse`/`FetchError` here forces a matching change to `FetchFailure` in [`packages/react/src/types.ts`](../../packages/react/src/types.ts).
- Tests in [`tests/src/fetch/`](../../tests/src/fetch) cover engine, cookies, policies, serializers, state, adapters; [`tests/src/fetch/engine/plugin-resolution.test.ts`](../../tests/src/fetch/engine/plugin-resolution.test.ts) (5 tests) specifically covers config-key/`plugins` array composition and the construction-time conflict throws.

## Conventions worth knowing

- `FetchEngine` constructor takes a `baseUrl`; all methods (`get`, `post`, `put`, `patch`, `delete`, `head`, `options`) are bound on the default export instance.
- `cookiePlugin` implements RFC 6265-compliant cookie handling added in recent work.
- Resilience policies (`DedupePolicy`, `CachePolicy`, `RateLimitPolicy`) are composable plugins added via `engine.use(plugin)`.
- `FetchResponse<T>` is a discriminated union on `ok` — every completed HTTP exchange resolves this way, including non-2xx status (`ok: false`, `data: unknown`). `FetchError` is transport-only: thrown/rejected iff no usable response exists (abort, timeout, connection lost, parse failure on an `ok: true` body).
- Errors-as-values extends to HTTP outcomes: a non-2xx response is a resolved value, not an exception — callers narrow with `res.ok`, same as they narrow `err` from `attempt()`.
- `FetchError` carries no `data` field or `T` generic (it's transport-only); `step` narrows to `'fetch' | 'parse'` (the `'response'` step was removed) — see [`packages/fetch/src/helpers/fetch-error.ts`](../../packages/fetch/src/helpers/fetch-error.ts).
- Events: `response` fires for every completed exchange regardless of status; `response-4xx`/`response-5xx` fire additionally alongside it for their status ranges; `error` fires only for transport failures and parse-on-`ok:true` (the single `emit('error', ...)` call site is `#handleError` in [`packages/fetch/src/engine/executor.ts`](../../packages/fetch/src/engine/executor.ts)) — a rate-limit reject fires `ratelimit-reject` instead and never reaches `'error'`; `retry` carries an `outcome: FetchResponse | FetchError` field (`RetryEventData` in [`packages/fetch/src/engine/events.ts`](../../packages/fetch/src/engine/events.ts)).
- Rate-limit token waits are abort-aware: `ratelimit-abort` (`RateLimitEventData` in [`packages/fetch/src/engine/events.ts`](../../packages/fetch/src/engine/events.ts)) is a terminal event pairing with `ratelimit-wait`, fired when a request parked waiting for a token has its `AbortController` fire — whether before, during, or after the wait. When that happens, [`packages/fetch/src/plugins/rate-limit.ts`](../../packages/fetch/src/plugins/rate-limit.ts) emits `ratelimit-abort` (carrying `waitTimeMs` as the elapsed wait) and throws a `FetchError` (`status: 499`, `aborted: true`, `method`, `path`, `step: 'fetch'`, `timedOut` reflecting whether `totalTimeout` caused the abort) instead of a bare `Error`. On the synchronous no-wait path, an already-aborted request also skips `bucket.consume(1)` and throws the same aborted `FetchError` rather than spending a live token.
- `retryableStatusCodes` is a second retry trigger evaluated against a resolved `ok: false` response, alongside the transport-error trigger; `shouldRetry(outcome, attempt)` receives either shape and narrows with `isFetchError()` — see [`packages/fetch/src/plugins/retry.ts`](../../packages/fetch/src/plugins/retry.ts) and the default `DEFAULT_RETRY_CONFIG.shouldRetry` in [`packages/fetch/src/helpers/validations.ts`](../../packages/fetch/src/helpers/validations.ts). Exhausted HTTP-status retries resolve `ok: false`; they never convert to a throw.
- `cachePlugin` never writes a non-2xx response to cache ([`packages/fetch/src/plugins/cache.ts`](../../packages/fetch/src/plugins/cache.ts)): the initial store write and SWR background revalidation both skip on `!response.ok`, leaving any existing stale entry untouched. Background revalidation emits `cache-revalidate-error` from three sites: a transport failure (`error` + `outcome`, both the `FetchError`), a non-2xx response (`outcome` only, no `error` key), and a post-revalidation cache-write failure (`error` only, no `outcome` key).
- The `ResiliencePolicy` base class is exported for building custom policies.
- `FetchEngine`'s constructor resolves the plugin set via `#resolvePlugins` in [`packages/fetch/src/engine/index.ts`](../../packages/fetch/src/engine/index.ts): config-key policies (`retry`, `dedupePolicy`, `cachePolicy`, `rateLimitPolicy`, `cookies`, built by the sibling private method `#buildLegacyPlugins`) always install, and `opts.plugins` is additive — it no longer silently drops config-key-derived policies the way the prior `opts.plugins ?? buildLegacyPlugins(opts)` logic did.
- A policy may exist only once: supplying both a config key and its same-name plugin (e.g. `rateLimitPolicy` plus `rateLimitPlugin(...)`), or passing the same policy plugin twice in `plugins`, throws at construction inside `#resolvePlugins`; the check only applies to the five reserved policy names (`retry`, `dedupe`, `cache`, `rate-limit`, `cookies`) — a duplicate non-policy plugin name is not checked.
- `retryPlugin` is the only config-key policy `#buildLegacyPlugins` installs unconditionally (the other four install only when their config key is truthy); a user-supplied `retryPlugin(...)` in `plugins` with no explicit `retry` key replaces that auto-installed default instead of throwing — the sole non-throwing exception to the single-policy rule. `plugins: []` is therefore a no-op for config-key policies, including the default retry plugin.
