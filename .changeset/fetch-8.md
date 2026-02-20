---
"@logosdx/fetch": major
---

## Breaking Changes

### State Management

State methods moved to a dedicated `state` property:

```typescript
// Before
engine.getState();
engine.setState('token', 'abc123');
engine.resetState();

// After
engine.state.get();
engine.state.set('token', 'abc123');
engine.state.reset();
```

### Header Management

Header methods moved to a dedicated `headers` manager with method-specific support:

```typescript
// Before
engine.addHeader('Authorization', 'Bearer token');
engine.hasHeader('Authorization');
engine.rmHeader('Authorization');
engine.headers;  // getter returned object

// After
engine.headers.set('Authorization', 'Bearer token');
engine.headers.set('X-Custom', 'post-only', 'POST');  // method-specific
engine.headers.has('Authorization');
engine.headers.remove('Authorization');
engine.headers.all;  // property with default + method overrides
```

### Parameter Management

Parameter methods moved to a dedicated `params` manager:

```typescript
// Before
engine.addParam('api_key', 'abc123');
engine.hasParam('api_key');
engine.rmParams('api_key');
engine.params;  // getter returned object

// After
engine.params.set('api_key', 'abc123');
engine.params.set('format', 'json', 'GET');  // method-specific
engine.params.has('api_key');
engine.params.remove('api_key');
engine.params.all;  // property with default + method overrides
```

### `.headers` and `.params` getters use lowercase method keys

```typescript
// Before
const { POST: postHeaders } = api.headers;

// After
const { post: postHeaders } = api.headers;
```

### Configuration Management

Configuration methods replaced with unified `options` store supporting deep path access:

```typescript
// Before
engine.changeBaseUrl('https://new-api.com');

// After
engine.options.set('baseUrl', 'https://new-api.com');
engine.options.get('retry.maxAttempts');
engine.options.set('retry.maxAttempts', 5);
```

### Removed `modifyConfig` / `modifyMethodConfig`

The `modifyConfig` and `modifyMethodConfig` options and the `ModifyConfigFn` type have been removed. Use `beforeRequest` hooks instead:

```typescript
// Before
const api = new FetchEngine({
    modifyConfig: (config, state) => ({ ...config, headers: { ...config.headers, Authorization: state.token } }),
});

// After
engine.hooks.add('beforeRequest', (url, opts, ctx) => {
    ctx.args(url, { ...opts, headers: { ...opts.headers, Authorization: engine.state.get().token } });
});
```

### Event Names

Events drop the `fetch-` prefix:

| Before | After |
|--------|-------|
| `fetch-before` | `before` |
| `fetch-after` | `after` |
| `fetch-response` | `response` |
| `fetch-error` | `error` |
| `fetch-cache-hit` | `cache-hit` |
| `fetch-dedupe-join` | `dedupe-join` |
| `fetch-state-set` | `state-set` |
| `fetch-header-add` | `header-add` |

### Internal API Removed

- `engine._flight` is no longer exposed

## Added

* `feat(fetch):` Hook-based request pipeline via `@logosdx/hooks` — `engine.hooks.add('beforeRequest' | 'afterRequest', callback, { priority })`
* `feat(fetch):` Plugin system — `engine.use(plugin)` and `plugins` config option for composable extensions
* `feat(fetch):` Per-request hooks via `CallConfig.hooks`
* `feat(fetch):` `PropertyStore` for unified header/param management with method-specific overrides
* `feat(fetch):` Predicate function support for `invalidatePath()` custom cache key matching
* `feat(fetch):` `endpointSerializer` and `requestSerializer` for customizable cache/dedupe keys
* `feat(fetch):` Export `ResiliencePolicy`, `DedupePolicy`, `CachePolicy`, `RateLimitPolicy` classes
* `feat(fetch):` `FetchError` helpers — `err.isTimeout()`, `err.isCancelled()`, `err.isConnectionLost()`
* `feat(fetch):` Separate `attemptTimeout` and `totalTimeout` for retry control
* `feat(fetch):` `requestIdHeader` config option for automatic request ID header injection
* `feat(fetch):` Per-request `requestId` option in `CallConfig` for external trace ID correlation
* `feat(fetch):` `stream` option in `CallConfig` for raw `Response` with unconsumed body streams
* `feat(fetch):` Event timing data — `requestStart` and `requestEnd` timestamps on lifecycle events
