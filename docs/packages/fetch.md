---
title: Fetch
description: HTTP that handles failure. Automatically.
---

# Fetch

Your API calls fail and `fetch` just throws. `@logosdx/fetch` transforms the basic Fetch API into a production-ready HTTP client. Automatic retries with exponential backoff, configurable timeouts, request cancellation, and comprehensive lifecycle events. Smart retry strategy for transient failures (network errors, 429s, 500s). Configure once with base URLs and headers, then make type-safe requests that handle network failures gracefully. It's `fetch`, but built for the real world.

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
    timeout: 5000
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
    timeout: 5000
});
```

### Configuration Options

**Note:** `FetchEngine.Options` extends the Fetch API's `RequestInit` interface. Any standard Fetch API options can be passed and will be merged with `FetchEngine` defaults.

**FetchEngine Options**

| Option                | Type                                                                                          | Description                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `baseUrl` (required)  | `string`                                                                                      | The base URL for all requests                                                       |
| `defaultType`         | `'json' \| 'text' \| 'blob' \| 'arrayBuffer' \| 'formData'`                                   | The default type of response expected from the server                               |
| `timeout`             | `number`                                                                                      | Default timeout in milliseconds for all requests                                    |
| `headers`             | `Headers<H>`                                                                                  | The headers to be set on all requests                                               |
| `methodHeaders`       | `{ [key in HttpMethods]?: Headers<H> }`                                                       | The headers to be set on requests of a specific method                              |
| `params`              | `Params<P>`                                                                                   | The parameters to be set on all requests                                            |
| `methodParams`        | `{ [key in HttpMethods]?: Params<P> }`                                                        | The parameters to be set on requests of a specific method                           |
| `retry`         | `RetryConfig \| boolean`                                                                      | The retry configuration for the fetch request. Set to `false` to disable retries, `true` to use defaults |
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
    timeout?: number;
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
| `timeout`         | `number`          | The timeout for the request in milliseconds                             |
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
    timeout?: number
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

## Event System

FetchEngine extends EventTarget with comprehensive lifecycle events, providing observability in all JavaScript environments.

### Event Types

```typescript
enum FetchEventNames {
    'fetch-before' = 'fetch-before',
    'fetch-after' = 'fetch-after',
    'fetch-abort' = 'fetch-abort',
    'fetch-error' = 'fetch-error',
    'fetch-response' = 'fetch-response',
    'fetch-header-add' = 'fetch-header-add',
    'fetch-header-remove' = 'fetch-header-remove',
    'fetch-param-add' = 'fetch-param-add',
    'fetch-param-remove' = 'fetch-param-remove',
    'fetch-state-set' = 'fetch-state-set',
    'fetch-state-reset' = 'fetch-state-reset',
    'fetch-url-change' = 'fetch-url-change',
    'fetch-retry' = 'fetch-retry',
    'fetch-modify-options-change' = 'fetch-modify-options-change',
    'fetch-modify-method-options-change' = 'fetch-modify-method-options-change'
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
    aborted?: boolean;         // Whether request was cancelled
    attempt?: number;          // Retry attempt number
    step?: 'fetch' | 'parse' | 'response'; // Where error occurred
    url?: string;              // Full request URL
    headers?: H;               // Response headers
}
```

**Important:**

- Server-aborted responses receive status code `499` (following Nginx convention)
- Parse errors without status codes receive status code `999`

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
    timeout?: number;
    retry?: RetryConfig | false;
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
    timeout: 10000,

    // Global headers
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
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
```

### Development Setup

```typescript
const isDev = process.env.NODE_ENV === 'development';

const api = new FetchEngine({
    baseUrl: 'http://localhost:3001/api',
    timeout: isDev ? 30000 : 10000, // Longer timeout in dev
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
