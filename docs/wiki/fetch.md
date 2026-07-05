---
type: Domain
---

# fetch

## What it does

`@logosdx/fetch` is a full-featured HTTP client built around `FetchEngine`. It supports resilience policies (dedupe, caching, rate-limiting, retry), lifecycle hooks, cookie management via `CookieJar`, request/response serialization, method-specific config, and event emission for all lifecycle stages.

## Artifacts

- [`skills/logosdx/references/fetch.md`](../../skills/logosdx/references/fetch.md) — skill reference (1101 LOC) covering plugins, policies, hooks, events

## CLI code

- [`packages/fetch/src/engine/`](../../packages/fetch/src/engine) — `FetchEngine` class, `FetchPromise`, lifecycle types, event map
- [`packages/fetch/src/plugins/`](../../packages/fetch/src/plugins) — `DedupePolicy`, `CachePolicy`, `RateLimitPolicy`, `retryPlugin`, `cookiePlugin`, `CookieJar`, `MemoryAdapter`
- [`packages/fetch/src/options/`](../../packages/fetch/src/options) — `ConfigStore`, engine config and request config types
- [`packages/fetch/src/properties/`](../../packages/fetch/src/properties) — `HeadersManager`, `ParamsManager`, `PropertyStore`
- [`packages/fetch/src/state/`](../../packages/fetch/src/state) — `FetchState`
- [`packages/fetch/src/serializers/`](../../packages/fetch/src/serializers) — `endpointSerializer`, `requestSerializer`
- [`packages/fetch/src/helpers/`](../../packages/fetch/src/helpers) — `FetchError`, `isFetchError`
- [`packages/fetch/src/types.ts`](../../packages/fetch/src/types.ts) — all public type exports (532 LOC)
- [`packages/fetch/src/index.ts`](../../packages/fetch/src/index.ts) — barrel exports; also creates and exports a default `baseEngine` instance bound to `globalThis.location.origin`

## Docs

- [`docs/packages/fetch/index.md`](../packages/fetch/index.md) — overview
- [`docs/packages/fetch/advanced.md`](../packages/fetch/advanced.md) — advanced patterns (705 LOC)
- [`docs/packages/fetch/configuration.md`](../packages/fetch/configuration.md) — engine config reference
- [`docs/packages/fetch/events.md`](../packages/fetch/events.md) — lifecycle event reference
- [`docs/packages/fetch/hooks.md`](../packages/fetch/hooks.md) — request/response hook usage
- [`docs/packages/fetch/plugins.md`](../packages/fetch/plugins.md) — plugin reference (dedupe, cache, rate-limit)
- [`docs/packages/fetch/policies.md`](../packages/fetch/policies.md) — resilience policy docs (999 LOC)
- [`docs/packages/fetch/requests.md`](../packages/fetch/requests.md) — request patterns
- [`docs/packages/fetch/resilience.md`](../packages/fetch/resilience.md) — retry and circuit breaker docs
- [`packages/fetch/plan.md`](../../packages/fetch/plan.md) — internal design plan (542 LOC)

## Coupling

- Depends on `@logosdx/utils` for `attempt`, flow control, and validation helpers.
- Depends on `@logosdx/observer` for event emission; `FetchEngine` emits typed lifecycle events.
- `@logosdx/react` wraps `FetchEngine` via `createFetchContext` in [`packages/react/src/fetch.ts`](../../packages/react/src/fetch.ts); also exports `useQuery`, `useMutation`, `useAsync`, `createApiHooks`.
- Tests in [`tests/src/fetch/`](../../tests/src/fetch) cover engine, cookies, policies, serializers, state, adapters.

## Conventions worth knowing

- `FetchEngine` constructor takes a `baseUrl`; all methods (`get`, `post`, `put`, `patch`, `delete`, `head`, `options`) are bound on the default export instance.
- `cookiePlugin` implements RFC 6265-compliant cookie handling added in recent work.
- Resilience policies (`DedupePolicy`, `CachePolicy`, `RateLimitPolicy`) are composable plugins added via `engine.use(plugin)`.
- `FetchResponse<T>` wraps raw response — consumers get the typed wrapper, not the raw `Response` object.
- The `ResiliencePolicy` base class is exported for building custom policies.
