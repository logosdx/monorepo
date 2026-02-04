---
"@logosdx/fetch": major
---

Refactored FetchEngine from a 2,671-line monolith into a modular architecture with clear separation of concerns. The core HTTP API (`get`, `post`, `put`, `patch`, `delete`, `request`) remains unchanged.

### Breaking Changes

#### State Management

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

#### Header Management

Header methods moved to a dedicated `headers` manager with method-specific support:

```typescript
// Before
engine.addHeader('Authorization', 'Bearer token');
engine.hasHeader('Authorization');
engine.rmHeader('Authorization');
engine.headers;  // getter returned object

// After
engine.headers.set('Authorization', 'Bearer token');
engine.headers.set('X-Custom', 'post-only', 'POST');  // NEW: method-specific
engine.headers.has('Authorization');
engine.headers.remove('Authorization');
engine.headers.all;  // property with default + method overrides
```

#### Parameter Management

Parameter methods moved to a dedicated `params` manager:

```typescript
// Before
engine.addParam('api_key', 'abc123');
engine.hasParam('api_key');
engine.rmParams('api_key');
engine.params;  // getter returned object

// After
engine.params.set('api_key', 'abc123');
engine.params.set('format', 'json', 'GET');  // NEW: method-specific
engine.params.has('api_key');
engine.params.remove('api_key');
engine.params.all;  // property with default + method overrides
```

#### Configuration Management

Configuration methods replaced with unified `options` store supporting deep path access:

```typescript
// Before
engine.changeBaseUrl('https://new-api.com');
engine.changeModifyOptions(fn);
engine.changeModifyMethodOptions('POST', fn);

// After
engine.options.set('baseUrl', 'https://new-api.com');
engine.options.set('modifyOptions', fn);
engine.options.set('modifyMethodOptions.POST', fn);

// NEW: Deep path access for any nested option
engine.options.get('retry.maxAttempts');
engine.options.set('retry.maxAttempts', 5);
engine.options.set('dedupePolicy', { enabled: false });
```

#### Event Names

Events drop the `fetch-` prefix for cleaner names:

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

```typescript
// Before
engine.on('fetch-before', handler);
engine.on('fetch-cache-hit', handler);

// After
engine.on('before', handler);
engine.on('cache-hit', handler);
```

#### Internal API Removed

- `engine._flight` is no longer exposed (internal via RequestExecutor)

### Why These Changes

1. **Modular Architecture**: Split monolithic engine into focused modules (state/, options/, properties/, policies/) for easier testing and maintenance

2. **Single Source of Truth**: All configuration flows through OptionsStore with type-safe deep path access

3. **Runtime Configurable**: Any option can now be changed at runtime, enabling dynamic API endpoints and feature flags

4. **Method-Specific Properties**: Headers and params can now be configured per-HTTP-method

5. **Cleaner Event Names**: Events match their domain without redundant prefixes

### Backward Compatibility

Deprecated methods still work during migration:

```typescript
// These still work (deprecated)
engine.getState();      // → engine.state.get()
engine.addHeader(k, v); // → engine.headers.set(k, v)
engine.changeBaseUrl(); // → engine.options.set('baseUrl', ...)

// Old event names still emit (deprecated)
engine.on('fetch-before', handler);  // still works
```

### New Capabilities

- **FetchError helpers**: `err.isTimeout()`, `err.isCancelled()`, `err.isConnectionLost()`
- **Attempt timeouts**: Separate `attemptTimeout` and `totalTimeout` for retry control
- **Deep config access**: `engine.options.get('retry.maxAttempts')`
