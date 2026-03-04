---
"@logosdx/react": major
---

**BREAKING:** `createFetchContext` hooks now return objects instead of tuples.

**Queries** (`get()`):
- Before: `[cancel, isLoading, response, error]`
- After: `{ data, loading, error, response, refetch, cancel }`
- `data` is unwrapped `T` (no longer need `response.data`)
- `response` provides full `FetchResponse<T>` access (status, headers)
- `isLoading` renamed to `loading`
- Added `refetch()` to re-trigger the query

**Mutations** (`post`, `put`, `del`, `patch`):
- Before: `[trigger, cancel, isLoading, response, error]`
- After: `{ data, loading, error, response, mutate, reset, cancel, called }`
- `trigger()` renamed to `mutate()`, now returns `Promise<T>`
- `data` is unwrapped `T` (no longer need `response.data`)
- `response` provides full `FetchResponse<T>` access (status, headers)
- `isLoading` renamed to `loading`
- Added `reset()` to clear mutation state
- Added `called` boolean to track whether `mutate()` has been invoked

**New types:** `FetchContextQueryResult<T, RH>` and `FetchContextMutationResult<T, RH>` exported from `@logosdx/react`.
