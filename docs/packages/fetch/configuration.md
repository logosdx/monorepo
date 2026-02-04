---
title: Configuration
description: FetchEngine configuration options, headers, parameters, and state management.
---

# Configuration


FetchEngine provides comprehensive configuration options for customizing HTTP behavior at both the instance and request level.

[[toc]]


## Engine Configuration


The `FetchEngine.Config` interface defines all options for creating a FetchEngine instance.

| Option | Type | Description |
| ------ | ---- | ----------- |
| `baseUrl` (required) | `string` | Base URL for all requests |
| `defaultType` | `'json' \| 'text' \| 'blob' \| 'arrayBuffer' \| 'formData'` | Default response type |
| `totalTimeout` | `number` | Total timeout for entire request lifecycle including retries (ms) |
| `attemptTimeout` | `number` | Per-attempt timeout (ms). Each retry gets a fresh timeout |
| `headers` | `DictAndT<H>` | Default headers for all requests |
| `methodHeaders` | `{ GET?: ..., POST?: ... }` | Method-specific default headers |
| `params` | `DictAndT<P>` | Default URL parameters for all requests |
| `methodParams` | `{ GET?: ..., POST?: ... }` | Method-specific default parameters |
| `modifyConfig` | `(opts, state) => opts` | Function to modify request config |
| `modifyMethodConfig` | `{ GET?: fn, POST?: fn }` | Method-specific config modifiers |
| `validate` | `ValidateConfig` | Validators for headers, params, and state |
| `retry` | `RetryConfig \| boolean` | Retry configuration. `true` uses defaults, `false` disables |
| `dedupePolicy` | `boolean \| DeduplicationConfig` | Request deduplication configuration |
| `cachePolicy` | `boolean \| CacheConfig` | Response caching configuration |
| `rateLimitPolicy` | `boolean \| RateLimitConfig` | Rate limiting configuration |
| `generateRequestId` | `() => string` | Custom function to generate request IDs for tracing |
| `requestIdHeader` | `string` | Header name for sending the request ID with every outgoing request |
| `determineType` | `(response: Response) => DetermineTypeResult` | Custom response type detection |
| `name` | `string` | Instance name for debugging |
| `onBeforeReq` | `(opts) => void` | Lifecycle hook before each request |
| `onAfterReq` | `(response, opts) => void` | Lifecycle hook after each request |
| `onError` | `(err) => void` | Lifecycle hook on request error |
| `credentials` | `'include' \| 'same-origin' \| 'omit'` | Native fetch credentials mode |
| `mode` | `'cors' \| 'same-origin' \| 'no-cors'` | Native fetch request mode |
| `cache` | `RequestCache` | Native fetch cache mode (browser caching) |
| `redirect` | `'follow' \| 'error' \| 'manual'` | Native fetch redirect handling |
| `referrerPolicy` | `ReferrerPolicy` | Native fetch referrer policy |
| `keepalive` | `boolean` | Keep connection alive after page unload |
| `integrity` | `string` | Subresource integrity hash |

**Example:**

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    defaultType: 'json',
    totalTimeout: 30000,
    attemptTimeout: 10000,

    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },

    retry: {
        maxAttempts: 3,
        baseDelay: 1000,
        useExponentialBackoff: true
    },

    modifyConfig: (opts, state) => {
        if (state.authToken) {
            opts.headers = {
                ...opts.headers,
                Authorization: `Bearer ${state.authToken}`
            };
        }
        return opts;
    }
});
```


### Distributed Tracing


FetchEngine generates a unique `requestId` for every request, visible in all lifecycle events and `FetchError` instances. To propagate this ID to the server, set `requestIdHeader`:

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    requestIdHeader: 'X-Request-Id'
});

// Every outgoing request now includes the X-Request-Id header
// with the same value available in before-request, after-request, and error events
api.on('before-request', (data) => {
    console.log('Request ID:', data.requestId);
});
```

When combined with `generateRequestId`, the custom ID is used in both the header and all events:

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    generateRequestId: () => `trace-${crypto.randomUUID()}`,
    requestIdHeader: 'X-Trace-Id'
});
```

The request ID can also be overridden per-request. This is useful for propagating an external trace ID from an upstream service:

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    requestIdHeader: 'X-Request-Id'
});

// Use the upstream trace ID instead of generating a new one
await api.get('/orders', { requestId: incomingTraceId });
```

::: info
When `requestIdHeader` is not set, no header is injected. This is opt-in to avoid unexpected headers in environments with strict CORS policies.
:::


## ConfigStore


Access and modify configuration at runtime via `api.config`.


### `config.get(path?)`


Get configuration value by dot-notation path, or entire config if no path provided.

```typescript
// Get entire config
const config = api.config.get();

// Get specific values by path
const baseUrl = api.config.get('baseUrl');
const maxAttempts = api.config.get('retry.maxAttempts');
const modifyFn = api.config.get('modifyConfig');
```


### `config.set(path, value)` / `config.set(partial)`


Set configuration value by path or merge partial config.

```typescript
// Set by path
api.config.set('baseUrl', 'https://new-api.example.com');
api.config.set('retry.maxAttempts', 5);

// Merge partial config
api.config.set({
    totalTimeout: 60000,
    retry: { maxAttempts: 5 }
});

// Change the modifyConfig function at runtime
api.config.set('modifyConfig', (opts, state) => {
    if (state.authToken) {
        opts.headers = {
            ...opts.headers,
            Authorization: `Bearer ${state.authToken}`
        };
    }
    return opts;
});

// Change method-specific modifier
api.config.set('modifyMethodConfig', {
    POST: (opts, state) => {
        if (state.csrfToken) {
            opts.headers = {
                ...opts.headers,
                'X-CSRF-Token': state.csrfToken
            };
        }
        return opts;
    }
});

// Clear a modifier by setting to undefined
api.config.set('modifyConfig', undefined);
```

::: info
Setting config emits a `config-change` event, `modify-config-change` event, or `modify-method-config-change` event depending on what was changed.
:::


## Headers Management


Manage headers at runtime via `api.headers`.


### `headers.set(key, value, method?)` / `headers.set(headers, method?)`


Add headers globally or for a specific HTTP method.

```typescript
// Global header
api.headers.set('Authorization', 'Bearer token123');

// Multiple headers
api.headers.set({
    'X-API-Version': 'v2',
    'X-Client': 'web-app'
});

// Method-specific header (POST only)
api.headers.set('Content-Type', 'application/json', 'POST');
```


### `headers.remove(key, method?)` / `headers.remove(keys[], method?)`


Remove headers.

```typescript
// Remove single header
api.headers.remove('Authorization');

// Remove multiple headers
api.headers.remove(['X-API-Version', 'X-Client']);

// Remove method-specific header
api.headers.remove('Content-Type', 'POST');
```


### `headers.has(key, method?)`


Check if a header exists.

```typescript
if (api.headers.has('Authorization')) {
    console.log('Auth header is set');
}
```


### `headers.resolve(method, overrides?)`


Get final resolved headers for a request (merges defaults, method overrides, and request overrides).

```typescript
const headers = api.headers.resolve('POST', { 'X-Request-ID': '123' });
```


### `headers.defaults` / `headers.all`


Access default headers or all headers including method overrides.

```typescript
// Default headers only
const defaults = api.headers.defaults;

// All headers including method overrides
const all = api.headers.all;
// { default: { Authorization: '...' }, POST: { 'Content-Type': '...' } }
```


## Parameters Management


Manage URL parameters at runtime via `api.params`. Has the same API as `api.headers`.


### `params.set(key, value, method?)` / `params.set(params, method?)`


```typescript
// Global parameter
api.params.set('version', 'v1');

// Multiple parameters
api.params.set({
    format: 'json',
    locale: 'en-US'
});

// Method-specific parameter
api.params.set('include_deleted', 'true', 'GET');
```


### `params.remove(key, method?)` / `params.remove(keys[], method?)`


```typescript
api.params.remove('version');
api.params.remove(['format', 'locale']);
```


### `params.has(key, method?)`


```typescript
if (api.params.has('version')) {
    console.log('Version param is set');
}
```


## State Management


Manage instance state at runtime via `api.state`. State is available in `modifyConfig` callbacks.


### `state.get()`


Get a deep clone of the current state.

```typescript
const state = api.state.get();
console.log('Current user:', state.userId);
```


### `state.set(key, value)` / `state.set(partial)`


Set state by key-value or merge partial state.

```typescript
// Set single property
api.state.set('authToken', 'bearer-123');

// Merge multiple properties
api.state.set({
    userId: 'user-123',
    sessionId: 'session-456'
});
```


### `state.reset()`


Reset state to empty object.

```typescript
api.state.reset();
console.log(api.state.get()); // {}
```


## Using State in Requests


State is passed to `modifyConfig` callbacks, allowing dynamic request modification:

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',

    modifyConfig: (opts, state) => {
        // Add auth header from state
        if (state.authToken) {
            opts.headers = {
                ...opts.headers,
                Authorization: `Bearer ${state.authToken}`
            };
        }

        // Add user ID header
        if (state.userId) {
            opts.headers = {
                ...opts.headers,
                'X-User-ID': state.userId
            };
        }

        return opts;
    }
});

// Set state
api.state.set('authToken', 'my-token');
api.state.set('userId', 'user-123');

// Requests now include auth header and user ID
const { data } = await api.get('/protected-resource');
```


## Method-Specific Configuration


Configure headers, params, or modifyConfig per HTTP method:

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',

    // Global headers
    headers: {
        'Accept': 'application/json'
    },

    // POST-specific headers
    methodHeaders: {
        POST: { 'Content-Type': 'application/json' },
        PUT: { 'Content-Type': 'application/json' }
    },

    // GET-specific params
    methodParams: {
        GET: { include: 'metadata' }
    },

    // Method-specific config modification
    modifyMethodConfig: {
        POST: (opts, state) => {
            if (state.csrfToken) {
                opts.headers = {
                    ...opts.headers,
                    'X-CSRF-Token': state.csrfToken
                };
            }
            return opts;
        }
    }
});
```


## Validation


Validate headers, params, and state before requests are made:

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',

    validate: {
        headers: (headers, method) => {
            if (method === 'POST' && !headers['Content-Type']) {
                throw new Error('POST requests require Content-Type');
            }
        },

        params: (params, method) => {
            // Validate params
        },

        state: (state) => {
            if (!state.authToken) {
                throw new Error('Auth token required');
            }
        },

        // Run validation before each request (default: false)
        perRequest: {
            headers: true,
            params: false
        }
    }
});
```
