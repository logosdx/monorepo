---
"@logosdx/fetch": major
---

## Breaking Changes

### `.headers` and `.params` getters now return lowercase method keys

Method keys in the headers/params getters are now normalized to lowercase.

**Before:**
```ts
const { POST: postHeaders } = api.headers;
const { GET: getParams } = api.params;
```

**After:**
```ts
const { post: postHeaders } = api.headers;
const { get: getParams } = api.params;
```

**Migration:** Update any code accessing method-specific headers/params via the getters to use lowercase method names.

## Added

* `feat(fetch):` Add `PropertyStore` for unified header/param management with method-specific overrides
* `feat(fetch):` Add predicate function support to `invalidatePath()` for custom cache key matching
* `feat(fetch):` Add `endpointSerializer` and `requestSerializer` for customizable cache/dedupe keys
* `feat(fetch):` Export `ResiliencePolicy`, `DedupePolicy`, `CachePolicy`, `RateLimitPolicy` classes

## Changed

* `refactor(fetch):` Internal refactor to use `PropertyStore` for headers/params (API unchanged)
* `refactor(fetch):` Normalize HTTP methods to lowercase internally for consistent storage
