---
title: Fetch
description: HTTP that handles failure. Automatically.
---

# Fetch

Your API calls fail and `fetch` just throws. `@logosdx/fetch` transforms the basic Fetch API into a production-ready HTTP client. Automatic retries with exponential backoff, request deduplication, response caching with stale-while-revalidate, configurable timeouts, request cancellation, and comprehensive lifecycle events. Smart retry strategy for transient failures (network errors, 429s, 500s). Configure once with base URLs and headers, then make type-safe requests that handle network failures gracefully. It's `fetch`, but built for the real world.

[[toc]]

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
import { FetchEngine, FetchResponse } from '@logosdx/fetch'
import { attempt } from '@logosdx/utils'

// Create HTTP client
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    defaultType: 'json',
    totalTimeout: 5000
});

// Make requests with error handling - returns FetchResponse object
const [response, err] = await attempt(() => api.get<User[]>('/users'));
if (err) {
    console.error('Failed to fetch users:', err.message);
    return;
}
console.log('Users:', response.data);
console.log('Status:', response.status);
console.log('Headers:', response.headers['content-type']);

```

### Global Instance (Simplified Usage)

```typescript
// Use the default global instance
import fetch from '@logosdx/fetch'
import { attempt } from '@logosdx/utils'

// Automatically uses current domain as base URL - returns FetchResponse
const [response, err] = await attempt(() => fetch.get<User[]>('/api/users'));
if (!err) {
    console.log('Users:', response.data);
    console.log('Status:', response.status);
}

// Backward compatibility - destructure just the data
const { data: users } = await fetch.get<User[]>('/api/users');

// Or destructure methods for convenience
import { get, post, setState, addHeader, changeModifyOptions, changeModifyMethodOptions } from '@logosdx/fetch'

// Configure globally
addHeader('Authorization', 'Bearer token123');
setState('userId', '456');

// Set global request modifier
changeModifyOptions((opts, state) => {
    opts.headers['X-Client-Version'] = '2.1.0';
    return opts;
});

// Set method-specific modifier
changeModifyMethodOptions('POST', (opts, state) => {
    opts.headers['X-CSRF-Token'] = state.csrfToken || '';
    return opts;
});

// Make requests - returns FetchResponse objects
const [userResponse, err] = await attempt(() => get<User>('/api/users/456'));
if (!err) {
    const { data: user } = userResponse; // Destructure for backward compatibility
    console.log('User:', user);
}

const [newUserResponse, err2] = await attempt(() =>
    post<User, CreateUserData>('/api/users', userData)
);

// Smart URL handling - absolute URLs bypass base URL
const [external, err] = await attempt(() =>
    get('https://api.external.com/data')
);
```

## Core Concepts

FetchEngine provides type-safe headers and parameters with intelligent retry logic. All HTTP methods return a `FetchResponse<T, H, P>` object containing parsed data, response metadata, and request context. The event system enables comprehensive monitoring and debugging across all JavaScript environments. Built-in error handling patterns work seamlessly with @logosdx/utils attempt/attemptSync functions.

## FetchEngine Class

### Constructor

```typescript
new FetchEngine<H, P, S>(options?: FetchEngine.Options<H, P, S>)
```

Creates a new HTTP client instance with type-safe headers, parameters, and state management.

**Type Parameters:**

- `H` - Interface for typed headers (optional)
- `P` - Interface for typed parameters (optional)
- `S` - Interface for typed state (defaults to `InstanceState`)
- `RH` - Interface for typed response headers (defaults to `InstanceResponseHeaders`)

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

### Configuration Options

**Note:** `FetchEngine.Options` extends the Fetch API's `RequestInit` interface. Any standard Fetch API options can be passed and will be merged with `FetchEngine` defaults.

**FetchEngine Options**

| Option                | Type                                                                                          | Description                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `baseUrl` (required)  | `string`                                                                                      | The base URL for all requests                                                       |
| `defaultType`         | `'json' \| 'text' \| 'blob' \| 'arrayBuffer' \| 'formData'`                                   | The default type of response expected from the server                               |
| `totalTimeout`        | `number`                                                                                      | Total timeout in milliseconds for entire request lifecycle (including all retries)  |
| `attemptTimeout`      | `number`                                                                                      | Per-attempt timeout in milliseconds. Each retry gets a fresh timeout                |
| `timeout` *(deprecated)* | `number`                                                                                   | Alias for `totalTimeout`. Use `totalTimeout` instead                                |
| `headers`             | `Headers<H>`                                                                                  | The headers to be set on all requests                                               |
| `methodHeaders`       | `{ [key in HttpMethods]?: Headers<H> }`                                                       | The headers to be set on requests of a specific method                              |
| `params`              | `Params<P>`                                                                                   | The parameters to be set on all requests                                            |
| `methodParams`        | `{ [key in HttpMethods]?: Params<P> }`                                                        | The parameters to be set on requests of a specific method                           |
| `retry`         | `RetryConfig \| boolean`                                                                      | The retry configuration for the fetch request. Set to `false` to disable retries, `true` to use defaults |
| `dedupePolicy`        | `boolean \| DeduplicationConfig`                                                              | Request deduplication configuration. `true` enables with defaults (GET only) |
| `cachePolicy`         | `boolean \| CacheConfig`                                                                      | Response caching configuration. `true` enables with defaults (GET, 60s TTL) |
| `modifyOptions`       | `(opts: RequestOpts<H, P>, state: S) => RequestOpts<H>`                                       | A function that can be used to modify the options for all requests                  |
| `modifyMethodOptions` | `{ [key in HttpMethods]?: (opts: RequestOpts<H, P>, state: S) => RequestOpts<H> }`            | A function that can be used to modify the options for requests of a specific method |
| `validate`            | Validate Config (see below)                                                                   | Validators for when setting headers and state                                       |
| `determineType`       | `(response: Response) => 'json' \| 'text' \| 'blob' \| 'arrayBuffer' \| 'formData' \| Symbol` | The function to determine the type of response expected from the server. May return `FetchEngine.useDefault` to use built-in detection |

**Validate Config**

| Option       | Type                                                  | Description                                                                       |
| ------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| `headers`    | `(headers: Headers<H>, method?: HttpMethods) => void` | A function that can be used to validate the headers before the request is made    |
| `params`     | `(params: Params<P>, method?: HttpMethods) => void`   | A function that can be used to validate the parameters before the request is made |
| `state`      | `(state: S) => void`                                  | A function that can be used to validate the state before the request is made      |
| `perRequest` | `{ headers?: boolean, params?: boolean }`             | Whether to validate the headers and parameters before the request is made         |

**Retry Config**

| Option                  | Type                                                         | Description                                                             |
| ----------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `baseDelay`             | `number`                                                     | The base delay between retry attempts in milliseconds (default: 1000)    |
| `maxAttempts`           | `number`                                                     | The maximum number of retry attempts                                    |
| `maxDelay`              | `number`                                                     | The maximum delay between retry attempts in milliseconds                |
| `useExponentialBackoff` | `boolean`                                                    | Whether to use exponential backoff for retry attempts                   |
| `retryableStatusCodes`  | `number[]`                                                   | The status codes that should trigger a retry                            |
| `shouldRetry`           | `(error: FetchError, attempt: number) => boolean \| number`  | A function to determine if a request should be retried. Return `false` to stop, `true` to retry with default delay, or a number for custom delay in ms |

**Type Definition**

```typescript
interface FetchEngine.Options<H, P, S> {
    baseUrl: string;
    defaultType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData';
    headers?: Headers<H>;
    methodHeaders?: {
        GET?: Headers<H>;
        POST?: Headers<H>;
        PUT?: Headers<H>;
        PATCH?: Headers<H>;
        DELETE?: Headers<H>;
        HEAD?: Headers<H>;
        OPTIONS?: Headers<H>;
    };
    params?: Params<P>;
    methodParams?: {
        GET?: Params<P>;
        POST?: Params<P>;
        PUT?: Params<P>;
        PATCH?: Params<P>;
        DELETE?: Params<P>;
        HEAD?: Params<P>;
        OPTIONS?: Params<P>;
    };
    retry?: RetryConfig | false;
    modifyOptions?: (opts: RequestOpts<H, P>, state: S) => RequestOpts<H>;
    modifyMethodOptions?: {
        GET?: (opts: RequestOpts<H, P>, state: S) => RequestOpts<H>;
        POST?: (opts: RequestOpts<H, P>, state: S) => RequestOpts<H>;
        PUT?: (opts: RequestOpts<H, P>, state: S) => RequestOpts<H>;
        PATCH?: (opts: RequestOpts<H, P>, state: S) => RequestOpts<H>;
        DELETE?: (opts: RequestOpts<H, P>, state: S) => RequestOpts<H>;
        HEAD?: (opts: RequestOpts<H, P>, state: S) => RequestOpts<H>;
        OPTIONS?: (opts: RequestOpts<H, P>, state: S) => RequestOpts<H>;
    };
    validate?: {
        headers?: (headers: Headers<H>, method?: HttpMethods) => void;
        params?: (params: Params<P>, method?: HttpMethods) => void;
        state?: (state: S) => void;
        perRequest?: {
            headers?: boolean;
            params?: boolean;
        };
    };
    determineType?: (response: Response) => 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData' | Symbol;

    // Request deduplication (prevents duplicate concurrent requests)
    dedupePolicy?: boolean | DeduplicationConfig<S, H, P>;

    // Response caching with TTL and SWR support
    cachePolicy?: boolean | CacheConfig<S, H, P>;

    // Rate limiting with token bucket algorithm
    rateLimitPolicy?: boolean | RateLimitConfig<S, H, P>;
}
```

### Request Methods

All request methods return an `AbortablePromise<FetchResponse<T, H, P, RH>>` that can be cancelled and provides status information. The response object contains the parsed data along with typed response headers, status, request details, and typed configuration matching your custom headers and params interfaces.

**Parameters:**

| Parameter | Description                               |
| --------- | ----------------------------------------- |
| `path`    | API endpoint path (relative to baseUrl)   |
| `payload` | Request body data (optional)              |
| `options` | Optional request configuration (optional) |

#### Without a payload

**GET**

```typescript
api.get<T, RH>(path: string, options?: RequestOptions): AbortablePromise<FetchResponse<T, H, P, RH>>
```

**DELETE**

```typescript
api.delete<T, any, RH>(path: string, options?: RequestOptions): AbortablePromise<FetchResponse<T, H, P, RH>>
```

**OPTIONS**

```typescript
api.options<T, RH>(path: string, options?: RequestOptions): AbortablePromise<FetchResponse<T, H, P, RH>>
```

**Example:**

```typescript
const [response, err] = await attempt(() => api.get<User[]>('/users'));
if (!err) {
    console.log('Users:', response.data);
    console.log('Total:', response.headers['x-total-count']);
}

const [userResponse, err2] = await attempt(() => api.get<User>('/users/123', {
    headers: { 'X-Include': 'profile' },
    params: { include: 'permissions' }
}));

// Backward compatibility - destructure just the data
const { data: users } = await api.get<User[]>('/users');

// Smart URL handling - absolute URLs bypass base URL
const [externalResponse, err3] = await attempt(() =>
    api.get<ApiData>('https://api.external.com/data')
);

const [deleteResponse, err4] = await attempt(() => api.delete<User>('/users/123'));
```

#### With a payload

**POST**

```typescript
api.post<T, D = any, RH = InstanceResponseHeaders>(path: string, payload?: D, options?: RequestOptions): AbortablePromise<FetchResponse<T, H, P, RH>>
```

**PUT**

```typescript
api.put<T, D = any, RH = InstanceResponseHeaders>(path: string, payload?: D, options?: RequestOptions): AbortablePromise<FetchResponse<T, H, P, RH>>
```

**PATCH**

```typescript
api.patch<T, D = any, RH = InstanceResponseHeaders>(path: string, payload?: D, options?: RequestOptions): AbortablePromise<FetchResponse<T, H, P, RH>>
```

**Example:**

```typescript
const [newUser, err] = await attempt(() =>
    api.post<User, CreateUserData>('/users', {
        name: 'John Doe',
        email: 'john@example.com'
    })
);

const [updatedUser, err] = await attempt(() =>
    api.put<User, UpdateUserData>(
        '/users/123',
        {
            name: 'Jane Doe',
            email: 'jane@example.com'
        },
        {
            headers: {
                'X-Partial-Update': 'true'
            },
            params: {
                include: 'permissions'
            }
        }
    )
);
```

### Generic Request Method


### FetchResponse Object

Every HTTP request returns an enhanced response object with typed configuration:

```typescript
interface FetchResponse<T = any, H = FetchEngine.InstanceHeaders, P = FetchEngine.InstanceParams, RH = FetchEngine.InstanceResponseHeaders> {
    data: T;                  // Parsed response body
    headers: Partial<RH>;     // Response headers as typed plain object
    status: number;           // HTTP status code
    request: Request;         // Original request object
    config: FetchConfig<H, P>; // Typed configuration used for request
}

interface FetchConfig<H = FetchEngine.InstanceHeaders, P = FetchEngine.InstanceParams> {
    baseUrl?: string;
    /** @deprecated Use totalTimeout instead */
    timeout?: number;
    totalTimeout?: number;    // Total timeout for entire lifecycle
    attemptTimeout?: number;  // Per-attempt timeout
    headers?: H;              // Typed headers from your custom interface
    params?: P;               // Typed params from your custom interface
    retry?: RetryConfig | false;
    method?: string;
    determineType?: any;
}
```

**Usage Examples:**

```typescript
// Access full response details
const response = await api.get<User[]>('/users');
console.log('Data:', response.data);           // Parsed users array
console.log('Status:', response.status);       // HTTP status code
console.log('Headers:', response.headers);     // Access to all headers
console.log('Config:', response.config);       // Request configuration used

// Backward compatibility - destructure just the data
const { data: users } = await api.get<User[]>('/users');

// Access specific response metadata
const contentType = response.headers['content-type'];
const rateLimit = response.headers['x-rate-limit-remaining'];
const requestUrl = response.request.url;
const usedTimeout = response.config.timeout;
```

#### `request<T, D>(method, path, options?)`

```typescript
request<T, D = any, RH = InstanceResponseHeaders>(
    method: HttpMethods,
    path: string,
    options?: RequestOptions & { payload?: D }
): AbortablePromise<FetchResponse<T, H, P, RH>>
```

**Example:**

```typescript
const [result, err] = await attempt(() =>
    api.request<ApiResponse, RequestData>('PATCH', '/settings', {
        payload: { theme: 'dark' },
        headers: { 'X-Partial-Update': 'true' }
    })
);
```

## Request Options

**Note:** `RequestOptions` extends the Fetch API's `RequestInit` interface. All standard Fetch API options are supported, with the following exceptions:

- `baseUrl`
- `defaultType`
- `body`
- `method`
- `controller` (you can pass it as `abortController` instead)

**Request Options**

| Option            | Type              | Description                                                             |
| ----------------- | ----------------- | ----------------------------------------------------------------------- |
| `abortController` | `AbortController` | The abort controller to be used to abort the request                    |
| `headers`         | `Headers<T>`      | The headers to be set on the request                                    |
| `params`          | `Params<P>`       | The parameters to be set on the request                                 |
| `totalTimeout`    | `number`          | Total timeout for entire request lifecycle (including all retries)      |
| `attemptTimeout`  | `number`          | Per-attempt timeout. Each retry gets a fresh timeout                    |
| `timeout` *(deprecated)* | `number`   | Alias for `totalTimeout`. Use `totalTimeout` instead                    |
| `determineType`   | `DetermineTypeFn` | The function to determine the type of response expected from the server |
| `retry`           | `RetryConfig`     | Retry configuration overrides for this request                          |
| `onBeforeReq`     | `(opts) => void \| Promise<void>` | Lifecycle hook called before the request is made                  |
| `onAfterReq`      | `(response, opts) => void \| Promise<void>` | Lifecycle hook called after the request completes         |
| `onError`         | `(err) => void \| Promise<void>`  | Lifecycle hook called when the request errors                            |

**Type Definition**

```typescript
type Lifecycle = {

    onBeforeReq?: (opts: FetchEngine.RequestOpts<any, any>) => void | Promise<void>
    onAfterReq?: (response: Response, opts: FetchEngine.RequestOpts<any, any>) => void | Promise<void>
    onError?: (err: FetchError<any, any>) => void | Promise<void>
};

type RequestOpts<T = InstanceHeaders, P = InstanceParams> = {

    controller: AbortController,
    headers?: Headers<T>,
    params?: Params<P>,
    /** @deprecated Use totalTimeout instead */
    timeout?: number,
    totalTimeout?: number,
    attemptTimeout?: number,
    determineType?: DetermineTypeFn,
    retry?: RetryConfig
};

type CallOptions<H = InstanceHeaders, P = InstanceParams> = (
    Lifecycle &
    RequestOpts<H, P> &
    RequestInit
);
```

## AbortablePromise

All HTTP methods return an `AbortablePromise` with additional capabilities:

```typescript
interface AbortablePromise<T> extends Promise<T> {
    isFinished: boolean;
    isAborted: boolean;
    abort(reason?: string): void;
}
```

**Example:**

```typescript
const request = api.get('/slow-endpoint');

// My boss made me do it
onceMyReallyWeirdConditionHits(() => {
    !request.isFinished && request.abort('User timeout')
});

const [data, err] = await attempt(() => request);

if (err && request.isAborted) {
    console.log('Request was cancelled');
}
```

## State Management

### `setState(state)` / `setState(key, value)`

```typescript
setState(state: Partial<S>): void
setState<K extends keyof S>(key: K, value: S[K]): void
```

Update the client's internal state.

**Example:**

```typescript
// Set entire state object
api.setState({
    userId: '123',
    sessionId: 'abc',
    preferences: { theme: 'dark' }
});

// Set individual property
api.setState('userId', '456');
```

### `getState()`

```typescript
getState(): S
```

Get a deep clone of the current state.

**Example:**

```typescript
const currentState = api.getState();
console.log('Current user:', currentState.userId);
```

### `resetState()`

```typescript
resetState(): void
```

Clear all state properties.

## Headers Management

### `addHeader(name, value, method?)`

```typescript
addHeader(name: string, value: string, method?: HttpMethods): void
addHeader(headers: Record<string, string>, method?: HttpMethods): void
```

Add headers globally or for specific HTTP methods.

**Example:**

```typescript
// Global header
api.addHeader('Authorization', 'Bearer token123');

// Multiple headers
api.addHeader({
    'X-API-Version': 'v2',
    'X-Client': 'web-app'
});

// Method-specific header
api.addHeader('X-CSRF-Token', 'csrf123', 'POST');
```

### `rmHeader(name, method?)`

```typescript
rmHeader(name: string | string[], method?: HttpMethods): void
```

Remove headers.

**Example:**

```typescript
// Remove global header
api.rmHeader('Authorization');

// Remove multiple headers
api.rmHeader(['X-API-Version', 'X-Client']);

// Remove method-specific header
api.rmHeader('X-CSRF-Token', 'POST');
```

### `hasHeader(name, method?)`

```typescript
hasHeader(name: string, method?: HttpMethods): boolean
```

Check if a header exists.

## Parameters Management

### `addParam(name, value, method?)`

```typescript
addParam(name: string, value: string | number | boolean, method?: HttpMethods): void
addParam(params: Record<string, string | number | boolean>, method?: HttpMethods): void
```

Add URL parameters globally or for specific methods.

**Example:**

```typescript
// Global parameter
api.addParam('version', 'v1');

// Multiple parameters
api.addParam({
    format: 'json',
    locale: 'en-US'
});

// Method-specific parameter
api.addParam('include_deleted', true, 'GET');
```

### `rmParam(name, method?)`

```typescript
rmParam(name: string | string[], method?: HttpMethods): void
```

Remove parameters.

### `hasParam(name, method?)`

```typescript
hasParam(name: string, method?: HttpMethods): boolean
```

Check if a parameter exists.

## URL Management

### `changeBaseUrl(url)`

```typescript
changeBaseUrl(url: string): void
```

Update the base URL for all requests.

**Example:**

```typescript
observer.on('environment-changed', ({ env }) => {

    // Switch to other environment
    api.changeBaseUrl(`https://${env}.fubar.com`);
});
```

### `changeModifyOptions(fn?)`

```typescript
changeModifyOptions(fn?: (opts: RequestOpts<H, P>, state: S) => RequestOpts<H>): void
```

Updates the global modifyOptions function for this FetchEngine instance. Changes the global options modification function that is applied to all requests before they are sent. Pass undefined to clear the function. Dispatches a 'fetch-modify-options-change' event when updated.

**Example:**

```typescript
// Set a global request modifier
api.changeModifyOptions((opts, state) => {
    opts.headers = { ...opts.headers, 'X-Request-ID': crypto.randomUUID() };
    return opts;
});

// Add authentication based on state
api.changeModifyOptions((opts, state) => {
    if (state.authToken) {
        opts.headers.Authorization = `Bearer ${state.authToken}`;
    }
    return opts;
});

// Clear the modifier
api.changeModifyOptions(undefined);
```

### `changeModifyMethodOptions(method, fn?)`

```typescript
changeModifyMethodOptions(method: HttpMethods, fn?: (opts: RequestOpts<H, P>, state: S) => RequestOpts<H>): void
```

Updates the modifyOptions function for a specific HTTP method. Changes the method-specific options modification function that is applied to requests of the specified HTTP method before they are sent. Pass undefined to clear the function for that method. Dispatches a 'fetch-modify-method-options-change' event when updated.

**Example:**

```typescript
// Set a POST-specific request modifier
api.changeModifyMethodOptions('POST', (opts, state) => {
    opts.headers = { ...opts.headers, 'Content-Type': 'application/json' };
    return opts;
});

// Add CSRF token to state-changing methods
api.changeModifyMethodOptions('POST', (opts, state) => {
    if (state.csrfToken) {
        opts.headers['X-CSRF-Token'] = state.csrfToken;
    }
    return opts;
});

// Clear the POST modifier
api.changeModifyMethodOptions('POST', undefined);
```

## Retry Configuration

The retry option accepts three types of values:
- `true` - Enable retries with default configuration
- `false` - Disable retries completely
- `RetryConfig` object - Custom retry configuration

**Default values (when `retry: true` or partial config):**
```typescript
{
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    useExponentialBackoff: true,
    retryableStatusCodes: [408, 429, 499, 500, 502, 503, 504]
}
```

```typescript
interface RetryConfig {
    maxAttempts?: number; // default: 3
    baseDelay?: number; // default: 1000 (in milliseconds)
    maxDelay?: number; // default: 10000
    useExponentialBackoff?: boolean; // default: true
    retryableStatusCodes?: number[]; // default: [408, 429, 499, 500, 502, 503, 504]

    // shouldRetry can return a boolean or a custom delay in milliseconds
    // When returning a number, it specifies the exact delay before the next retry
    // default: () => true
    shouldRetry?: (error: FetchError, attempt: number) => boolean | number;
}
```

### Custom Retry Logic

The `shouldRetry` function will be awaited and can return:

- `true` - Retry with default exponential backoff (uses `baseDelay`)
- `false` - Don't retry
- `number` - Retry with this exact delay in milliseconds (overrides exponential backoff)

**Examples:**

```typescript
// Use default retry configuration
const defaultRetryApi = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retry: true  // Uses defaults: 3 attempts, 1s base delay, exponential backoff
});

// Disable retries completely
const noRetryApi = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retry: false  // No retries at all
});

// Custom retry logic with shouldRetry
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retry: {
        maxAttempts: 5,
        baseDelay: 1000, // Used for exponential backoff when shouldRetry returns true
        shouldRetry: (error, attempt) => {
            // Custom delay for rate limits (overrides exponential backoff)
            if (error.status === 429) {
                const retryAfter = error.headers?.['retry-after'];
                return retryAfter ? parseInt(retryAfter) * 1000 : 5000;
            }

            // Don't retry client errors
            if (error.status >= 400 && error.status < 500) {
                return false;
            }

            // Custom delay for server errors (overrides exponential backoff)
            if (error.status >= 500) {
                return Math.min(1000 * Math.pow(2, attempt - 1), 30000);
            }

            return true; // Use default exponential backoff with baseDelay
        }
    }
});
```

## Timeout Configuration


FetchEngine provides two complementary timeout mechanisms for fine-grained control over request timing:

- **`totalTimeout`**: Caps the entire request lifecycle, including all retry attempts
- **`attemptTimeout`**: Applies per-attempt, with each retry getting a fresh timeout

### Type Definitions

```typescript
interface TimeoutOptions {

    /**
     * Total timeout for the entire request lifecycle in milliseconds.
     * Applies to the complete operation including all retry attempts.
     * When this fires, the request stops immediately with no more retries.
     */
    totalTimeout?: number;

    /**
     * Per-attempt timeout in milliseconds.
     * Each retry attempt gets a fresh timeout and AbortController.
     * When an attempt times out, it can still be retried (if retry is configured).
     */
    attemptTimeout?: number;

    /**
     * @deprecated Use `totalTimeout` instead. This is now an alias for `totalTimeout`.
     */
    timeout?: number;
}
```

### Basic Usage

```typescript
// Instance-level timeouts
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    totalTimeout: 30000,   // 30s max for entire operation
    attemptTimeout: 5000   // 5s per attempt
});

// Per-request overrides
const [response, err] = await attempt(() =>
    api.get('/slow-endpoint', {
        totalTimeout: 60000,   // Override: 60s for this request
        attemptTimeout: 10000  // Override: 10s per attempt
    })
);
```

### How Timeouts Work Together

When both timeouts are configured, they work in a parent-child relationship:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     totalTimeout (30s)                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │ Attempt 1 (5s)  │  │ Attempt 2 (5s)  │  │ Attempt 3 (5s)  │     │
│  │ attemptTimeout  │  │ attemptTimeout  │  │ attemptTimeout  │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│         ↓                    ↓                    ↓                 │
│     [timeout]            [timeout]            [success]            │
│     retry →              retry →              return               │
└─────────────────────────────────────────────────────────────────────┘
```

**Key behaviors:**

1. **totalTimeout fires**: Everything stops immediately, no more retries
2. **attemptTimeout fires**: That attempt fails, but can retry if configured
3. **Both configured**: Each attempt has its own fresh AbortController

### Controller Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Parent Controller                              │
│                 (totalTimeout attached)                           │
│                                                                   │
│    ┌───────────────┐   ┌───────────────┐   ┌───────────────┐    │
│    │    Child 1    │   │    Child 2    │   │    Child 3    │    │
│    │ (attempt 1)   │   │ (attempt 2)   │   │ (attempt 3)   │    │
│    │ attemptTimeout│   │ attemptTimeout│   │ attemptTimeout│    │
│    └───────────────┘   └───────────────┘   └───────────────┘    │
│                                                                   │
│  - Parent abort → All children abort (totalTimeout fired)        │
│  - Child abort → Only that attempt fails (attemptTimeout fired)  │
└──────────────────────────────────────────────────────────────────┘
```

### With Retry Configuration

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    totalTimeout: 30000,   // 30s total
    attemptTimeout: 5000,  // 5s per attempt
    retry: {
        maxAttempts: 5,
        baseDelay: 1000,
        useExponentialBackoff: true
    }
});

// Scenario: Each attempt can take up to 5s, retries if it times out
// Total operation cannot exceed 30s regardless of retry attempts
const [response, err] = await attempt(() => api.get('/flaky-endpoint'));

if (err && err.timedOut) {
    // The request timed out (either totalTimeout or attemptTimeout)
    console.log('Request timed out after all retries');
}
```

### The `timedOut` Flag

The `FetchError` object includes a `timedOut` flag that distinguishes timeout aborts from other abort causes:

```typescript
interface FetchError<T = {}, H = Record<string, string>> extends Error {

    // ... other properties

    /**
     * Whether the request was aborted (any cause: manual, timeout, or server).
     */
    aborted?: boolean;

    /**
     * Whether the abort was caused by a timeout (attemptTimeout or totalTimeout).
     * - `true`: The abort was caused by a timeout firing
     * - `undefined`: The abort was manual or server-initiated
     *
     * When `timedOut` is true, `aborted` will also be true.
     */
    timedOut?: boolean;
}
```

**Usage:**

```typescript
const [response, err] = await attempt(() =>
    api.get('/endpoint', { totalTimeout: 5000 })
);

if (err) {
    if (err.aborted && err.timedOut) {
        // Timed out - show user-friendly message
        console.log('Request took too long');
    }
    else if (err.aborted) {
        // Manual abort or server disconnect
        console.log('Request was cancelled');
    }
    else {
        // Other error (network, HTTP error, etc.)
        console.log('Request failed:', err.message);
    }
}
```

### Default Retry Behavior with Timeouts

The default `shouldRetry` function returns `true` for status code `499`, which is set when a request is aborted (including by `attemptTimeout`). This means:

- **attemptTimeout fires** → Status 499 → Can retry (if within maxAttempts)
- **totalTimeout fires** → Parent controller aborts → No retry possible

```typescript
// Default retry configuration
{
    maxAttempts: 3,
    baseDelay: 1000,
    retryableStatusCodes: [408, 429, 499, 500, 502, 503, 504],
    shouldRetry(error) {
        if (error.status === 499) return true; // Includes attemptTimeout
        return this.retryableStatusCodes?.includes(error.status) ?? false;
    }
}
```

### Migration from `timeout`

The `timeout` option is deprecated but continues to work as an alias for `totalTimeout`:

```typescript
// Old code (still works)
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    timeout: 5000
});

// New code (recommended)
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    totalTimeout: 5000
});

// Both are equivalent - totalTimeout applies to entire lifecycle
```

::: warning Migration Note
If you were using `timeout` expecting it to be per-attempt, you should now use `attemptTimeout` instead. The behavior of `timeout` (now `totalTimeout`) has always been for the entire operation.
:::

### Real-World Examples

**API Gateway with Strict Limits:**

```typescript
// Gateway has 30s hard limit, but individual services might be slow
const api = new FetchEngine({
    baseUrl: 'https://gateway.example.com',
    totalTimeout: 28000,    // Under gateway limit
    attemptTimeout: 8000,   // Allow slow services
    retry: {
        maxAttempts: 3,
        baseDelay: 500
    }
});
```

**User-Facing with Fallback:**

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    totalTimeout: 10000,    // Users won't wait more than 10s
    attemptTimeout: 3000,   // Quick feedback per attempt
    retry: {
        maxAttempts: 3,
        shouldRetry: (error) => {
            // Only retry on timeout, not on 4xx errors
            return error.timedOut || error.status >= 500;
        }
    }
});
```

**Background Sync with Long Tolerance:**

```typescript
const syncApi = new FetchEngine({
    baseUrl: 'https://sync.example.com',
    totalTimeout: 300000,   // 5 minutes for batch operations
    attemptTimeout: 60000,  // 1 minute per attempt
    retry: {
        maxAttempts: 5,
        baseDelay: 5000,
        useExponentialBackoff: true
    }
});
```

## Request Deduplication

When multiple parts of your application make identical requests simultaneously, FetchEngine can deduplicate them by sharing a single in-flight promise. This reduces network traffic, server load, and prevents race conditions.

### Quick Start

```typescript
// Enable with defaults (GET requests only)
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    dedupePolicy: true
});

// Three concurrent calls → one network request
const [user1, user2, user3] = await Promise.all([
    api.get('/users/123'),
    api.get('/users/123'),
    api.get('/users/123')
]);
// All three receive the same result from a single HTTP request
```

### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable/disable deduplication |
| `methods` | `HttpMethod[]` | `['GET']` | HTTP methods to deduplicate |
| `serializer` | `RequestSerializer` | `defaultRequestSerializer` | Function to generate request keys |
| `shouldDedupe` | `(ctx) => boolean` | - | Dynamic skip check (called per-request) |
| `rules` | `DedupeRule[]` | - | Route-specific configuration |

**Full Configuration Example:**

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    dedupePolicy: {
        enabled: true,
        methods: ['GET', 'POST'],
        serializer: (ctx) => `${ctx.method}:${ctx.path}:${JSON.stringify(ctx.payload)}`,
        shouldDedupe: (ctx) => !ctx.headers?.['X-Force-Fresh'],
        rules: [
            // Disable deduplication for admin endpoints
            { startsWith: '/admin', enabled: false },

            // Custom serializer for search (ignore timestamp param)
            {
                startsWith: '/search',
                serializer: (ctx) => `${ctx.method}:${ctx.path}:${ctx.payload?.query}`
            },

            // Enable POST deduplication for specific endpoint
            { is: '/graphql', methods: ['POST'] }
        ]
    }
});
```

### Deduplication Events

```typescript
// Emitted when a new request starts tracking
api.on('fetch-dedupe-start', (event) => {
    console.log('New request:', event.key);
});

// Emitted when a caller joins an existing in-flight request
api.on('fetch-dedupe-join', (event) => {
    console.log('Joined:', event.key, 'waiters:', event.waitingCount);
});
```

### Independent Timeout per Caller

Each caller can have independent timeout and abort constraints:

```typescript
// Caller A starts request with 10s timeout
const promiseA = api.get('/slow-endpoint', { timeout: 10000 });

// Caller B joins with 2s timeout
const promiseB = api.get('/slow-endpoint', { timeout: 2000 });

// After 2s: B times out and rejects → A continues waiting
// At 5s: Request completes → A gets the result

// Semantics:
// - Initiator's abort/timeout → cancels fetch → everyone fails
// - Joiner's abort/timeout → only that joiner fails → others unaffected
```

## Response Caching

FetchEngine supports response caching with TTL and stale-while-revalidate (SWR) for improved performance and reduced API load.

### Quick Start

```typescript
// Enable with defaults (GET requests, 60s TTL)
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    cachePolicy: true
});

// First call: fetches from network, caches response
const users1 = await api.get('/users');

// Subsequent calls within TTL: instant cache hit
const users2 = await api.get('/users');
```

### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable/disable caching |
| `methods` | `HttpMethod[]` | `['GET']` | HTTP methods to cache |
| `ttl` | `number` | `60000` | Time to live in milliseconds |
| `staleIn` | `number` | - | Time until stale for SWR (ms) |
| `serializer` | `RequestSerializer` | `defaultRequestSerializer` | Function to generate cache keys |
| `skip` | `(ctx) => boolean` | - | Dynamic skip check |
| `rules` | `CacheRule[]` | - | Route-specific configuration |
| `adapter` | `CacheAdapter<unknown>` | `MapCacheAdapter` | Custom cache storage backend |

**Full Configuration with SWR:**

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    cachePolicy: {
        enabled: true,
        methods: ['GET'],
        ttl: 300000,          // 5 minutes
        staleIn: 60000,       // Consider stale after 1 minute

        // Skip caching for certain requests
        skip: (ctx) => ctx.headers?.['Cache-Control'] === 'no-cache',

        rules: [
            // Long cache for static content
            { startsWith: '/static', ttl: 3600000 },

            // Short cache for user data
            { startsWith: '/user', ttl: 30000, staleIn: 10000 },

            // No caching for realtime endpoints
            { includes: '/realtime', enabled: false },

            // No caching for admin
            { startsWith: '/admin', enabled: false }
        ]
    }
});
```

### Stale-While-Revalidate (SWR)

When `staleIn` is configured, FetchEngine implements stale-while-revalidate:

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    cachePolicy: {
        ttl: 60000,      // Expire after 60 seconds
        staleIn: 30000   // Consider stale after 30 seconds
    }
});

// Timeline:
// 0-30s:  Fresh cache hit - returns cached data immediately
// 30-60s: Stale cache hit - returns cached data + background revalidation
// >60s:   Cache miss - fetches fresh data
```

### Cache Events

```typescript
// Fresh cache hit
api.on('fetch-cache-hit', (event) => {
    console.log('Cache hit:', event.key, 'expires in:', event.expiresIn);
});

// Stale cache hit (SWR)
api.on('fetch-cache-stale', (event) => {
    console.log('Stale hit:', event.key, 'revalidating...');
});

// Cache miss
api.on('fetch-cache-miss', (event) => {
    console.log('Cache miss:', event.key);
});

// New cache entry stored
api.on('fetch-cache-set', (event) => {
    console.log('Cached:', event.key, 'TTL:', event.expiresIn);
});

// SWR background revalidation started
api.on('fetch-cache-revalidate', (event) => {
    console.log('Background revalidation:', event.key);
});

// SWR background revalidation failed
api.on('fetch-cache-revalidate-error', (event) => {
    console.error('Revalidation failed:', event.key, event.error);
});
```

### Cache Invalidation

```typescript
// Clear all cached responses
await api.clearCache();

// Delete specific cache entry by key
await api.deleteCache(cacheKey);

// Invalidate entries matching a predicate
const count = await api.invalidateCache((key) => key.includes('user'));
console.log(`Invalidated ${count} entries`);

// Invalidate by path pattern (string prefix)
await api.invalidatePath('/users');

// Invalidate by path pattern (RegExp)
await api.invalidatePath(/^\/api\/v\d+\/users/);

// Get cache statistics
const stats = api.cacheStats();
console.log('Cache size:', stats.cacheSize);
console.log('In-flight:', stats.inflightCount);
```

### Custom Cache Adapters

FetchEngine supports pluggable cache backends via the `CacheAdapter` interface. This enables caching to Redis, IndexedDB, AsyncStorage, localStorage, or any custom storage.

```typescript
import { FetchEngine, CacheAdapter } from '@logosdx/fetch';
import { CacheItem } from '@logosdx/utils';

// Example: localStorage adapter
class LocalStorageCacheAdapter implements CacheAdapter<unknown> {

    #prefix: string;
    #data = new Map<string, CacheItem<unknown>>();

    constructor(prefix = 'api-cache') {
        this.#prefix = prefix;
        this.#loadFromStorage();
    }

    get size() { return this.#data.size; }

    async get(key: string) {
        return this.#data.get(key);
    }

    async set(key: string, item: CacheItem<unknown>) {
        this.#data.set(key, item);
        this.#saveToStorage();
    }

    async delete(key: string) {
        const existed = this.#data.delete(key);
        this.#saveToStorage();
        return existed;
    }

    async has(key: string) {
        return this.#data.has(key);
    }

    async clear() {
        this.#data.clear();
        localStorage.removeItem(this.#prefix);
    }

    #loadFromStorage() {
        const stored = localStorage.getItem(this.#prefix);
        if (stored) {
            const entries = JSON.parse(stored);
            this.#data = new Map(entries);
        }
    }

    #saveToStorage() {
        localStorage.setItem(this.#prefix, JSON.stringify([...this.#data]));
    }
}

// Use the custom adapter
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    cachePolicy: {
        adapter: new LocalStorageCacheAdapter('my-api'),
        ttl: 300000
    }
});
```

The `CacheAdapter` interface:

```typescript
interface CacheAdapter<T> {
    get(key: string): Promise<CacheItem<T> | undefined>;
    set(key: string, item: CacheItem<T>, expiresAt?: number): Promise<void>;
    delete(key: string): Promise<boolean>;
    has(key: string): Promise<boolean>;
    clear(): Promise<void>;
    readonly size: number;
}

interface CacheItem<T> {
    value: T;
    createdAt: number;
    expiresAt: number;
    staleAt?: number;  // For SWR
}
```

## Rate Limiting

Control outgoing request rates using a token bucket algorithm. Each unique request key (generated by the serializer) gets its own rate limiter, enabling per-endpoint or per-user throttling.

This re-uses the same rate limiting logic found in the [function utility in](https://logosdx.dev/packages/utils.html#ratelimit) utils package.

### Quick Start

```typescript
// Enable with defaults (100 requests/minute, all HTTP methods)
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    rateLimitPolicy: true
});

// Requests are automatically throttled
// If rate limit is exceeded, requests wait for tokens by default
await api.get('/users');  // Waits if needed
```

### Configuration

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    rateLimitPolicy: {
        // Global settings
        enabled: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],  // All by default
        maxCalls: 100,            // Requests per window (default: 100)
        windowMs: 60000,          // Time window in ms (default: 60000 = 1 minute)
        waitForToken: true,       // true = wait, false = reject immediately

        // Custom key generation (default: method + pathname)
        serializer: (ctx) => `${ctx.method}|${ctx.url.pathname}`,

        // Dynamic bypass
        shouldRateLimit: (ctx) => {
            // Return false to bypass rate limiting
            return !ctx.headers?.['X-Bypass-RateLimit'];
        },

        // Callback when rate limited
        onRateLimit: (ctx, waitTimeMs) => {
            console.log(`Rate limited for ${waitTimeMs}ms:`, ctx.path);
        },

        // Route-specific rules
        rules: [
            // Stricter limits for search
            { startsWith: '/api/search', maxCalls: 10, windowMs: 60000 },

            // Reject immediately for bulk operations
            { startsWith: '/api/bulk', waitForToken: false },

            // No rate limiting for health checks
            { startsWith: '/health', enabled: false },

            // Custom serializer for user-specific limiting
            {
                startsWith: '/api/user',
                serializer: (ctx) => `user:${ctx.headers?.['X-User-ID'] ?? 'anonymous'}`
            }
        ]
    }
});
```

### Token Bucket Algorithm

Rate limiting uses a token bucket that refills continuously:

- **Capacity**: `maxCalls` tokens
- **Refill Rate**: `maxCalls / windowMs` tokens per millisecond
- Each request consumes 1 token
- If no tokens available:
  - `waitForToken: true` → waits until token available
  - `waitForToken: false` → throws `RateLimitError` immediately

```typescript
// Example: 10 requests per minute = 1 token every 6 seconds
{
    maxCalls: 10,
    windowMs: 60000  // 60000ms / 10 = 6000ms per token
}
```

### Rate Limit Events

```typescript
// Emitted when request must wait for a token
api.on('fetch-ratelimit-wait', (event) => {
    console.log('Waiting for rate limit:', {
        key: event.key,
        waitTimeMs: event.waitTimeMs,
        currentTokens: event.currentTokens,
        capacity: event.capacity,
        nextAvailable: event.nextAvailable
    });
});

// Emitted when request is rejected (waitForToken: false)
api.on('fetch-ratelimit-reject', (event) => {
    console.log('Rate limit exceeded:', {
        key: event.key,
        waitTimeMs: event.waitTimeMs  // How long they would have waited
    });
});

// Emitted after token is successfully acquired
api.on('fetch-ratelimit-acquire', (event) => {
    console.log('Token acquired:', {
        key: event.key,
        currentTokens: event.currentTokens,  // Remaining tokens
        capacity: event.capacity
    });
});
```

### Rate Limiting Order

Rate limiting is evaluated **before** cache and deduplication:

```
Request → Rate Limit → Cache Check → Dedupe Check → Network
```

This means:

- Cached responses do NOT consume rate limit tokens
- Deduplicated requests only consume one token (the initiator's)
- Rate limiting protects your API from being overwhelmed

### Per-User Rate Limiting

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    rateLimitPolicy: {
        maxCalls: 100,
        windowMs: 60000,
        // Group requests by user ID
        serializer: (ctx) => `user:${ctx.state?.userId ?? 'anonymous'}`
    }
});

// Each user gets their own 100 req/min bucket
api.setState('userId', 'user-123');
await api.get('/data');  // Uses user-123's bucket

api.setState('userId', 'user-456');
await api.get('/data');  // Uses user-456's bucket
```

### Global Rate Limiting

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    rateLimitPolicy: {
        maxCalls: 1000,
        windowMs: 60000,
        // All requests share one bucket
        serializer: () => 'global'
    }
});
```

### Handling Rate Limit Errors

```typescript
import { attempt, isRateLimitError } from '@logosdx/utils';

const [response, err] = await attempt(() => api.get('/users'));

if (err) {
    if (isRateLimitError(err)) {
        console.log('Rate limited:', err.message);
        console.log('Limit:', err.limit);  // maxCalls value
        // Retry after some time, or show user feedback
    }
}
```

### Rate Limiting Types

```typescript
interface RateLimitConfig<S = unknown, H = unknown, P = unknown> {
    /** Enable rate limiting globally. Default: true */
    enabled?: boolean;

    /** HTTP methods to rate limit. Default: all methods */
    methods?: HttpMethod[];

    /** Maximum calls allowed within the time window. Default: 100 */
    maxCalls?: number;

    /** Time window in milliseconds. Default: 60000 (1 minute) */
    windowMs?: number;

    /** Wait for token (true) or reject immediately (false). Default: true */
    waitForToken?: boolean;

    /** Custom serializer for bucket key generation */
    serializer?: RequestSerializer<S, H, P>;

    /** Dynamic bypass callback. Return false to skip rate limiting */
    shouldRateLimit?: (ctx: RequestKeyOptions<S, H, P>) => boolean;

    /** Callback when rate limited (before waiting or rejecting) */
    onRateLimit?: (ctx: RequestKeyOptions<S, H, P>, waitTimeMs: number) => void | Promise<void>;

    /** Route-specific rules */
    rules?: RateLimitRule[];
}

interface RateLimitRule extends MatchTypes {
    methods?: HttpMethod[];
    enabled?: boolean;
    maxCalls?: number;
    windowMs?: number;
    waitForToken?: boolean;
    serializer?: RequestSerializer;
}

interface RateLimitEventData extends EventData {
    key: string;           // Rate limit bucket key
    currentTokens: number; // Current tokens in bucket
    capacity: number;      // Max capacity (maxCalls)
    waitTimeMs: number;    // Time until next token (ms)
    nextAvailable: Date;   // When next token available
}
```

## Route Matching

Deduplication, caching, and rate limiting all support flexible route matching via `MatchTypes`:

```typescript
interface MatchTypes {
    is?: string;           // Exact path match
    startsWith?: string;   // Path prefix match
    endsWith?: string;     // Path suffix match
    includes?: string;     // Path contains substring
    match?: RegExp;        // Regular expression match
}
```

**Match Type Behavior:**
- `is` requires an exact match and cannot be combined with other types
- Other types can be combined with AND logic (all must match)

**Examples:**

```typescript
const rules = [
    // Exact match
    { is: '/users' },

    // Prefix match
    { startsWith: '/api/v2' },

    // Suffix match
    { endsWith: '.json' },

    // Substring match
    { includes: 'admin' },

    // Regex match
    { match: /^\/v\d+\/users/ },

    // Combined (AND logic)
    { startsWith: '/api', endsWith: '.json' },  // Must satisfy both
    { includes: 'user', match: /\/\d+$/ }       // Must satisfy both
];
```

::: warning Regex Performance (ReDoS)
Route matching runs on **every request**. Poorly written regular expressions can cause catastrophic backtracking, severely degrading performance or hanging your application.

**Dangerous patterns to avoid:**

```typescript
// ❌ BAD: Nested quantifiers cause exponential backtracking
{ match: /(a+)+b/ }
{ match: /^\/api\/v\d+\/.*$/ }     // .* with anchors can backtrack
{ match: /(\w+)*@/ }               // Nested quantifiers

// ❌ BAD: Overlapping alternatives
{ match: /(a|a)+/ }
{ match: /(\d+|\d+\.)+/ }
```

**Safe patterns:**

```typescript
// ✅ GOOD: Simple, non-nested quantifiers
{ match: /^\/v\d+\/users/ }        // No trailing .*
{ match: /\/users\/\d+$/ }         // Anchored end, simple pattern
{ match: /\.(json|xml)$/ }         // Non-overlapping alternatives

// ✅ BETTER: Use string matchers when possible (faster, no ReDoS risk)
{ startsWith: '/api/v2' }          // Instead of /^\/api\/v2/
{ endsWith: '.json' }              // Instead of /\.json$/
{ includes: '/users/' }            // Instead of /\/users\//
```

**Best practice:** Prefer string-based matchers (`startsWith`, `endsWith`, `includes`, `is`) over regex. They're faster and immune to ReDoS. Only use `match` when you need pattern complexity that strings can't express.
:::

## Event System

FetchEngine extends EventTarget with comprehensive lifecycle events, providing observability in all JavaScript environments.

### Event Types

```typescript
enum FetchEventNames {
    // Request lifecycle
    'fetch-before' = 'fetch-before',
    'fetch-after' = 'fetch-after',
    'fetch-abort' = 'fetch-abort',
    'fetch-error' = 'fetch-error',
    'fetch-response' = 'fetch-response',
    'fetch-retry' = 'fetch-retry',

    // Configuration changes
    'fetch-header-add' = 'fetch-header-add',
    'fetch-header-remove' = 'fetch-header-remove',
    'fetch-param-add' = 'fetch-param-add',
    'fetch-param-remove' = 'fetch-param-remove',
    'fetch-state-set' = 'fetch-state-set',
    'fetch-state-reset' = 'fetch-state-reset',
    'fetch-url-change' = 'fetch-url-change',
    'fetch-modify-options-change' = 'fetch-modify-options-change',
    'fetch-modify-method-options-change' = 'fetch-modify-method-options-change',

    // Deduplication events
    'fetch-dedupe-start' = 'fetch-dedupe-start',
    'fetch-dedupe-join' = 'fetch-dedupe-join',

    // Caching events
    'fetch-cache-hit' = 'fetch-cache-hit',
    'fetch-cache-stale' = 'fetch-cache-stale',
    'fetch-cache-miss' = 'fetch-cache-miss',
    'fetch-cache-set' = 'fetch-cache-set',
    'fetch-cache-revalidate' = 'fetch-cache-revalidate',
    'fetch-cache-revalidate-error' = 'fetch-cache-revalidate-error',

    // Rate limiting events
    'fetch-ratelimit-wait' = 'fetch-ratelimit-wait',
    'fetch-ratelimit-reject' = 'fetch-ratelimit-reject',
    'fetch-ratelimit-acquire' = 'fetch-ratelimit-acquire'
}
```

### Event Methods

#### `on(event, callback)`

```typescript
on<E extends FetchEventNames>(
    event: E | '*',
    callback: (event: FetchEvent) => void
): () => void
```

Listen to events. Returns cleanup function.

**Example:**

```typescript
// Listen to specific event
const cleanup = api.on('fetch-error', (event) => {
    console.error('Request failed:', event.error?.message);
});

// Listen to all events
api.on('*', (event) => {
    console.log(`Event: ${event.type}`, event);
});

// Listen to modify options changes
api.on('fetch-modify-options-change', (event) => {
    console.log('Global modifier changed:', event.data ? 'set' : 'cleared');
});

// Listen to method-specific modify options changes
api.on('fetch-modify-method-options-change', (event) => {
    console.log(`${event.data.method} modifier:`, event.data.fn ? 'set' : 'cleared');
});

// Clean up listener
cleanup();
```

#### `once(event, callback)`

Listen to event once.

```typescript
once<E extends FetchEventNames>(
    event: E,
    callback: (event: FetchEvent) => void
): () => void
```

#### `off(event, callback)`

Remove event listeners.

```typescript
off<E extends FetchEventNames>(
    event: E | '*',
    callback?: (event: FetchEvent) => void
): void
```

#### `emit(event, data?)`

Manually emit events.

```typescript
emit<E extends FetchEventNames>(event: E | Event, data?: unknown): void
```

### Event Object Structure

```typescript
interface FetchEvent {
    type: FetchEventNames;
    url?: string;
    path?: string;
    method?: HttpMethods;
    headers?: Record<string, string>;
    data?: any;
    response?: Response;
    error?: FetchError;
    attempt?: number;
    nextAttempt?: number;
    maxAttempts?: number;
    delay?: number;
    state?: any;
    header?: string;
    value?: string;
    param?: string;
}
```

## Lifecycle Management

### `destroy()`

```typescript
destroy(): void
```

Destroys the FetchEngine instance and cleans up resources. After calling `destroy()`, new requests will throw an error. This method prevents memory leaks by clearing internal state references and automatically removing all event listeners added via `on()` or `once()`.

**Event Listener Cleanup:**
- Listeners added via `on()` or `once()` are **automatically removed** when `destroy()` is called
- Listeners added via `addEventListener()` with your own AbortController must be cleaned up manually
- `on()` returns a cleanup function if you need manual control before destroy

**Example:**

```typescript
// Basic cleanup - listeners added via on() automatically cleaned up
const api = new FetchEngine({ baseUrl: 'https://api.example.com' });

const cleanup = api.on('fetch-error', (e) => console.error(e));

// destroy() automatically removes the listener above
api.destroy();

// Attempting requests after destroy throws error
await api.get('/users'); // throws: "Cannot make requests on destroyed FetchEngine instance"

// Option 1: Use on() with cleanup function (recommended)
const errorCleanup = api.on('fetch-error', errorHandler);
const responseCleanup = api.on('fetch-response', responseHandler);

// Manual cleanup if needed before destroy
errorCleanup();
responseCleanup();

// Or just destroy - automatically removes all on() listeners
api.destroy();

// Option 2: Use off() for manual removal
api.on('fetch-error', errorHandler);
api.on('fetch-response', responseHandler);

api.off('fetch-error', errorHandler);
api.off('fetch-response', responseHandler);
api.destroy();

// Option 3: Use addEventListener with your own AbortController (advanced)
const controller = new AbortController();

api.addEventListener('fetch-error', errorHandler, { signal: controller.signal });
api.addEventListener('fetch-response', responseHandler, { signal: controller.signal });

controller.abort(); // Required - not automatic
api.destroy();

// Component lifecycle integration (simplest approach)
class MyComponent {

    constructor() {

        this.api = new FetchEngine({ baseUrl: 'https://api.example.com' });

        // on() automatically cleaned up on destroy()
        api.on('fetch-error', this.handleError);
        api.on('fetch-response', this.handleResponse);
    }

    async fetchData() {

        if (this.api.isDestroyed()) {

            throw new Error('API instance destroyed');
        }
        return this.api.get('/data');
    }

    destroy() {

        // Automatically removes all listeners added via on()
        this.api.destroy();
        this.api = null;
    }
}
```

### `isDestroyed()`

```typescript
isDestroyed(): boolean
```

Checks if the FetchEngine instance has been destroyed.

**Example:**

```typescript
if (!api.isDestroyed()) {

    await api.get('/users');
}
```

## Error Handling

### FetchError

```typescript
interface FetchError<T = {}, H = Record<string, string>> extends Error {
    data: T | null;            // Response body (if parseable)
    status: number;            // HTTP status code
    method: HttpMethods;       // HTTP method used
    path: string;              // Request path
    aborted?: boolean;         // Whether request was cancelled (any cause)
    timedOut?: boolean;        // Whether abort was caused by timeout
    attempt?: number;          // Retry attempt number
    step?: 'fetch' | 'parse' | 'response'; // Where error occurred
    url?: string;              // Full request URL
    headers?: H;               // Response headers

    // Helper methods for distinguishing 499 error types
    isCancelled(): boolean;    // Manual abort (user/app initiated)
    isTimeout(): boolean;      // Timeout fired (attemptTimeout or totalTimeout)
    isConnectionLost(): boolean; // Server/network dropped connection
}
```

**Important:**

- Server-aborted responses receive status code `499` (following Nginx convention)
- Parse errors without status codes receive status code `999`

### FetchError Helper Methods

All three scenarios below result in status code 499, but have different causes. Use these helper methods to distinguish them:

| Method | Returns `true` when | Use case |
|--------|---------------------|----------|
| `isCancelled()` | Request was manually aborted (not by timeout) | User navigated away, component unmounted |
| `isTimeout()` | Timeout fired (`attemptTimeout` or `totalTimeout`) | Show "request timed out" message |
| `isConnectionLost()` | Server dropped connection or network failed | Show "connection lost" message |

::: info
All helper methods return `false` for non-499 errors. They only apply to connection-level failures.
:::

**Example:**

```typescript
const [response, err] = await attempt(() => api.get('/data'));

if (err) {
    if (err.isCancelled()) {
        // User/app intentionally cancelled - don't show error
        return;
    }

    if (err.isTimeout()) {
        toast.warn('Request timed out. Please try again.');
    }
    else if (err.isConnectionLost()) {
        toast.error('Connection lost. Check your internet.');
    }
    else {
        // HTTP error (4xx, 5xx) - check err.status directly
        toast.error(`Request failed: ${err.message}`);
    }
}
```

**How it works:**

The helpers combine multiple error properties to determine the cause:

```typescript
// isCancelled(): Manual abort (user navigated away, app cancelled)
status === 499 && aborted === true && timedOut !== true

// isTimeout(): Our timeout fired
status === 499 && timedOut === true

// isConnectionLost(): Server/network dropped us (we didn't abort)
status === 499 && step === 'fetch' && aborted === false
```

### Type Guard

```typescript
isFetchError(error: unknown): error is FetchError
```

**Example:**

```typescript
const [response, err] = await attempt(() => api.get('/users'));

if (err) {
    if (isFetchError(err)) {
        // Types are available
        console.log('HTTP Error:', err.status, err.message);
        console.log('Failed at step:', err.step);
        console.log('Response data:', err.data);
    } else {
        console.log('Network or other error:', err.message);
    }
}
```

## Type Definitions

### Common Types

```typescript
type HttpMethods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'PATCH' | string;

type Headers<H = Record<string, string>> = H & Record<string, string>;

type Params<P = Record<string, string | number | boolean>> = P & Record<string, string | number | boolean>;

interface RequestOpts<H = any, P = any> {
    method: HttpMethods;
    url: string;
    headers: Headers<H>;
    params: Params<P>;
    payload?: any;
    /** @deprecated Use totalTimeout instead */
    timeout?: number;
    totalTimeout?: number;
    attemptTimeout?: number;
    retry?: RetryConfig | false;
}
```

### Route Matching Types

```typescript
interface MatchTypes {
    is?: string;           // Exact path match
    startsWith?: string;   // Path prefix match
    endsWith?: string;     // Path suffix match
    includes?: string;     // Path contains substring
    match?: RegExp;        // Regular expression match
}

interface RequestKeyOptions<S = unknown, H = unknown, P = unknown> {
    method: string;
    path: string;
    payload?: unknown;
    headers?: H;
    params?: P;
    state?: S;
}

type RequestSerializer<S, H, P> = (ctx: RequestKeyOptions<S, H, P>) => string;
```

### Deduplication Types

```typescript
interface DeduplicationConfig<S = unknown, H = unknown, P = unknown> {
    enabled?: boolean;                              // Default: true
    methods?: HttpMethod[];                         // Default: ['GET']
    serializer?: RequestSerializer<S, H, P>;        // Default: defaultRequestSerializer
    shouldDedupe?: (ctx: RequestKeyOptions<S, H, P>) => boolean;
    rules?: DedupeRule[];
}

interface DedupeRule extends MatchTypes {
    methods?: HttpMethod[];
    enabled?: boolean;
    serializer?: RequestSerializer;
}
```

### Caching Types

```typescript
interface CacheConfig<S = unknown, H = unknown, P = unknown> {
    enabled?: boolean;                              // Default: true
    methods?: HttpMethod[];                         // Default: ['GET']
    ttl?: number;                                   // Default: 60000 (1 minute)
    staleIn?: number;                               // Default: undefined (no SWR)
    serializer?: RequestSerializer<S, H, P>;
    skip?: (ctx: RequestKeyOptions<S, H, P>) => boolean;
    rules?: CacheRule[];
}

interface CacheRule extends MatchTypes {
    methods?: HttpMethod[];
    enabled?: boolean;
    ttl?: number;
    staleIn?: number;
    serializer?: RequestSerializer;
    skip?: (ctx: RequestKeyOptions) => boolean;
}
```

### Rate Limiting Types

```typescript
interface RateLimitConfig<S = unknown, H = unknown, P = unknown> {
    enabled?: boolean;                              // Default: true
    methods?: HttpMethod[];                         // Default: all methods
    maxCalls?: number;                              // Default: 100
    windowMs?: number;                              // Default: 60000 (1 minute)
    waitForToken?: boolean;                         // Default: true
    serializer?: RequestSerializer<S, H, P>;
    shouldRateLimit?: (ctx: RequestKeyOptions<S, H, P>) => boolean;
    onRateLimit?: (ctx: RequestKeyOptions<S, H, P>, waitTimeMs: number) => void | Promise<void>;
    rules?: RateLimitRule[];
}

interface RateLimitRule extends MatchTypes {
    methods?: HttpMethod[];
    enabled?: boolean;
    maxCalls?: number;
    windowMs?: number;
    waitForToken?: boolean;
    serializer?: RequestSerializer;
}
```

### TypeScript Module Declaration

Extend interfaces for better type safety in your application:

```typescript
declare module '@logosdx/fetch' {
    namespace FetchEngine {
        interface InstanceHeaders {
            Authorization?: string;
            'Content-Type'?: string;
            'X-API-Key'?: string;
            'X-User-ID'?: string;
        }

        interface InstanceParams {
            version?: string;
            format?: 'json' | 'xml';
            locale?: string;
        }

        interface InstanceResponseHeaders extends Record<string, string> {
            'x-rate-limit-remaining'?: string;
            'x-rate-limit-reset'?: string;
            'x-request-id'?: string;
            'content-type'?: string;
        }

        interface InstanceState {
            authToken?: string;
            userId?: string;
            sessionId?: string;
            preferences?: {
                theme: 'light' | 'dark';
                language: string;
            };
        }
    }
}

// Now both custom instances and the global instance are typed
import fetch, { get, post } from '@logosdx/fetch';

// All methods are properly typed with your custom interfaces
fetch.addHeader('X-API-Key', 'key123'); // ✅ Typed
fetch.setState('authToken', 'token'); // ✅ Typed

// Response is properly typed with FetchResponse including typed config
const [response] = await attempt(() => get<User>('/api/data')); // ✅ Typed
if (response) {
    response.data;    // ✅ Typed as User
    response.status;  // ✅ Typed as number
    response.headers; // ✅ Typed as Partial<InstanceResponseHeaders>
    response.headers['x-rate-limit-remaining']; // ✅ Typed access to response headers
    response.config.headers; // ✅ Typed as InstanceHeaders
    response.config.params;  // ✅ Typed as InstanceParams
}
```

## Advanced Configuration Examples

### Production Setup

```typescript
const api = new FetchEngine({
    baseUrl: process.env.API_BASE_URL!,
    defaultType: 'json',
    totalTimeout: 30000,      // 30s max for entire operation
    attemptTimeout: 10000,    // 10s per attempt

    // Global headers
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },

    // Request deduplication - prevent duplicate concurrent requests
    dedupePolicy: {
        enabled: true,
        methods: ['GET'],
        rules: [
            { includes: '/realtime', enabled: false },
            { includes: '/stream', enabled: false }
        ]
    },

    // Response caching with SWR for fast responses
    cachePolicy: {
        enabled: true,
        methods: ['GET'],
        ttl: 60000,           // 1 minute
        staleIn: 30000,       // Stale after 30 seconds
        rules: [
            { startsWith: '/static', ttl: 3600000 },    // 1 hour for static
            { startsWith: '/user/me', ttl: 300000 },    // 5 minutes for profile
            { includes: '/realtime', enabled: false }    // No caching for realtime
        ]
    },

    // Rate limiting - protect against overwhelming the API
    rateLimitPolicy: {
        enabled: true,
        maxCalls: 100,        // 100 requests per minute
        windowMs: 60000,
        waitForToken: true,   // Wait rather than reject
        rules: [
            { startsWith: '/api/search', maxCalls: 10 },       // Stricter for search
            { startsWith: '/api/bulk', waitForToken: false },  // Reject bulk if limited
            { startsWith: '/health', enabled: false }          // No limits for health
        ]
    },

    // Authentication and context injection
    modifyOptions: (opts, state) => {
        if (state.authToken) {
            opts.headers.Authorization = `Bearer ${state.authToken}`;
        }
        if (state.userId) {
            opts.headers['X-User-ID'] = state.userId;
        }
        if (state.sessionId) {
            opts.headers['X-Session-ID'] = state.sessionId;
        }
        return opts;
    },

    // Intelligent retry logic
    retry: {
        maxAttempts: 3,
        baseDelay: 1000,
        useExponentialBackoff: true,
        shouldRetry: (error, attempt) => {
            // Don't retry if user aborted
            if (error.aborted) return false;

            // Don't retry client errors except rate limits
            if (error.status >= 400 && error.status < 500 && error.status !== 429) {
                return false;
            }

            // Respect rate limit headers
            if (error.status === 429) {
                const retryAfter = error.headers?.['retry-after'];
                return retryAfter ? parseInt(retryAfter) * 1000 : 5000;
            }

            // Retry server errors and network failures
            return error.status >= 500 || !error.status;
        }
    },

    // Request/response validation
    validate: {
        state: (state) => {
            if (process.env.NODE_ENV === 'production' && !state.authToken) {
                throw new Error('Authentication required in production');
            }
        }
    },

    // Custom response type detection
    determineType: (response) => {
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/vnd.api+json')) {
            return 'json'; // JSON:API responses
        }

        if (response.url.includes('/download/')) {
            return 'blob'; // Force blob for downloads
        }

        return FetchEngine.useDefault; // Use built-in detection
    }
});

// Production monitoring
api.on('fetch-error', (event) => {
    errorReporting.captureException(event.error, {
        tags: {
            endpoint: event.path,
            method: event.method,
            status: event.error?.status
        },
        extra: {
            attempt: event.attempt,
            userId: api.getState().userId
        }
    });
});

api.on('fetch-after', (event) => {
    metrics.timing('api.request', event.duration, {
        endpoint: event.path,
        method: event.method,
        status: event.response?.status
    });
});

// Cache monitoring
api.on('fetch-cache-hit', (event) => {
    metrics.increment('api.cache.hit', { path: event.path });
});

api.on('fetch-cache-miss', (event) => {
    metrics.increment('api.cache.miss', { path: event.path });
});

api.on('fetch-cache-stale', (event) => {
    metrics.increment('api.cache.stale', { path: event.path });
});

// Deduplication monitoring
api.on('fetch-dedupe-join', (event) => {
    metrics.increment('api.dedupe.saved', { path: event.path });
    logger.debug(`Request deduplicated: ${event.key}, waiters: ${event.waitingCount}`);
});
```

### Development Setup

```typescript
const isDev = process.env.NODE_ENV === 'development';

const api = new FetchEngine({
    baseUrl: 'http://localhost:3001/api',
    totalTimeout: isDev ? 60000 : 30000,  // Longer total timeout in dev
    attemptTimeout: isDev ? 30000 : 10000, // Longer per-attempt in dev
    retry: isDev ? false : { // No retries in dev, 3 retries in prod
        maxAttempts: 3,
        baseDelay: 1000
    }
});

// Development-only logging
if (isDev) {
    api.on('*', (event) => {
        console.group(`🌐 API ${event.type}`);
        console.log('Event:', event);
        console.groupEnd();
    });
}
```
