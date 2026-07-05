---
"@logosdx/utils": major
---

## Breaking Changes

### `makeNestedConfig()` no longer accepts `memoizeOpts`

Caching is now built in: the first `allConfigs()`/`getConfig()` call parses and caches;
the new update functions invalidate the cache. TTL-based memoization is gone.

**Before:**

```ts
const config = makeNestedConfig(process.env, {
    stripPrefix: 'APP_',
    memoizeOpts: { ttl: 60000 },
});
```

**After:**

```ts
const config = makeNestedConfig(process.env, {
    stripPrefix: 'APP_',
});

// values are cached after first read; push changes explicitly:
config.updateFlatConfig({ APP_DB_HOST: 'remotehost' });
```

### Reads are cached and detached

Without `memoizeOpts`, v6 re-parsed the flat source on every call, so external mutations
of `process.env` were picked up implicitly — now they aren't until `updateFlatConfig()`
is called. Every read returns a detached copy: mutating a returned object no longer
affects later reads.

## Added

* `feat(config):` `makeNestedConfig()` returns `NestedConfig<C, F>` with three update
  functions — `updateFlatConfig()` (deep-merge into the flat source),
  `updateParsedConfig()` (accumulate a deep partial override that survives re-parses),
  and `setDeepInParsedConfig()` (path-based writes, e.g. `[['db.host', 'x']]`). All
  invalidate the cache; parsed-level overrides always win over flat values.
* `feat(types):` Add `DeepNotOptional<T>` utility type.

## Fixed

* `fix(config):` `updateFlatConfig()`/`updateParsedConfig()` throw on non-object
  overrides instead of silently discarding accumulated state.
