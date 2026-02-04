---
title: Fetch
description: HTTP that handles failure. Automatically.
---

# Fetch


Your API calls fail and `fetch` just throws. `@logosdx/fetch` transforms the basic Fetch API into a production-ready HTTP client. Automatic retries with exponential backoff, request deduplication, response caching with stale-while-revalidate, configurable timeouts, request cancellation, and comprehensive lifecycle events. Smart retry strategy for transient failures (network errors, 429s, 500s). Configure once with base URLs and headers, then make type-safe requests that handle network failures gracefully. It's `fetch`, but built for the real world.


## Installation


::: code-group

```bash [npm]
npm install @logosdx/fetch
```

```bash [yarn]
yarn add @logosdx/fetch
```

```bash [pnpm]
pnpm add @logosdx/fetch
```

:::

**CDN:**

```html
<script src="https://cdn.jsdelivr.net/npm/@logosdx/fetch@latest/dist/browser.min.js"></script>
<script>
    const { FetchEngine } = LogosDx.Fetch;
</script>
```


## Quick Start


```typescript
import { FetchEngine } from '@logosdx/fetch'
import { attempt } from '@logosdx/utils'

// Create HTTP client
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    defaultType: 'json',
    totalTimeout: 5000
});

// Make requests with error handling
const [response, err] = await attempt(() => api.get<User[]>('/users'));
if (err) {
    console.error('Failed to fetch users:', err.message);
    return;
}

// Access response data and metadata
console.log('Users:', response.data);
console.log('Status:', response.status);
console.log('Headers:', response.headers['content-type']);
```


## Global Instance


For simple use cases, a pre-configured global instance is available:

```typescript
// Default export - pre-configured instance
// Uses window.location.origin in browsers, or 'https://logosdx.dev' as fallback
import fetch from '@logosdx/fetch';
import { attempt } from '@logosdx/utils';

const [response, err] = await attempt(() => fetch.get<User[]>('/api/users'));
if (!err) {
    console.log('Users:', response.data);
}

// Or import individual methods and managers
import { get, post, headers, state, config, on } from '@logosdx/fetch';

// Configure the global instance
headers.set('Authorization', 'Bearer token123');
state.set('userId', '456');
config.set('modifyConfig', (opts, state) => {
    opts.headers = { ...opts.headers, 'X-Client-Version': '2.1.0' };
    return opts;
});

// Make requests
const [userResponse, err] = await attempt(() => get<User>('/api/users/456'));

// Listen to events
on('error', (event) => console.error('Request failed:', event.error));
```

**Available exports from global instance:**
- Methods: `get`, `post`, `put`, `patch`, `del`, `head`, `options`, `request`
- Managers: `headers`, `params`, `state`, `config`
- Events: `on`, `off`


## Core Concepts


FetchEngine returns a `FetchResponse<T>` object containing parsed data, response metadata, and request context. All HTTP methods return an `AbortablePromise` that can be cancelled.

```typescript
// Destructure just the data
const { data: users } = await api.get<User[]>('/users');

// Or access full response
const response = await api.get<User[]>('/users');
console.log(response.data);      // Parsed data
console.log(response.status);    // HTTP status
console.log(response.headers);   // Response headers
console.log(response.config);    // Request configuration
```


## FetchEngine Class


### Constructor


```typescript
new FetchEngine<H, P, S>(config: FetchEngine.Config<H, P, S>)
```

Creates a new HTTP client instance with type-safe headers, parameters, and state management.

**Type Parameters:**

- `H` - Interface for typed headers
- `P` - Interface for typed URL parameters
- `S` - Interface for typed state
- `RH` - Interface for typed response headers

**Example:**

```typescript
interface AppHeaders {
    Authorization?: string;
    'X-API-Key'?: string;
}

interface AppParams {
    version?: string;
    format?: 'json' | 'xml';
}

interface AppState {
    userId?: string;
    sessionId?: string;
}

const api = new FetchEngine<AppHeaders, AppParams, AppState>({
    baseUrl: 'https://api.example.com',
    defaultType: 'json',
    totalTimeout: 5000
});
```


### Public Properties


FetchEngine exposes four manager objects for runtime configuration:

| Property | Type | Description |
|----------|------|-------------|
| `state` | `FetchState<S>` | Instance state management |
| `config` | `ConfigStore<H, P, S>` | Configuration access and mutation |
| `headers` | `HeadersManager<H>` | Header management |
| `params` | `ParamsManager<P>` | URL parameter management |

**Example:**

```typescript
// Set headers
api.headers.set('Authorization', 'Bearer token');

// Set state
api.state.set('userId', '123');

// Change configuration
api.config.set('baseUrl', 'https://new-api.example.com');

// Get current config
const baseUrl = api.config.get('baseUrl');
```


## HTTP Methods


All request methods return an `AbortablePromise<FetchResponse<T>>`.

```typescript
// GET - retrieve data
const { data } = await api.get<User>('/users/123');

// POST - create resource
const { data } = await api.post<User>('/users', { name: 'John' });

// PUT - replace resource
const { data } = await api.put<User>('/users/123', { name: 'Jane' });

// PATCH - partial update
const { data } = await api.patch<User>('/users/123', { email: 'new@example.com' });

// DELETE - remove resource
await api.delete('/users/123');

// OPTIONS - check capabilities
const { headers } = await api.options('/users');

// HEAD - retrieve headers only
const { headers } = await api.head('/users/123');

// Generic request method
const { data } = await api.request<User>('PATCH', '/users/123', {
    payload: { name: 'Updated' }
});
```


## Documentation Pages


Explore each aspect of FetchEngine in detail:

- **[Configuration](./configuration)** - Engine config, headers, parameters, and state management
- **[Making Requests](./requests)** - HTTP methods, request options, and AbortablePromise
- **[Resilience](./resilience)** - Retry configuration, timeouts, and error handling
- **[Policies](./policies)** - Request deduplication, response caching, and rate limiting
- **[Events](./events)** - Event system and lifecycle management
- **[Advanced](./advanced)** - TypeScript patterns, serializers, and production examples
