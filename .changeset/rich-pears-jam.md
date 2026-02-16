---
"@logosdx/hooks": major
---

## Breaking Changes

### API verbs renamed

Methods renamed to distinguish from Observer (`on`/`emit`):

| Before | After |
|--------|-------|
| `engine.on(name, cb)` | `engine.add(name, cb, options?)` |
| `engine.once(name, cb)` | `engine.add(name, cb, { once: true })` |
| `engine.emit(name, ...args)` | `engine.run(name, ...args)` |

### Callback signature changed

Callbacks now receive spread args with ctx as the last parameter instead of a context object:

**Before:**
```ts
hooks.on('beforeRequest', async (ctx) => {
    const [url, opts] = ctx.args;
    ctx.setArgs([url, { ...opts, cache: 'no-store' }]);
});
```

**After:**
```ts
hooks.add('beforeRequest', (url, opts, ctx) => {
    ctx.args(url, { ...opts, cache: 'no-store' });
});
```

### Context methods replaced

| Before | After |
|--------|-------|
| `ctx.args` (property) | `ctx.args(...)` (method — replaces args) |
| `ctx.setArgs([...])` | `ctx.args(...)` (spread, no array wrapper) |
| `ctx.setResult(value)` | `return ctx.returns(value)` |
| `ctx.returnEarly()` | `return ctx.args(...)` or `return ctx.returns(value)` |

### Return type renamed

`EmitResult` → `RunResult`, `earlyReturn` → `returned`:

```ts
// Before
const { args, result, earlyReturn } = await hooks.emit('hook', data);
// After
const { args, result, returned } = await hooks.run('hook', data);
```

## Added

* `feat(hooks):` Sync execution via `runSync()` and `wrapSync()` for non-async hook chains
* `feat(hooks):` Priority ordering — `add(name, cb, { priority: -10 })`, lower runs first
* `feat(hooks):` `times` option — run a callback N times then auto-remove
* `feat(hooks):` Per-request ephemeral hooks via `RunOptions.append`
* `feat(hooks):` `HookContext` is now a class (exported for `instanceof` checks)
