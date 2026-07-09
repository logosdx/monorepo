---
"@logosdx/fetch": major
"@logosdx/react": major
---

## Breaking Changes

### Non-2xx responses resolve instead of throwing

`FetchEngine` no longer throws/rejects on a non-2xx status. Every completed exchange
resolves as a `FetchResponse` discriminated union on `ok`; narrow on `res.ok` before
reading `data` as `T`.

**Before:**

```ts
const [user, err] = await attempt(() => api.get<User>(`/users/${id}`));
if (err) return handleError(err); // ran for both transport AND 404/500
console.log(user.name);
```

**After:**

```ts
const [res, err] = await attempt(() => api.get<User>(`/users/${id}`));
if (err) return handleError(err); // transport-only: abort, timeout, parse-on-ok:true
if (!res.ok) return handleHttpError(res.status, res.data);
console.log(res.data.name);
```

Anything that counts thrown errors — `composeFlow`'s `circuitBreaker`, external retry
wrappers, `catch`-based failure counters — no longer sees HTTP failures. Throw on
`!res.ok` inside the wrapped function if a non-2xx should count as a failure.

### `FetchError` is transport-only

`FetchError` drops its `data` field and `T` generic — it's never an HTTP status error
anymore. `step` narrows to `'fetch' | 'parse'` (the `'response'` step is gone).

### `shouldRetry` receives `FetchResponse | FetchError`

`retryableStatusCodes` is now a second retry trigger, evaluated against a resolved
`ok: false` response. `shouldRetry(outcome)` receives either shape — discriminate with
`isFetchError(outcome)`. Exhausted HTTP-status retries resolve (`ok: false`), they don't
throw.

### Events: `response` fires for every status; `error` narrows to transport

* `response` fires for every completed exchange, any status.
* `response-4xx` / `response-5xx` fire additionally for their status ranges.
* `error` fires only for transport failures, parse-on-`ok:true`, and rate-limit reject.
* `retry` carries whichever outcome triggered it (`FetchResponse | FetchError`).
* All fire per attempt, sharing one `requestId` across a retried request's attempts.

### Caching and cookies

* `ok: false` responses are never written to cache — neither the initial store write nor
  SWR background revalidation, which now leaves the existing stale entry untouched.
* `cache-revalidate-error`'s failure cause moved to a new `outcome` field
  (`FetchResponse | FetchError`) — for a non-2xx revalidation there is no `error` key,
  only `outcome`; reading `error.message` there is `undefined`.
* `Set-Cookie` response headers are captured into the cookie jar regardless of status.

### `@logosdx/react`: `error`/`response` state replaced by a `failure` union

`useQuery`, `useMutation`, and `createFetchContext` expose one `failure` field in place
of the old `FetchError`-only `error` state:

```ts
type FetchFailure<T> =
    | { kind: 'transport'; error: FetchError }
    | { kind: 'http'; response: Extract<FetchResponse<T>, { ok: false }> };
```

`useMutation`'s `mutate()` never rejects — `Promise<T | undefined>`, resolving
`undefined` on any failure; read `failure` for why. `useAsync`'s generic failure state
is `AsyncFailure` (`{ kind: 'rejected' }` for a thrown non-`FetchError`, or
`{ kind: 'http' }` for a resolved `ok: false`).

## No migration shim

This is a clean break — there is no `throwHttpErrors`/`validateStatus` config toggle to
opt back into throw-on-status. Update every call site that branches on a caught
non-2xx error to branch on `res.ok` instead.
