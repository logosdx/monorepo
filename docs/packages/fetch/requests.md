---
title: Making Requests
description: HTTP methods, request options, and FetchPromise in FetchEngine.
---

# Making Requests


FetchEngine provides type-safe HTTP methods that return rich response objects with full request context.

[[toc]]


## HTTP Methods


All request methods return a `FetchPromise<T>` that resolves to `FetchResponse<T>`.


### GET


```typescript
api.get<Res, ResHdr>(path: string, options?: CallConfig): FetchPromise<Res>
```

Retrieve data from the server.

```typescript
const users = await api.get<User[]>('/users');
if (users.ok) console.log(users.data); // User[]

const user = await api.get<User>('/users/123', {
    params: { include: 'profile' }
});
if (user.ok) console.log(user.data); // User
```


### POST


```typescript
api.post<Res, Data, ResHdr>(path: string, payload?: Data, options?: CallConfig): FetchPromise<Res>
```

Create a new resource.

```typescript
const created = await api.post<User, CreateUserData>('/users', {
    name: 'John Doe',
    email: 'john@example.com'
});
if (created.ok) console.log(created.data); // User
```


### PUT


```typescript
api.put<Res, Data, ResHdr>(path: string, payload?: Data, options?: CallConfig): FetchPromise<Res>
```

Replace a resource.

```typescript
const replaced = await api.put<User, UpdateUserData>('/users/123', {
    name: 'Jane Doe',
    email: 'jane@example.com'
});
if (replaced.ok) console.log(replaced.data); // User
```


### PATCH


```typescript
api.patch<Res, Data, ResHdr>(path: string, payload?: Data, options?: CallConfig): FetchPromise<Res>
```

Partially update a resource.

```typescript
const updated = await api.patch<User, Partial<User>>('/users/123', {
    email: 'new@example.com'
});
if (updated.ok) console.log(updated.data); // User
```


### DELETE


```typescript
api.delete<Res, Data, ResHdr>(path: string, payload?: Data, options?: CallConfig): FetchPromise<Res>
```

Remove a resource.

```typescript
await api.delete('/users/123');

// With request body
await api.delete('/users/batch', { ids: ['1', '2', '3'] });
```


### OPTIONS


```typescript
api.options<Res, ResHdr>(path: string, options?: CallConfig): FetchPromise<Res>
```

Check server capabilities.

```typescript
const { headers } = await api.options('/users');
```


### HEAD


```typescript
api.head<ResHdr>(path: string, options?: CallConfig): FetchPromise<null>
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
): FetchPromise<Res>
```

Make a request with any HTTP method.

```typescript
const res = await api.request<User>('PATCH', '/users/123', {
    payload: { name: 'Updated' },
    headers: { 'X-Custom': 'value' }
});
if (res.ok) console.log(res.data); // User
```


## FetchResponse


Every HTTP method returns a `FetchResponse` — a discriminated union on `ok`. Every completed exchange resolves this way, including non-2xx status; only a transport failure (abort, timeout, connection lost, parse failure on an `ok: true` body) rejects instead as a `FetchError`.

```typescript
type FetchResponse<T, H, P, RH> =
    | { ok: true; data: T; headers: Partial<RH>; status: number; request: Request; config: FetchConfig<H, P> }
    | { ok: false; data: unknown; headers: Partial<RH>; status: number; request: Request; config: FetchConfig<H, P> };
```

**Example:**

```typescript
const response = await api.get<User[]>('/users');

if (!response.ok) {
    console.error('Request failed:', response.status, response.data);
}
else {
    console.log(response.data);      // User[] — narrowed by the ok check
    console.log(response.status);    // 200
    console.log(response.headers);   // { 'content-type': 'application/json', ... }
    console.log(response.config);    // { baseUrl: '...', headers: {...}, ... }
}
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
const res = await api.get<User>('/users/123', {
    headers: { 'X-Include': 'profile' },
    params: { version: 'v2' },
    totalTimeout: 60000,
    retry: { maxAttempts: 5 }
});
if (res.ok) console.log(res.data); // User
```


## Response Chaining


Declare how the response body should be parsed by chaining a directive method before awaiting. Without a directive, the response is auto-parsed based on content-type (backwards compatible).

```typescript
// Explicit response type via chaining
const user = await api.get<User>('/users/123').json();   // FetchResponse<User>
const html = await api.get('/page').text();              // FetchResponse<string>
const file = await api.get('/file').blob();              // FetchResponse<Blob>
const buf  = await api.get('/binary').arrayBuffer();     // FetchResponse<ArrayBuffer>
const form = await api.get('/form').formData();          // FetchResponse<FormData>
const raw  = await api.get('/endpoint').raw();           // FetchResponse<Response>

// The directive declares the parse type; `data` still narrows on `ok`
if (user.ok) render(user.data); // User

// No directive — auto-parse based on content-type
const auto = await api.get<User>('/users/123');
```

**Available directives:**

| Method | Returns | Description |
|--------|---------|-------------|
| `.json()` | `FetchPromise<T>` | Parse as JSON (preserves generic type) |
| `.text()` | `FetchPromise<string>` | Parse as plain text |
| `.blob()` | `FetchPromise<Blob>` | Parse as Blob |
| `.arrayBuffer()` | `FetchPromise<ArrayBuffer>` | Parse as ArrayBuffer |
| `.formData()` | `FetchPromise<FormData>` | Parse as FormData |
| `.raw()` | `FetchPromise<Response>` | Return raw Response without parsing |
| `.stream()` | `FetchStreamPromise` | Stream mode with async iteration |


### Override Guard


Setting a directive more than once throws an error. This prevents accidental double-calls that would silently discard the first directive:

```typescript
// Throws: 'Response type already set'
api.get('/users').json().text();
```


## Stream Mode


Use `.stream()` to get raw `Response` objects with unconsumed body streams. Cache and deduplication are skipped (each caller needs its own readable stream). Rate limiting and lifecycle events still fire normally.

`.stream()` returns a `FetchStreamPromise` which supports `for await` iteration over `Uint8Array` chunks:

```typescript
// Async iteration over response body chunks
for await (const chunk of api.get('/events').stream()) {
    console.log(new TextDecoder().decode(chunk));
}

// With error handling
const stream = api.get('/events').stream();
const [, err] = await attempt(async () => {
    for await (const chunk of stream) {
        console.log(new TextDecoder().decode(chunk));
    }
});
if (err) console.error('Stream failed:', err.message);

// Works with all HTTP methods
for await (const chunk of api.post('/upload-stream', largePayload).stream()) {
    process(chunk);
}
```


## FetchPromise


All HTTP methods return a `FetchPromise` — an extended `Promise` that supports abort, response chaining, and streaming:

```typescript
interface FetchPromise<T, H, P, RH> extends Promise<FetchResponse<T, H, P, RH>> {

    isFinished: boolean;  // Whether request completed
    isAborted: boolean;   // Whether request was aborted
    abort(reason?: string): void;  // Cancel the request

    // Response chaining directives
    json(): FetchPromise<T, H, P, RH>;
    text(): FetchPromise<string, H, P, RH>;
    blob(): FetchPromise<Blob, H, P, RH>;
    arrayBuffer(): FetchPromise<ArrayBuffer, H, P, RH>;
    formData(): FetchPromise<FormData, H, P, RH>;
    raw(): FetchPromise<Response, H, P, RH>;
    stream(): FetchStreamPromise<H, P, RH>;
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
const res = await api.get('https://other-api.com/data');
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
const res = await api.post('/users', userData, {
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

// Response type flows through the union — narrow on `ok` to read it
const res = await api.get<User>('/users/123');
if (res.ok) {
    res.data; // User
}

// Payload type is validated
const newUser = await api.post<User, CreateUserData>('/users', {
    name: 'John',
    email: 'john@example.com'
    // TypeScript error if payload doesn't match CreateUserData
});
if (newUser.ok) {
    newUser.data; // User
}
```
