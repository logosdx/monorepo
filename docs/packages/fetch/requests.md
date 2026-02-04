---
title: Making Requests
description: HTTP methods, request options, and AbortablePromise in FetchEngine.
---

# Making Requests


FetchEngine provides type-safe HTTP methods that return rich response objects with full request context.

[[toc]]


## HTTP Methods


All request methods return an `AbortablePromise<FetchResponse<T>>`.


### GET


```typescript
api.get<Res, ResHdr>(path: string, options?: CallConfig): AbortablePromise<FetchResponse<Res>>
```

Retrieve data from the server.

```typescript
const { data: users } = await api.get<User[]>('/users');

const { data: user } = await api.get<User>('/users/123', {
    params: { include: 'profile' }
});
```


### POST


```typescript
api.post<Res, Data, ResHdr>(path: string, payload?: Data, options?: CallConfig): AbortablePromise<FetchResponse<Res>>
```

Create a new resource.

```typescript
const { data: user } = await api.post<User, CreateUserData>('/users', {
    name: 'John Doe',
    email: 'john@example.com'
});
```


### PUT


```typescript
api.put<Res, Data, ResHdr>(path: string, payload?: Data, options?: CallConfig): AbortablePromise<FetchResponse<Res>>
```

Replace a resource.

```typescript
const { data: user } = await api.put<User, UpdateUserData>('/users/123', {
    name: 'Jane Doe',
    email: 'jane@example.com'
});
```


### PATCH


```typescript
api.patch<Res, Data, ResHdr>(path: string, payload?: Data, options?: CallConfig): AbortablePromise<FetchResponse<Res>>
```

Partially update a resource.

```typescript
const { data: user } = await api.patch<User, Partial<User>>('/users/123', {
    email: 'new@example.com'
});
```


### DELETE


```typescript
api.delete<Res, Data, ResHdr>(path: string, payload?: Data, options?: CallConfig): AbortablePromise<FetchResponse<Res>>
```

Remove a resource.

```typescript
await api.delete('/users/123');

// With request body
await api.delete('/users/batch', { ids: ['1', '2', '3'] });
```


### OPTIONS


```typescript
api.options<Res, ResHdr>(path: string, options?: CallConfig): AbortablePromise<FetchResponse<Res>>
```

Check server capabilities.

```typescript
const { headers } = await api.options('/users');
```


### HEAD


```typescript
api.head<ResHdr>(path: string, options?: CallConfig): AbortablePromise<FetchResponse<null>>
```

Retrieve headers only (no body).

```typescript
const { headers } = await api.head('/users/123');
```


### Generic Request


```typescript
api.request<Res, Data, ResHdr>(
    method: HttpMethods,
    path: string,
    options?: CallConfig & { payload?: Data }
): AbortablePromise<FetchResponse<Res>>
```

Make a request with any HTTP method.

```typescript
const { data } = await api.request<User>('PATCH', '/users/123', {
    payload: { name: 'Updated' },
    headers: { 'X-Custom': 'value' }
});
```


## FetchResponse


Every HTTP method returns a `FetchResponse` object:

```typescript
interface FetchResponse<T, H, P, RH> {

    data: T;                  // Parsed response body
    headers: Partial<RH>;     // Response headers
    status: number;           // HTTP status code
    request: Request;         // Original request object
    config: FetchConfig<H, P>; // Configuration used for request
}
```

**Example:**

```typescript
const response = await api.get<User[]>('/users');

console.log(response.data);      // User[]
console.log(response.status);    // 200
console.log(response.headers);   // { 'content-type': 'application/json', ... }
console.log(response.config);    // { baseUrl: '...', headers: {...}, ... }

// Destructure just the data
const { data: users } = await api.get<User[]>('/users');
```


## Per-Request Options


Override instance configuration for individual requests using `CallConfig`:

| Option | Type | Description |
|--------|------|-------------|
| `headers` | `DictAndT<H>` | Request-specific headers |
| `params` | `DictAndT<P>` | Request-specific URL parameters |
| `totalTimeout` | `number` | Total timeout including retries (ms) |
| `attemptTimeout` | `number` | Per-attempt timeout (ms) |
| `retry` | `RetryConfig \| boolean` | Override retry configuration |
| `abortController` | `AbortController` | Custom abort controller |
| `determineType` | `DetermineTypeFn` | Custom response type detection |
| `onBeforeReq` | `(opts) => void` | Called before request |
| `onAfterReq` | `(response, opts) => void` | Called after response |
| `onError` | `(err) => void` | Called on error |

**Example:**

```typescript
const { data } = await api.get<User>('/users/123', {
    headers: { 'X-Include': 'profile' },
    params: { version: 'v2' },
    totalTimeout: 60000,
    retry: { maxAttempts: 5 }
});
```


## AbortablePromise


All HTTP methods return an `AbortablePromise` that can be cancelled:

```typescript
interface AbortablePromise<T> extends Promise<T> {

    isFinished: boolean;  // Whether request completed
    isAborted: boolean;   // Whether request was aborted
    abort(reason?: string): void;  // Cancel the request
}
```

**Example:**

```typescript
const request = api.get('/slow-endpoint');

// Abort after 5 seconds
setTimeout(() => {
    if (!request.isFinished) {
        request.abort('Timeout');
    }
}, 5000);

const [data, err] = await attempt(() => request);

if (err && request.isAborted) {
    console.log('Request was cancelled');
}
```


## URL Handling


### Relative Paths


Relative paths are joined with the base URL:

```typescript
const api = new FetchEngine({ baseUrl: 'https://api.example.com' });

await api.get('/users');  // → https://api.example.com/users
await api.get('/users/123');  // → https://api.example.com/users/123
```


### Absolute URLs


Absolute URLs bypass the base URL:

```typescript
// Uses external URL directly
const { data } = await api.get('https://other-api.com/data');
```


### URL Parameters


Parameters are appended to the query string:

```typescript
await api.get('/users', {
    params: { page: '1', limit: '10' }
});
// → https://api.example.com/users?page=1&limit=10

// Combined with existing query string
await api.get('/users?active=true', {
    params: { page: '1' }
});
// → https://api.example.com/users?active=true&page=1
```


## Request Lifecycle Hooks


Add per-request callbacks:

```typescript
const { data } = await api.post('/users', userData, {
    onBeforeReq: (opts) => {
        console.log('Starting request:', opts.method, opts.url);
    },

    onAfterReq: (response, opts) => {
        console.log('Completed:', response.status);
    },

    onError: (err) => {
        console.error('Failed:', err.message);
    }
});
```


## Type Safety


FetchEngine supports full TypeScript generics:

```typescript
interface User {
    id: string;
    name: string;
    email: string;
}

interface CreateUserData {
    name: string;
    email: string;
}

// Response type is inferred
const { data } = await api.get<User>('/users/123');
// data: User

// Payload type is validated
const { data: newUser } = await api.post<User, CreateUserData>('/users', {
    name: 'John',
    email: 'john@example.com'
    // TypeScript error if payload doesn't match CreateUserData
});
```
