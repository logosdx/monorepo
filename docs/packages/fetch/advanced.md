---
title: Advanced
description: Type definitions, TypeScript patterns, and production examples for FetchEngine.
---

# Advanced


Advanced TypeScript patterns, complete type definitions, and production configuration examples for FetchEngine.

[[toc]]


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
    url: URL;
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


## TypeScript Customization


FetchEngine supports two approaches for custom types:

1. **Module Augmentation** - Define types once, apply globally to all instances
2. **Generic Parameters** - Pass types explicitly per instance

### Module Augmentation (Recommended)

Augment the `FetchEngine` namespace to define types once for your entire application. All FetchEngine instances and the global API will use your custom types:

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

// Now ALL FetchEngine instances use your custom types automatically
import { FetchEngine } from '@logosdx/fetch';
import { attempt } from '@logosdx/utils';

const api = new FetchEngine({ baseUrl: 'https://api.example.com' });

// All methods are properly typed with your augmented interfaces
api.headers.set('X-API-Key', 'key123'); // Typed - knows X-API-Key exists
api.state.set('authToken', 'token');     // Typed - knows authToken exists

// Response includes your typed headers
const [response] = await attempt(() => api.get<User>('/api/data'));
if (response) {
    response.data;    // User
    response.status;  // number
    response.headers; // Partial<InstanceResponseHeaders>
    response.headers['x-rate-limit-remaining']; // string | undefined
    response.config.headers; // InstanceHeaders
    response.config.params;  // InstanceParams
}
```


### Generic Parameters (Per-Instance)

For cases where different instances need different types, pass generics directly:

```typescript
interface ServiceHeaders {
    'X-Service-Key': string;
    'X-Trace-ID'?: string;
}

interface ServiceState {
    serviceToken: string;
}

// Types apply only to this instance
const serviceApi = new FetchEngine<ServiceHeaders, {}, ServiceState>({
    baseUrl: 'https://internal-service.example.com'
});

serviceApi.headers.set('X-Service-Key', 'key'); // Typed
serviceApi.state.set('serviceToken', 'token');   // Typed
```

**When to use each approach:**

| Approach | Use Case |
|----------|----------|
| Module Augmentation | Single API, consistent types across app |
| Generic Parameters | Multiple APIs with different type requirements |
```


## Production Setup


```typescript
const api = new FetchEngine({
    baseUrl: process.env.API_BASE_URL!,
    defaultType: 'json',
    totalTimeout: 30000,      // 30s max for entire operation
    attemptTimeout: 10000,    // 10s per attempt

    // Distributed tracing - sends requestId as header to server
    requestIdHeader: 'X-Request-Id',

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
api.on('error', (event) => {
    errorReporting.captureException(event.error, {
        tags: {
            endpoint: event.path,
            method: event.method,
            status: event.error?.status
        },
        extra: {
            attempt: event.attempt,
            userId: api.state.get().userId
        }
    });
});

api.on('after-request', (event) => {
    metrics.timing('api.request', event.duration, {
        endpoint: event.path,
        method: event.method,
        status: event.response?.status
    });
});

// Cache monitoring
api.on('cache-hit', (event) => {
    metrics.increment('api.cache.hit', { path: event.path });
});

api.on('cache-miss', (event) => {
    metrics.increment('api.cache.miss', { path: event.path });
});

api.on('cache-stale', (event) => {
    metrics.increment('api.cache.stale', { path: event.path });
});

// Deduplication monitoring
api.on('dedupe-join', (event) => {
    metrics.increment('api.dedupe.saved', { path: event.path });
    logger.debug(`Request deduplicated: ${event.key}, waiters: ${event.waitingCount}`);
});
```


## Development Setup


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
    api.on(/./, ({ event, data }) => {
        console.group(`API ${event}`);
        console.log('Data:', data);
        console.groupEnd();
    });
}
```


## Multi-Environment Configuration


```typescript
interface EnvironmentConfig {

    baseUrl: string;
    timeout: number;
    retryEnabled: boolean;
}

const environments: Record<string, EnvironmentConfig> = {
    development: {
        baseUrl: 'http://localhost:3001/api',
        timeout: 60000,
        retryEnabled: false
    },
    staging: {
        baseUrl: 'https://staging-api.example.com',
        timeout: 30000,
        retryEnabled: true
    },
    production: {
        baseUrl: 'https://api.example.com',
        timeout: 15000,
        retryEnabled: true
    }
};

const env = environments[process.env.NODE_ENV || 'development'];

const api = new FetchEngine({
    baseUrl: env.baseUrl,
    totalTimeout: env.timeout,
    retry: env.retryEnabled ? {
        maxAttempts: 3,
        baseDelay: 1000
    } : false
});
```


## React Integration


```typescript
import { useEffect, useRef } from 'react';
import { FetchEngine } from '@logosdx/fetch';

function useApi() {

    const apiRef = useRef<FetchEngine | null>(null);

    useEffect(() => {
        apiRef.current = new FetchEngine({
            baseUrl: 'https://api.example.com',
            totalTimeout: 10000
        });

        return () => {
            apiRef.current?.destroy();
            apiRef.current = null;
        };
    }, []);

    return apiRef.current;
}

function UserProfile({ userId }: { userId: string }) {

    const api = useApi();
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        if (!api) return;

        const fetchUser = async () => {
            const [response, err] = await attempt(() =>
                api.get<User>(`/users/${userId}`)
            );
            if (!err) setUser(response.data);
        };

        fetchUser();
    }, [api, userId]);

    return user ? <div>{user.name}</div> : <div>Loading...</div>;
}
```


## Service Layer Pattern


```typescript
import { FetchEngine, FetchResponse } from '@logosdx/fetch';
import { attempt } from '@logosdx/utils';

class ApiService {

    #api: FetchEngine;

    constructor(baseUrl: string) {
        this.#api = new FetchEngine({
            baseUrl,
            defaultType: 'json',
            totalTimeout: 15000,
            cachePolicy: true,
            dedupePolicy: true
        });
    }

    async getUser(id: string): Promise<User | null> {
        const [response, err] = await attempt(() =>
            this.#api.get<User>(`/users/${id}`)
        );
        return err ? null : response.data;
    }

    async createUser(data: CreateUserData): Promise<User | null> {
        const [response, err] = await attempt(() =>
            this.#api.post<User, CreateUserData>('/users', data)
        );
        return err ? null : response.data;
    }

    async updateUser(id: string, data: UpdateUserData): Promise<User | null> {
        const [response, err] = await attempt(() =>
            this.#api.patch<User, UpdateUserData>(`/users/${id}`, data)
        );

        // Invalidate cache on successful update
        if (!err) {
            await this.#api.invalidatePath(`/users/${id}`);
        }

        return err ? null : response.data;
    }

    setAuthToken(token: string) {
        this.#api.headers.set('Authorization', `Bearer ${token}`);
    }

    destroy() {
        this.#api.destroy();
    }
}

// Usage
const api = new ApiService('https://api.example.com');
api.setAuthToken('user-token');

const user = await api.getUser('123');
```


## GraphQL Integration


```typescript
const graphqlApi = new FetchEngine({
    baseUrl: 'https://api.example.com',
    defaultType: 'json',

    // Dedupe GraphQL queries by operation name
    dedupePolicy: {
        methods: ['POST'],
        rules: [{
            is: '/graphql',
            serializer: (ctx) =>
                `graphql:${ctx.payload?.operationName}:${JSON.stringify(ctx.payload?.variables)}`
        }]
    },

    // Cache queries but not mutations
    cachePolicy: {
        methods: ['POST'],
        rules: [{
            is: '/graphql',
            skip: (ctx) => {
                const query = ctx.payload?.query || '';
                return query.trimStart().startsWith('mutation');
            },
            serializer: (ctx) =>
                `graphql:${ctx.payload?.operationName}:${JSON.stringify(ctx.payload?.variables)}`
        }]
    }
});

// GraphQL query helper
async function query<T>(
    operationName: string,
    query: string,
    variables?: Record<string, unknown>
): Promise<T | null> {

    const [response, err] = await attempt(() =>
        graphqlApi.post<{ data: T }>('/graphql', {
            operationName,
            query,
            variables
        })
    );

    return err ? null : response.data.data;
}

// Usage
const user = await query<User>('GetUser', `
    query GetUser($id: ID!) {
        user(id: $id) {
            id
            name
            email
        }
    }
`, { id: '123' });
```


## File Upload with Progress


```typescript
async function uploadFile(file: File, onProgress?: (percent: number) => void) {

    const formData = new FormData();
    formData.append('file', file);

    // For progress tracking, use XMLHttpRequest or fetch with ReadableStream
    // FetchEngine works with FormData natively
    const [response, err] = await attempt(() =>
        api.post<{ url: string }>('/upload', formData, {
            headers: {
                // Don't set Content-Type - browser will set multipart/form-data with boundary
            },
            totalTimeout: 300000 // 5 minutes for large files
        })
    );

    return err ? null : response.data.url;
}
```


## Batch Requests


```typescript
async function batchFetch<T>(
    paths: string[],
    options?: { concurrency?: number }
): Promise<Map<string, T | null>> {

    const results = new Map<string, T | null>();
    const concurrency = options?.concurrency ?? 5;

    // Process in batches
    for (let i = 0; i < paths.length; i += concurrency) {
        const batch = paths.slice(i, i + concurrency);
        const promises = batch.map(async (path) => {
            const [response, err] = await attempt(() => api.get<T>(path));
            results.set(path, err ? null : response.data);
        });
        await Promise.all(promises);
    }

    return results;
}

// Usage
const userData = await batchFetch<User>([
    '/users/1',
    '/users/2',
    '/users/3'
]);
```
