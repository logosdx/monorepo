---
description: Usage patterns for the @logosdx/fetch package.
globs: *.ts
---

# @logosdx/fetch

HTTP client with retry logic, request/response interception, and comprehensive error handling for production applications.

## Core API

```typescript
import { FetchEngine, FetchError, FetchEvent, FetchEventNames, isFetchError } from '@logosdx/fetch';
import { attempt } from '@logosdx/utils';

// Basic setup
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    defaultType: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData',
    headers: { Authorization: 'Bearer token' },
    timeout: 5000
});

// Error handling pattern
const [user, err] = await attempt(() => api.get('/users/123'));
if (err) {
    console.error('Request failed:', err.status, err.message);
    return;
}

// Global instance (simplified usage)
import fetch, { get, post, setState, addHeader } from '@logosdx/fetch';

// Global instance auto-uses current domain as base URL
const [users, err] = await attempt(() => fetch.get('/api/users'));

// Or use destructured methods
addHeader('Authorization', 'Bearer token');
setState('userId', '123');
const [user, err] = await attempt(() => get('/api/users/123'));

// Smart URL handling - absolute URLs bypass base URL
const [external, err] = await attempt(() => get('https://api.external.com/data'));
```

## HTTP Methods

```typescript
// All methods return AbortablePromise<T>
interface AbortablePromise<T> extends Promise<T> {
    isFinished: boolean;
    isAborted: boolean;
    abort(reason?: string): void;
}

// HTTP convenience methods
api.get<User>(path, options?)
api.post<User, CreateUserData>(path, payload?, options?)
api.put<User, UpdateUserData>(path, payload?, options?)
api.patch<User, Partial<User>>(path, payload?, options?)
api.delete<void>(path, payload?, options?)
api.options<any>(path, options?)

// Generic request method
api.request<Response, RequestData>(method, path, options & { payload?: RequestData })

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

    // Retry configuration
    retryConfig?: {
        maxAttempts?: number; // default: 3
        baseDelay?: number | ((error: FetchError, attempt: number) => number); // default: 1000
        maxDelay?: number; // default: 10000
        useExponentialBackoff?: boolean; // default: true
        retryableStatusCodes?: number[]; // default: [408, 429, 500, 502, 503, 504]
        shouldRetry?: (error: FetchError, attempt: number) => boolean | number;
    };

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

    // Header formatting
    formatHeaders?: boolean | 'lowercase' | 'uppercase' | ((headers: Headers) => Headers);
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

// Error checking
if (isFetchError(error)) {
    console.log('Fetch error:', error.status, error.step);
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
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    modifyOptions: (opts, state) => {
        if (state.authToken) {
            opts.headers.Authorization = `Bearer ${state.authToken}`;
        }
        return opts;
    }
});
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
const [data, err] = await attempt(() =>
    api.get('/users', {
        timeout: 10000,
        headers: { 'X-Request-ID': '123' },
        params: { include: 'profile' },
        onBeforeReq: (opts) => console.log('Making request:', opts),
        onAfterReq: (response) => console.log('Response:', response.status),
        onError: (error) => console.error('Error:', error),
        retryConfig: { maxAttempts: 5 }
    })
);
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
    FetchEngine.InstanceState
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
import { setState, getState } from '@logosdx/fetch';
setState('authToken', 'token123'); // ✅ Typed
```

## Production Patterns

```typescript
// Resilient API client with monitoring
const api = new FetchEngine({
    baseUrl: process.env.API_BASE_URL,
    defaultType: 'json',
    timeout: 5000,
    retryConfig: {
        maxAttempts: 3,
        baseDelay: 1000,
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
    console.log(`Retry ${event.nextAttempt}/${api.retryConfig.maxAttempts} after ${event.delay}ms`);
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

const [result, err] = await attempt(() => request);
clearTimeout(timeoutId);
```