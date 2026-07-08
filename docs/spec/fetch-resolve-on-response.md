# Spec: fetch resolve-on-response error model


## Goal


`FetchEngine` resolves every completed HTTP exchange — including non-2xx responses — as a
`FetchResponse`, instead of throwing a `FetchError` for any status outside 2xx. `FetchError`
narrows to transport-only failures (abort, timeout, connection lost, parse failure on a 2xx
body, client-side rate-limit reject).


## Non-goals


- No `throwHttpErrors` / `validateStatus` escape hatch — single contract, no config toggle.
- No caching of `ok: false` responses (HTTP-cacheable 404s may be a later opt-in).
- No change to `.raw()` / `.stream()` semantics (already resolve-on-response).
- No change to rate-limit plugin behavior — client-side reject stays an error.
- No dedicated events for redirect (3xx) or informational (1xx) responses.


## Success criteria


- [ ] A `FetchError` is thrown/rejected **iff** no usable response exists (abort, timeout,
    connection lost, parse failure on `ok: true`, client-side rate-limit reject). Every
    other completed exchange resolves.
- [ ] `FetchResponse` is a discriminated union on `ok`: `{ ok: true, data: T, ... }` vs
    `{ ok: false, data: unknown, ... }`, so a consumer must narrow before reading `data` as
    `T`.
- [ ] Non-2xx responses resolve with the real `status`, `headers` (response headers, not
    request headers), and `data` — nothing is lost or re-derived onto an error object.
- [ ] Parse failure on `ok: false` falls back to raw text in `data` (status is never
    masked by a body-format failure). Parse failure on `ok: true` still raises a
    `FetchError` with `step: 'parse'`.
- [ ] `shouldRetry` is invoked with `FetchResponse | FetchError`; `retryableStatusCodes`
    remains the zero-config default trigger for HTTP-status retries.
- [ ] `ok: false` responses are never cached — neither in the `afterRequest` store write
    nor via SWR background revalidation overwriting good stale data.
- [ ] Set-Cookie response headers are captured into the cookie jar regardless of status.
- [ ] `response` fires for every completed exchange (any status); `response-4xx` /
    `response-5xx` fire additionally for their status ranges; `error` fires only for
    transport failures, parse-on-`ok:true`, and rate-limit reject; all fire per attempt.
- [ ] Every diagnostic event emitted for the same request — across all of its attempts —
    carries the same `requestId`, so a retried request's attempts are traceable as one
    exchange.
- [ ] Dedupe joiners receive `ok: false` responses identically to `ok: true` responses —
    verified, no plugin code change.
- [ ] `useQuery` / `useMutation` / `createFetchContext` expose one discriminated failure
    signal (transport vs HTTP) in place of the current `FetchError`-only error state.
- [ ] Every fetch and react test asserting a throw/rejection on non-2xx status is rewritten
    to assert a resolved `{ ok: false }` response instead; full suites (`pnpm test`) pass.
- [ ] Release ships as a major version bump via changeset (breaking change, no migration
    shim).


## Approach


Resolve-on-response with a discriminated `FetchResponse` union (Approach C) —
see `docs/design/fetch-resolve-on-response.md`.


## Change tree


    packages/fetch/src/
        types.ts                              M (FetchResponse → discriminated union on `ok`)
        helpers/
            fetch-error.ts                     M (FetchError: drop `data`/`T` generic; step narrows to 'fetch' | 'parse')
            validations.ts                     M (DEFAULT_RETRY_CONFIG / retryableStatusCodes wiring for response-based retry)
        engine/
            events.ts                          M (EventMap: + response-4xx, + response-5xx; retry payload union)
            executor.ts                        M (RequestExecutor#executeWithOptions, #handleError: remove ok-throw, build ok discriminant, emit per-attempt diagnostics)
        plugins/
            retry.ts                           M (retryPlugin: second trigger when the response resolves `ok: false`; shouldRetry receives FetchResponse | FetchError)
            cache.ts                           M (cachePlugin afterRequest store + triggerBackgroundRevalidation: ok:false guard)
            dedupe.ts                          — (unchanged; pinning test only)
            cookies/plugin.ts                  — (unchanged; pinning test only)

    packages/react/src/
        types.ts                              M (FetchContextQueryResult / FetchContextMutationResult: error+response → failure union)
        fetch.ts                               M (createFetchContext: query/mutation state → failure union; JSDoc examples)
        api/
            types.ts                           M (QueryResult / MutationResult: error → failure union)
            use-query.ts                       M (failure union in place of FetchError-only error state)
            use-mutation.ts                    M (failure union in place of FetchError-only error state)
            use-async.ts                       M (reconcile generic wrapper's error contract with the failure shape)

    tests/src/fetch/
        engine/
            core.test.ts                       M (non-2xx assertions: throw → resolve)
            response.test.ts                   M (discriminated union coverage)
            integration.test.ts                M
            lifecycle.test.ts                  M
            request-id.test.ts                 M
            streaming.test.ts                  M
            fetch-promise.test.ts              M
        executor/
            retry.test.ts                      M (shouldRetry union shape)
            timeout.test.ts                    M
        policies/
            cache.test.ts                      M (ok:false store + SWR guard pinning)
            dedupe.test.ts                     M (ok:false joiner-sharing pinning)
        cookies/
            plugin.test.ts                     M (Set-Cookie-on-non-2xx pinning)
            response-headers.test.ts           M

    tests/src/react/
        api/
            use-query.test.ts                  M
            use-mutation.test.ts               M
            use-async.test.ts                  M
        fetch.test.ts                          M
        fetch-integration.test.ts              M
        fetch-renders.test.ts                  M

    docs/
        packages/fetch/resilience.md           M
        packages/fetch/configuration.md        M
        packages/fetch/events.md               M
        packages/react.md                      M
        what-is-logosdx.md                     M
        wiki/fetch.md                          M

    skills/logosdx/references/fetch.md         M

    .changeset/fetch-resolve-on-response.md    A (major: @logosdx/fetch, @logosdx/react)


`docs/public/llm/{fetch,react}.md` regenerate automatically from the two reference files
above via `scripts/build-docs.mjs` — not hand-edited.


## Outline


### packages/fetch/src/types.ts

- `FetchResponse` — split into an `ok: true` / `ok: false` discriminated union; `data`
    types as `T` only on the `ok: true` branch.

### packages/fetch/src/helpers/fetch-error.ts

- `FetchError` — drop the `data` field and its `T` generic; `step` narrows to
    `'fetch' | 'parse'`.

### packages/fetch/src/helpers/validations.ts

- `DEFAULT_RETRY_CONFIG` — `retryableStatusCodes` becomes the response-path retry trigger
    alongside the existing error-path `shouldRetry` default.

### packages/fetch/src/engine/events.ts

- `EventMap` — add `response-4xx`, `response-5xx`; widen `retry`'s payload to carry
    `FetchResponse | FetchError`.

### packages/fetch/src/engine/executor.ts

- `RequestExecutor#executeWithOptions` — remove the non-2xx throw; resolve `{ ok, status,
    headers, data }` for every completed exchange; emit `response` (+ `response-4xx` /
    `response-5xx`) per attempt.
    - `#handleError` — drop the step-`'response'` branch (non-2xx no longer routes here);
        stays the transport/parse error path.

### packages/fetch/src/plugins/retry.ts

- `retryPlugin` — second retry trigger, reading a response resolving with `ok: false` against
    `retryableStatusCodes`; `shouldRetry` call site passes `FetchResponse | FetchError`.
- `calculateRetryDelay` — unchanged, referenced from both trigger paths.

### packages/fetch/src/plugins/cache.ts

- `cachePlugin` — `afterRequest` store write skips `ok: false` responses.
    - `triggerBackgroundRevalidation` — skips writing the cache entry when the
        revalidation fetch resolves `ok: false`, preserving the existing stale entry.

### packages/react/src/types.ts

- `FetchContextQueryResult` — `error` + `response` fields replaced by one `failure`
    discriminated union.
- `FetchContextMutationResult` — same replacement.

### packages/react/src/fetch.ts

- `createFetchContext` — query/mutation internal state and JSDoc examples updated to the
    `failure` shape.

### packages/react/src/api/types.ts

- `QueryResult` — `error` replaced by `failure` discriminated union.
- `MutationResult` — same replacement.

### packages/react/src/api/use-query.ts

- `useQuery` — sets `failure` (`{ kind: 'transport', error }` or `{ kind: 'http', response }`)
    instead of `FetchError`-only `error`.

### packages/react/src/api/use-mutation.ts

- `useMutation` — same `failure` shape as `useQuery`.

### packages/react/src/api/use-async.ts

- `useAsync` — reconciles its generic (non-`FetchEngine`-typed) error contract with the
    `QueryResult.failure` shape now required by its shared return type.

### tests/src/fetch/, tests/src/react/

- No new named pieces — each file's throw/reject-on-status assertions are replaced with
    resolve-and-check-`ok` assertions; `retry.test.ts` and `cache.test.ts` gain pinning
    coverage for the union `shouldRetry` and the SWR guard; `dedupe.test.ts` and
    `cookies/plugin.test.ts` gain pinning coverage for joiner-sharing and Set-Cookie
    capture on non-2xx.

### docs/, skills/logosdx/references/fetch.md

- No new named pieces — sections documenting error handling, retry, and events are
    rewritten to the resolve-on-response contract (see Flows below for the shape each
    surface must document).


## Flows


1. **Non-2xx resolve.** Caller → `engine.get(path)` → `RequestExecutor#executeWithOptions`
   fetches, parses the body (fallback to text on parse failure), builds
   `{ ok: response.ok, status, headers, data }` → emits `response` (+ `response-4xx` or
   `response-5xx` when applicable) → resolves the `FetchPromise` → caller narrows on
   `res.ok`.

2. **Transport/parse failure.** Caller → `engine.get(path)` → fetch rejects, or parse
   fails on an `ok: true` body → `#handleError` builds a `FetchError` (`step: 'fetch'` or
   `'parse'`) → emits `error` → rejects the `FetchPromise` → caller's `attempt()` tuple
   receives the error.

3. **Retry-on-response.** `retryPlugin` wraps `execute` → attempt resolves or rejects →
   trigger check: the response resolves with `ok: false` against `retryableStatusCodes`, or a
   rejected `FetchError` against `shouldRetry` → emits `retry` carrying whichever outcome
   triggered it → schedules the next attempt via `calculateRetryDelay` up to `maxAttempts`.

4. **SWR guard.** `cachePlugin`'s stale-key path serves the cached value immediately and
   fires `triggerBackgroundRevalidation` → revalidation fetch resolves → guard checks
   `ok` → `ok: true` writes the fresh entry, `ok: false` leaves the existing stale entry
   untouched and emits `cache-revalidate-error`.

5. **Cookie capture.** Any response (any status) → `afterRequest` cookie hook reads
   `Set-Cookie` via `getSetCookieHeaders(response.headers)` → jar stores the cookies —
   unconditional on `ok`, so 401/403 responses now populate the jar.

6. **React failure union.** `useQuery` / `useMutation` call the engine via `attempt()` →
   error branch sets `failure: { kind: 'transport', error }`; success branch checks
   `response.ok` — `false` sets `failure: { kind: 'http', response }`, `true` clears
   `failure` and sets `data`.


## Checkpoints


| # | Checkpoint | Files/areas | Agent | Est. files | Verifies |
|---|------------|--------------|-------|------------|----------|
| CP-1 | Core engine contract: discriminated `FetchResponse`, slim `FetchError`, new diagnostic events, executor resolve-on-response | `packages/fetch/src/types.ts`, `helpers/fetch-error.ts`, `engine/events.ts`, `engine/executor.ts`, `tests/src/fetch/engine/core.test.ts`, `tests/src/fetch/engine/response.test.ts` | atomic-implementer (mode: feature) | 6 | `pnpm --filter @logosdx/fetch run build`; `pnpm test core`; `pnpm test response` (all green, non-2xx cases resolve, same `requestId` asserted across a retried request's per-attempt events) |
| CP-2 | Retry plugin: response-aware `shouldRetry`, `retryableStatusCodes` trigger | `packages/fetch/src/plugins/retry.ts`, `helpers/validations.ts`, `tests/src/fetch/executor/retry.test.ts` | atomic-implementer (mode: surgical) | 3 | `pnpm --filter @logosdx/fetch run build`; `pnpm test retry` |
| CP-3 | Cache plugin: `ok:false` guard in store write and SWR revalidation | `packages/fetch/src/plugins/cache.ts`, `tests/src/fetch/policies/cache.test.ts` | atomic-implementer (mode: surgical) | 2 | `pnpm --filter @logosdx/fetch run build`; `pnpm test cache` |
| CP-4 | Dedupe + cookies non-2xx pinning (verification only, no src change) | `tests/src/fetch/policies/dedupe.test.ts`, `tests/src/fetch/cookies/plugin.test.ts`, `tests/src/fetch/cookies/response-headers.test.ts` | atomic-implementer (mode: feature) | 3 | `pnpm test dedupe`; `pnpm test cookies` |
| CP-5 | Remaining fetch test conformance + full package suite gate | `tests/src/fetch/engine/{integration,lifecycle,request-id,streaming,fetch-promise}.test.ts`, `tests/src/fetch/executor/timeout.test.ts` | atomic-implementer (mode: feature) | 6 | `pnpm --filter @logosdx/fetch run build`; full `pnpm test` (fetch project, all files) green |
| CP-6 | React failure-union hooks: `useQuery`, `useMutation`, `useAsync`, `createFetchContext` | `packages/react/src/types.ts`, `fetch.ts`, `api/types.ts`, `api/use-query.ts`, `api/use-mutation.ts`, `api/use-async.ts` | atomic-implementer (mode: feature) | 6 | `pnpm --filter @logosdx/fetch run build`; `pnpm --filter @logosdx/react run build` |
| CP-7 | React test conformance + full react suite gate | `tests/src/react/api/{use-query,use-mutation,use-async}.test.ts`, `tests/src/react/fetch.test.ts`, `tests/src/react/fetch-integration.test.ts`, `tests/src/react/fetch-renders.test.ts` | atomic-implementer (mode: feature) | 6 | full `pnpm test` (react project) green |
| CP-8 | Docs surfaces: resilience/configuration/events, wiki, skill reference, react package doc, philosophy page | `skills/logosdx/references/fetch.md`, `docs/packages/fetch/{resilience,configuration,events}.md`, `docs/packages/react.md`, `docs/what-is-logosdx.md`, `docs/wiki/fetch.md` | atomic-implementer (mode: feature) | 7 | `pnpm build:docs` succeeds; examples match the shipped contract |
| CP-9 | Changeset: major bump for `@logosdx/fetch` and `@logosdx/react` | `.changeset/fetch-resolve-on-response.md` | atomic-implementer (mode: surgical) | 1 | `pnpm changeset status` recognizes the entry |


## Risks


| Risk | Likelihood | Mitigation |
|------|------------|------------|
| React failure-union shape (R3) is pending user veto — the design's recommendation, not yet confirmed | Medium | Land CP-6/CP-7 last among the code checkpoints; if vetoed before CP-6 starts, swap in the vetoed shape without touching CP-1–CP-5 |
| SWR revalidation guard missed on one of the two cache write sites, silently caching a transient 500 over good stale data | Low | CP-3's pinning test asserts the stale entry is unchanged after an `ok: false` revalidation fetch |
| Test rewrite across 33 fetch files misses a throw-on-status assertion that then fails at CP-5's full-suite gate | Medium | CP-5's gate is a full-suite run, not a per-file check; any missed file surfaces before the checkpoint closes |
| Major-version ripple breaks downstream consumers relying on the throw-on-non-2xx contract | High (expected) | Non-goal by design — clean break, no escape hatch; communicated via the major changeset |


## Change log
