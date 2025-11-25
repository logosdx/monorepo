---
"@logosdx/utils": major
---

## Breaking Changes


### `withInflightDedup` API changes

- **Renamed**: `keyFn` → `generateKey` for consistency with `memoize`/`memoizeSync`
- **Flattened hooks**: `hooks.onStart`, `hooks.onJoin`, `hooks.onResolve`, `hooks.onReject` are now top-level options
- **Removed**: `InflightHooks` interface (hooks are now part of `InflightOptions`)

**Migration:**

```ts
// Before
const deduped = withInflightDedup(fn, {
    keyFn: (id) => id,
    hooks: {
        onStart: (k) => console.log('started', k),
        onJoin: (k) => console.log('joined', k)
    }
})

// After
const deduped = withInflightDedup(fn, {
    generateKey: (id) => id,
    onStart: (k) => console.log('started', k),
    onJoin: (k) => console.log('joined', k)
})
```

### `memoize` and `memoizeSync` signature change

- **Changed**: `generateKey` now receives spread arguments instead of tuple
  - Before: `generateKey: (args: Parameters<T>) => string` - receives `[arg1, arg2]`
  - After: `generateKey: (...args: Parameters<T>) => string` - receives `arg1, arg2`

**Migration:**

```ts
// Before
const cached = memoize(fn, {
    generateKey: ([id, opts]) => id
})

// After
const cached = memoize(fn, {
    generateKey: (id, opts) => id
})
```
