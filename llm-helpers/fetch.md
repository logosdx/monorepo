---
description: Usage patterns for the @logosdx/fetch package.
globs: *.ts
---

# @logosdx/fetch

HTTP client with retry logic, request/response interception, and comprehensive error handling for production applications.

## Core API

```typescript
import { FetchEngine, FetchError, FetchEvent, FetchEventNames, FetchResponse, isFetchError } from '@logosdx/fetch';
import { attempt } from '@logosdx/utils';

// Basic setup
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    defaultType: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData',
    headers: { Authorization: 'Bearer token' },
    timeout: 5000
});

// Error handling pattern
const [response, err] = await attempt(() => api.get('/users/123'));
if (err) {
    console.error('Request failed:', err.status, err.message);
    return;
}

const { data: user } = response;
console.log('User:', user);
console.log('Rate limit:', response.headers['x-rate-limit-remaining']);

// Global instance (simplified usage)
import fetch, { get, post, setState, addHeader } from '@logosdx/fetch';

// Global instance auto-uses current domain as base URL
const [{ data: users }, err] = await attempt(() => fetch.get('/api/users'));

// Or use destructured methods
addHeader('Authorization', 'Bearer token');
setState('userId', '123');
const [{ data: user }, err] = await attempt(() => get('/api/users/123'));

// Smart URL handling - absolute URLs bypass base URL
const [{ data: external }, err] = await attempt(() => get('https://api.external.com/data'));
```

## HTTP Methods

```typescript
// All methods return AbortablePromise<FetchResponse<T>>
interface AbortablePromise<T> extends Promise<T> {
    isFinished: boolean;
    isAborted: boolean;
    abort(reason?: string): void;
}

// Enhanced response object with typed headers, params, and response headers
interface FetchResponse<T = any, H = FetchEngine.InstanceHeaders, P = FetchEngine.InstanceParams, RH = FetchEngine.InstanceResponseHeaders> {
    data: T;                // Parsed response body
    headers: Partial<RH>;   // Response headers as typed plain object
    status: number;         // HTTP status code
    request: Request;       // Original request object
    config: FetchConfig<H, P>;  // Typed configuration used for request
}

// Configuration object with typed headers and params
interface FetchConfig<H = FetchEngine.InstanceHeaders, P = FetchEngine.InstanceParams> {
    baseUrl?: string;
    timeout?: number;
    headers?: H;            // Typed headers from your custom interface
    params?: P;             // Typed params from your custom interface
    retry?: RetryConfig | false;
    method?: string;
    determineType?: any;
}

// HTTP convenience methods - all return FetchResponse with typed config and response headers
api.get<User, RH>(path, options?): AbortablePromise<FetchResponse<User, H, P, RH>>
api.post<User, CreateUserData, RH>(path, payload?, options?): AbortablePromise<FetchResponse<User, H, P, RH>>
api.put<User, UpdateUserData, RH>(path, payload?, options?): AbortablePromise<FetchResponse<User, H, P, RH>>
api.patch<User, Partial<User>, RH>(path, payload?, options?): AbortablePromise<FetchResponse<User, H, P, RH>>
api.delete<void, any, RH>(path, payload?, options?): AbortablePromise<FetchResponse<void, H, P, RH>>
api.options<any, RH>(path, options?): AbortablePromise<FetchResponse<any, H, P, RH>>

// Generic request method
api.request<Response, RequestData, RH>(method, path, options & { payload?: RequestData }): AbortablePromise<FetchResponse<Response, H, P, RH>>

// Request cancellation
const request = api.get('/users');
setTimeout(() => request.abort('User cancelled'), 2000);

// Dynamic request modification
api.changeModifyOptions(fn?: (opts: RequestOpts, state: S) => RequestOpts)
api.changeModifyMethodOptions(method: HttpMethods, fn?: (opts: RequestOpts, state: S) => RequestOpts)
```

## Configuration

```typescript
interface FetchEngine.Options<H, P, S> {
    baseUrl: string;
    defaultType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData';

    // Headers - global and method-specific
    headers?: Headers<H>;
    methodHeaders?: {
        GET?: Headers<H>;
        POST?: Headers<H>;
        // ... other methods
    };

    // URL parameters - global and method-specific
    params?: Params<P>;
    methodParams?: {
        GET?: Params<P>;
        // ... other methods
    };

    // Retry configuration (set to false to disable retries)
    retry?: {
        maxAttempts?: number; // default: 3
        baseDelay?: number; // default: 1000 (in milliseconds)
        maxDelay?: number; // default: 10000
        useExponentialBackoff?: boolean; // default: true
        retryableStatusCodes?: number[]; // default: [408, 429, 500, 502, 503, 504]
        shouldRetry?: (error: FetchError, attempt: number) => boolean | number;
    } | false;

    // Request modification (initial setup)
    modifyOptions?: (opts: RequestOpts<H, P>, state: S) => RequestOpts<H>;
    modifyMethodOptions?: {
        GET?: (opts: RequestOpts<H, P>, state: S) => RequestOpts<H>;
        // ... other methods
    };
    // Note: Use changeModifyOptions() and changeModifyMethodOptions() for runtime changes

    // Validation
    validate?: {
        headers?: (headers: Headers<H>, method?: HttpMethods) => void;
        params?: (params: Params<P>, method?: HttpMethods) => void;
        state?: (state: S) => void;
        perRequest?: {
            headers?: boolean;
            params?: boolean;
        };
    };

    // Response type determination
    determineType?: (response: Response) => 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData' | Symbol;

}
```

## Error Handling

```typescript
interface FetchError<T = {}, H = FetchEngine.Headers> extends Error {
    data: T | null;
    status: number;
    method: HttpMethods;
    path: string;
    aborted?: boolean;
    attempt?: number;
    step?: 'fetch' | 'parse' | 'response';
    url?: string;
    headers?: H;
}

// Error checking - FetchError is thrown on failure
if (isFetchError(error)) {
    console.log('Fetch error:', error.status, error.step);
    console.log('Failed URL:', error.url);
    console.log('Response data (if any):', error.data);
}

// Lifecycle events
api.on('fetch-error', (event: FetchEvent) => {
    console.error('Request failed:', event.error);
});

api.on('fetch-retry', (event: FetchEvent) => {
    console.log(`Retrying attempt ${event.nextAttempt} after ${event.delay}ms`);
});
```

## Headers & Parameters Management

```typescript
// Headers
api.addHeader('Authorization', 'Bearer new-token');
api.addHeader({ 'X-API-Version': 'v2', 'X-Client': 'web' });
api.addHeader('Content-Type', 'application/json', 'POST'); // method-specific
api.rmHeader('Authorization');
api.rmHeader(['X-API-Version', 'X-Client']);
api.hasHeader('Authorization'); // boolean

// Parameters
api.addParam('version', 'v1');
api.addParam({ api_key: 'abc123', format: 'json' });
api.addParam('page', '1', 'GET'); // method-specific
api.rmParams('version');
api.hasParam('api_key'); // boolean

// Access current configuration
const { default: globalHeaders, get: getHeaders } = api.headers;
const { default: globalParams, get: getParams } = api.params;

// With global instance and destructured methods
import { addHeader, addParam, rmHeader, hasHeader, changeModifyOptions, changeModifyMethodOptions } from '@logosdx/fetch';
addHeader('X-API-Key', 'key123');
addParam('version', 'v1');

// Dynamic request modification
changeModifyOptions((opts, state) => {
    opts.headers['X-Request-ID'] = crypto.randomUUID();
    return opts;
});

changeModifyMethodOptions('POST', (opts, state) => {
    opts.headers['Content-Type'] = 'application/json';
    return opts;
});
```

## State Management

```typescript
// Internal state for auth tokens, user context, etc.
api.setState('authToken', 'bearer-token-123');
api.setState({
    userId: '456',
    sessionId: 'abc',
    preferences: { theme: 'dark' }
});

const state = api.getState(); // deep clone
api.resetState(); // clear all state

// Use state in request modification
const api = new FetchEngine<MyHeaders, MyParams, MyState>({
    baseUrl: 'https://api.example.com',
    modifyOptions: (opts, state) => {
        if (state.authToken) {
            opts.headers.Authorization = `Bearer ${state.authToken}`;
        }
        return opts;
    }
});

// Access response metadata with typed config
const response = await api.get('/users');
if (response.status === 200) {
    console.log('Success! Users:', response.data);
    console.log('Request URL:', response.request.url);
    console.log('Config used:', response.config);
    console.log('Rate limit:', response.headers['x-rate-limit-remaining']);
    // response.config.headers is typed as MyHeaders
    // response.config.params is typed as MyParams
    // response.headers is typed as Partial<InstanceResponseHeaders>
}
```

## Event System

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
    'fetch-retry' = 'fetch-retry'
}

// Event listeners
api.on('*', (event) => console.log('Any event:', event.type));
api.on('fetch-before', (event) => console.log('Request starting:', event.url));
api.on('fetch-error', (event) => console.error('Request failed:', event.error));
api.off('fetch-error', errorHandler); // remove listener
```

## Advanced Features

```typescript
// Disable retries completely
const noRetryApi = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retry: false  // No retries at all
});

// Accept default retry configs
const noRetryApi = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retry: true || {}  // Accept default retry configs
});

// Custom retry logic with shouldRetry controlling delays
const customRetryApi = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retry: {
        maxAttempts: 5,
        baseDelay: 1000,  // Base delay for exponential backoff
        shouldRetry: (error, attempt) => {
            // Return custom delay in milliseconds for rate limits
            if (error.status === 429) {
                const retryAfter = error.headers?.['retry-after'];
                return retryAfter ? parseInt(retryAfter) * 1000 : 5000;
            }

            // Don't retry client errors
            if (error.status >= 400 && error.status < 500) {
                return false;
            }

            // Return custom delay for server errors
            if (error.status >= 500) {
                // Custom delay calculation overrides exponential backoff
                return Math.min(2000 * attempt, 10000);
            }

            return true;  // Use default exponential backoff
        }
    }
});

// Custom type determination
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    determineType: (response) => {
        if (response.url.includes('/download')) return 'blob';
        if (response.url.includes('/csv')) return 'text';
        return FetchEngine.useDefault; // fall back to built-in detection
    }
});

// Environment switching
api.changeBaseUrl('https://api.staging.com');

// Dynamic request modification
api.changeModifyOptions((opts, state) => {
    if (state.authToken) {
        opts.headers.Authorization = `Bearer ${state.authToken}`;
    }
    opts.headers['X-Request-ID'] = crypto.randomUUID();
    return opts;
});

api.changeModifyMethodOptions('POST', (opts, state) => {
    opts.headers['Content-Type'] = 'application/json';
    return opts;
});

// Clear modifiers
api.changeModifyOptions(undefined);
api.changeModifyMethodOptions('POST', undefined);

// Per-request options
const [response, err] = await attempt(() =>
    api.get('/users', {
        timeout: 10000,
        headers: { 'X-Request-ID': '123' },
        params: { include: 'profile' },
        onBeforeReq: (opts) => console.log('Making request:', opts),
        onAfterReq: (response) => console.log('Response:', response.status),
        onError: (error) => console.error('Error:', error),
        retry: { maxAttempts: 5 }
    })
);

if (!err) {
    console.log('Users:', response.data);
    console.log('Rate limit remaining:', response.headers['x-rate-limit-remaining']);
    console.log('Request ID:', response.headers['x-request-id']);
}
```

## TypeScript Patterns

```typescript
// Extend interfaces for type safety
declare module '@logosdx/fetch' {
    namespace FetchEngine {
        interface InstanceHeaders {
            Authorization?: string;
            'Content-Type'?: string;
            'X-API-Key'?: string;
        }

        interface InstanceParams {
            version?: string;
            format?: 'json' | 'xml';
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
        }
    }
}

// Now both custom instances and global instance use the same types
const api = new FetchEngine<
    FetchEngine.InstanceHeaders,
    FetchEngine.InstanceParams,
    FetchEngine.InstanceState,
    FetchEngine.InstanceResponseHeaders
>({
    baseUrl: 'https://api.example.com',
    validate: {
        headers: (headers) => {
            if (!headers.Authorization) {
                throw new Error('Authorization required');
            }
        },
        state: (state) => {
            if (state.userId && !state.sessionId) {
                throw new Error('Session required with user');
            }
        }
    }
});

// Global instance automatically gets the extended types
import { setState, getState, get, put, post, patch, del, options } from '@logosdx/fetch';
setState('authToken', 'token123'); // ✅ Typed

// Response is properly typed with FetchResponse including typed config
const response = await get<User>('/api/user');
response.data; // ✅ Typed as User
response.status; // ✅ Typed as number
response.headers; // ✅ Typed as Partial<InstanceResponseHeaders>
response.headers['x-rate-limit-remaining']; // ✅ Typed access to response headers
response.request; // ✅ Typed as Request
response.config.headers; // ✅ Typed as InstanceHeaders
response.config.params; // ✅ Typed as InstanceParams

// Per-request response header typing
interface CustomHeaders {
    'x-custom-header': string;
}

const customResponse = await get<User, CustomHeaders>('/api/user');
customResponse.headers['x-custom-header']; // ✅ Typed
```

## Lifecycle Management

```typescript
// Memory leak prevention - destroy instances when done
const api = new FetchEngine({ baseUrl: 'https://api.example.com' });

// Use the instance...
await api.get('/users');

// Clean up when no longer needed (component unmount, app teardown)
api.destroy();

// Attempting requests after destroy throws error
api.isDestroyed(); // true
await api.get('/users'); // throws: "Cannot make requests on destroyed FetchEngine instance"

// Listener cleanup - Option 1: Use on() with cleanup function (recommended)
// Listeners added via on() are automatically removed when destroy() is called
const cleanup1 = api.on('fetch-error', (e) => console.error(e));
const cleanup2 = api.on('fetch-response', (e) => console.log(e));

// Manual cleanup (if you stored the cleanup functions)
cleanup1();
cleanup2();

// Or just call destroy() - automatically removes all listeners added via on()
api.destroy();

// Listener cleanup - Option 2: Use off() for manual removal
const errorHandler = (e) => console.error(e);
const responseHandler = (e) => console.log(e);

api.on('fetch-error', errorHandler);
api.on('fetch-response', responseHandler);

// Remove specific listeners manually
api.off('fetch-error', errorHandler);
api.off('fetch-response', responseHandler);
api.destroy();

// Listener cleanup - Option 3: Use addEventListener with your own AbortController
// For advanced use cases where you need fine-grained control
const controller = new AbortController();

api.addEventListener('fetch-error', errorHandler, { signal: controller.signal });
api.addEventListener('fetch-response', responseHandler, { signal: controller.signal });

// Remove all listeners at once
controller.abort();
api.destroy();

// Component lifecycle integration (simplest approach)
class MyComponent {
    constructor() {
        this.api = new FetchEngine({ baseUrl: 'https://api.example.com' });

        // on() returns cleanup function and automatically cleaned on destroy()
        this.cleanups = [
            this.api.on('fetch-error', this.handleError),
            this.api.on('fetch-response', this.handleResponse)
        ];
    }

    async fetchData() {
        if (this.api.isDestroyed()) {
            throw new Error('API instance destroyed');
        }
        return this.api.get('/data');
    }

    destroy() {
        // Option 1: Just destroy - automatically removes listeners added via on()
        this.api.destroy();

        // Option 2: Manually cleanup first (if you stored cleanup functions)
        // this.cleanups.forEach(cleanup => cleanup());
        // this.api.destroy();

        this.api = null;
    }
}
```

## Production Patterns

```typescript
// Resilient API client with monitoring
const api = new FetchEngine({
    baseUrl: process.env.API_BASE_URL,
    defaultType: 'json',
    timeout: 5000,
    retry: {
        maxAttempts: 3,
        baseDelay: 1000,
        useExponentialBackoff: true,
        shouldRetry: (error) => error.status >= 500 && !error.aborted
    },
    validate: {
        headers: (headers) => {
            if (!headers.Authorization && process.env.NODE_ENV === 'production') {
                throw new Error('Auth required in production');
            }
        }
    }
});

// Global error handling
api.on('fetch-error', (event) => {
    // Log to monitoring service
    console.error('API Error:', {
        url: event.url,
        status: event.error?.status,
        attempt: event.attempt,
        method: event.method
    });
});

api.on('fetch-retry', (event) => {
    console.log(`Retry ${event.nextAttempt}/${api.retry.maxAttempts} after ${event.delay}ms`);
});

// Dynamic state management
api.setState('authToken', await getAuthToken());

// Use changeModifyOptions for dynamic auth token injection
api.changeModifyOptions((opts, state) => {
    if (state.authToken) {
        opts.headers.Authorization = `Bearer ${state.authToken}`;
    }
    return opts;
});

// Environment switching
if (process.env.NODE_ENV === 'development') {
    api.changeBaseUrl('https://api.dev.com');
}

// AbortablePromise with timeout
const request = api.get('/long-running-task');
const timeoutId = setTimeout(() => {
    if (!request.isFinished) request.abort('Timeout');
}, 30000);

const [response, err] = await attempt(() => request);
clearTimeout(timeoutId);
```