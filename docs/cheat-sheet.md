# Cheat Sheets

Get started faster with these cheat sheets. Feed them to your AI when asking questions.

[[toc]]

## Fetch

### Basic Setup

```typescript
import { FetchEngine } from '@logosdx/fetch';

// Basic setup
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    defaultType: 'json',
    timeout: 5000
});

// With typed headers, params, and state
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
    baseUrl: 'https://api.example.com'
});
```


### HTTP Methods

```typescript
// GET
const [users, err] = await attempt(() => api.get<User[]>('/users'));

// POST
const [user, err] = await attempt(() =>
    api.post<User, CreateUserData>('/users', {
        name: 'John Doe',
        email: 'john@example.com'
    })
);

// PUT
const [updated, err] = await attempt(() =>
    api.put<User>('/users/123', userData)
);

// PATCH
const [patched, err] = await attempt(() =>
    api.patch<User>('/users/123', { name: 'Jane' })
);

// DELETE
const [deleted, err] = await attempt(() =>
    api.delete<User>('/users/123')
);

// Generic request
const [result, err] = await attempt(() =>
    api.request<Response>('PATCH', '/settings', {
        payload: { theme: 'dark' }
    })
);
```


### Request Options

```typescript
// With options
const [data, err] = await attempt(() =>
    api.get<User>('/users/123', {
        headers: { 'X-Include': 'profile' },
        params: { include: 'permissions' },
        timeout: 10000,
        abortController: new AbortController()
    })
);
```


### AbortablePromise

```typescript
const request = api.get('/slow-endpoint');

// Check status
if (!request.isFinished) {
    request.abort('User cancelled');
}

// Handle aborted requests
const [data, err] = await attempt(() => request);
if (err && request.isAborted) {
    console.log('Request was cancelled');
}
```


### State Management

```typescript
// Set entire state
api.setState({
    userId: '123',
    sessionId: 'abc'
});

// Set individual property
api.setState('userId', '456');

// Get state (returns deep clone)
const state = api.getState();

// Reset state
api.resetState();
```


### Headers Management

```typescript
// Add global header
api.addHeader('Authorization', 'Bearer token123');

// Add multiple headers
api.addHeader({
    'X-API-Version': 'v2',
    'X-Client': 'web-app'
});

// Add method-specific header
api.addHeader('X-CSRF-Token', 'csrf123', 'POST');

// Remove headers
api.rmHeader('Authorization');
api.rmHeader(['X-API-Version', 'X-Client']);

// Check header existence
if (api.hasHeader('Authorization')) {
    // Header exists
}
```


### Parameters Management

```typescript
// Add global parameter
api.addParam('version', 'v1');

// Add multiple parameters
api.addParam({
    format: 'json',
    locale: 'en-US'
});

// Add method-specific parameter
api.addParam('include_deleted', true, 'GET');

// Remove parameters
api.rmParam('version');
api.rmParam(['format', 'locale']);

// Check parameter existence
if (api.hasParam('version')) {
    // Parameter exists
}
```


### URL Management

```typescript
// Change base URL
api.changeBaseUrl('https://staging.example.com');
```


### Retry Configuration

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retry: {
        baseDelay: 1000,
        maxAttempts: 3,
        maxDelay: 10000,
        useExponentialBackoff: true,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        shouldRetry: (error, attempt) => {
            // Custom retry logic
            if (error.status === 429) {
                const retryAfter = error.headers?.['retry-after'];
                return retryAfter ? parseInt(retryAfter) * 1000 : 5000;
            }
            if (error.status >= 400 && error.status < 500) {
                return false; // Don't retry client errors
            }
            return true;
        }
    }
});
```


### Event System

```typescript
// Listen to events
const cleanup = api.on('fetch-error', (event) => {
    console.error('Request failed:', event.error?.message);
});

// Listen once
api.once('fetch-response', (event) => {
    console.log('First response:', event.response);
});

// Listen to all events
api.on('*', (event) => {
    console.log(`Event: ${event.type}`);
});

// Remove listener
cleanup();
// or
api.off('fetch-error', callback);

// Emit custom event
api.emit('custom-event', { data: 'value' });
```

#### Available Events

- `fetch-before` - Before request
- `fetch-after` - After request
- `fetch-abort` - Request aborted
- `fetch-error` - Request error
- `fetch-response` - Response received
- `fetch-retry` - Retry attempt
- `fetch-header-add` - Header added
- `fetch-header-remove` - Header removed
- `fetch-param-add` - Parameter added
- `fetch-param-remove` - Parameter removed
- `fetch-state-set` - State updated
- `fetch-state-reset` - State reset
- `fetch-url-change` - Base URL changed


### Error Handling

```typescript
import { isFetchError } from '@logosdx/fetch';

const [data, err] = await attempt(() => api.get('/users'));

if (err) {
    if (isFetchError(err)) {
        console.log('HTTP Error:', err.status, err.message);
        console.log('Failed at step:', err.step);
        console.log('Response data:', err.data);
        console.log('Was aborted:', err.aborted);
    } else {
        console.log('Network error:', err.message);
    }
}
```

#### Error Status Codes

- `499` - Request aborted by server
- `999` - Error during response parsing


### Advanced Configuration

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',

    // Method-specific headers
    methodHeaders: {
        POST: { 'X-CSRF-Token': 'token' },
        PUT: { 'X-Method': 'PUT' }
    },

    // Method-specific params
    methodParams: {
        GET: { include: 'all' },
        DELETE: { soft: true }
    },

    // Modify options before request
    modifyOptions: (opts, state) => {
        if (state.authToken) {
            opts.headers.Authorization = `Bearer ${state.authToken}`;
        }
        return opts;
    },

    // Method-specific option modification
    modifyMethodOptions: {
        POST: (opts, state) => {
            opts.headers['X-User-ID'] = state.userId;
            return opts;
        }
    },

    // Validation
    validate: {
        headers: (headers, method) => {
            if (method === 'POST' && !headers['X-CSRF-Token']) {
                throw new Error('CSRF token required');
            }
        },
        state: (state) => {
            if (!state.authToken) {
                throw new Error('Authentication required');
            }
        },
        perRequest: {
            headers: true,
            params: true
        }
    },

    // Custom response type detection
    determineType: (response) => {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/pdf')) {
            return 'blob';
        }
        return FetchEngine.useDefault;
    },

    // Format headers
    formatHeaders: 'lowercase' // or 'uppercase' or custom function
});
```


### TypeScript Module Declaration

```typescript
// Extend for global type safety
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
        }
    }
}
```


### Common Patterns

#### Authentication Flow

```typescript
// Login and store token
const [loginResponse, err] = await attempt(() =>
    api.post<{ token: string }>('/auth/login', credentials)
);

if (!err && loginResponse) {
    api.setState('authToken', loginResponse.token);
    api.addHeader('Authorization', `Bearer ${loginResponse.token}`);
}
```

#### File Upload

```typescript
const formData = new FormData();
formData.append('file', file);

const [result, err] = await attempt(() =>
    api.post('/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    })
);
```

#### Paginated Requests

```typescript
async function fetchAllPages<T>() {
    const results: T[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const [data, err] = await attempt(() =>
            api.get<{ items: T[], hasNext: boolean }>('/items', {
                params: { page, limit: 100 }
            })
        );

        if (err) throw err;

        results.push(...data.items);
        hasMore = data.hasNext;
        page++;
    }

    return results;
}
```

#### Environment Switching

```typescript
const urls = {
    production: 'https://api.example.com',
    staging: 'https://staging.example.com',
    development: 'http://localhost:3001'
};

observer.on('environment-changed', ({ env }) => {
    api.changeBaseUrl(urls[env]);
    api.resetState(); // Clear auth on env change
});
```




## Observer

### Basic Setup

```typescript
import { ObserverEngine } from '@logosdx/observer';

// Define event shape
interface AppEvents {
    'user:login': { userId: string; timestamp: Date }
    'user:logout': { userId: string }
    'data:update': { id: string; changes: any }
}

// Create observer
const observer = new ObserverEngine<AppEvents>({
    name: 'app-events',
    spy: (action) => console.log(action.fn, action.event),
    emitValidator: (event, data) => {
        if (!data) throw new Error('Data required')
    }
});
```


### Core Patterns

#### Event Listening

```typescript
// Callback pattern
const cleanup = observer.on('user:login', (data) => {
    console.log('User logged in:', data.userId);
});
cleanup(); // Remove listener

// Async generator pattern
const loginEvents = observer.on('user:login');
for await (const data of loginEvents) {
    console.log('Login:', data.userId);
    if (shouldStop) {
        loginEvents.cleanup();
        break;
    }
}

// Promise pattern (single event)
const loginData = await observer.once('user:login');
console.log('First login:', loginData.userId);

// Regex pattern (matches multiple events)
observer.on(/^user:/, ({ event, data }) => {
    console.log(`User event ${event}:`, data);
});
```


#### Event Emission

```typescript
// Type-safe emission
observer.emit('user:login', { userId: '123', timestamp: new Date() });

// Emit to regex listeners
observer.emit(/^user:/, { type: 'broadcast' });
```


### Advanced Features

#### Event Queue Processing

```typescript
// Create processing queue with rate limiting
const queue = observer.queue('data:update', async (data) => {
    await processData(data.id, data.changes);
}, {
    name: 'data-processor',
    concurrency: 5,                  // 5 parallel workers
    rateLimitCapacity: 100,          // 100 operations
    rateLimitIntervalMs: 1000,       // per second
    taskTimeoutMs: 30000,            // 30s timeout per task
    maxQueueSize: 10000,             // Max queue size
    type: 'fifo',                    // Processing order
    jitterFactor: 0.1                // 10% timing randomization
});

// Monitor queue events
queue.on('error', ({ error, data }) => {
    console.error('Failed:', error.message, data);
});

queue.on('idle', () => {
    console.log('Queue idle');
});

// Queue control
queue.add(urgentData, 10);          // High priority
queue.add(normalData, 1);            // Low priority
await queue.flush(10);               // Process 10 items
queue.pause();                       // Pause processing
queue.resume();                      // Resume
await queue.shutdown();              // Graceful shutdown

// Queue state
console.log(queue.state);           // 'running' | 'paused' | 'stopped' | 'draining'
console.log(queue.pending);          // Number of pending items
console.log(queue.stats);            // Processing statistics
```


#### Component Enhancement

```typescript
// Extend any object with events
const modal = { isOpen: false };
const enhanced = observer.observe(modal);

enhanced.on('open', () => {
    enhanced.isOpen = true;
});

enhanced.emit('open');
enhanced.cleanup(); // Remove component listeners
```


#### Generator Control

```typescript
const generator = observer.on('user:login');

// Manual control
const loginData = await generator.next();
console.log('Next login:', loginData.userId);

// Direct emission to generator
generator.emit({ userId: 'direct' });

// Check state
console.log(generator.done);        // boolean
console.log(generator.lastValue);   // last emitted value

// Cleanup
generator.cleanup();
```


### Utility Methods

```typescript
// Remove listeners
observer.off('user:login', specificCallback);  // Remove specific
observer.off('user:login');                    // Remove all for event
observer.off(/^user:/);                        // Remove regex listeners
observer.clear();                              // Remove ALL listeners

// Check listeners
observer.$has('user:login');                   // boolean
observer.$has(/^user:/);                       // boolean

// Get statistics
const facts = observer.$facts();
console.log(facts.listeners);                  // ['user:login', 'user:logout']
console.log(facts.listenerCounts);            // { 'user:login': 3 }

// Debug mode
observer.debug(true);                          // Enable tracing
```


### Queue Events

#### Processing Events

- `added` - Item added to queue
- `processing` - Item being processed
- `success` - Item processed successfully
- `error` - Item processing failed
- `timeout` - Item processing timed out
- `rejected` - Item rejected (queue full)

#### State Events

- `start/started` - Queue starting/started
- `stopped` - Queue stopped
- `paused` - Queue paused
- `resumed` - Queue resumed
- `empty` - Queue became empty
- `idle` - No pending items
- `rate-limited` - Rate limit hit
- `drain/drained` - Draining queue
- `flush/flushed` - Flushing items
- `purged` - Items purged
- `shutdown` - Queue shutdown


### Examples and Tips

#### Memory Management

```typescript
// Always cleanup generators
const generator = observer.on('event');
try {
    for await (const data of generator) {
        // Process
    }
} finally {
    generator.cleanup();
}

// Cleanup observed components
const enhanced = observer.observe(component);
// Use component...
enhanced.cleanup(); // ⚠️ Removes component listeners only
```

#### Performance Tips

```typescript
// Use regex for multiple related events
observer.on(/^user:/, handler);        // Better than multiple listeners

// Configure queues for your use case
const syncQueue = observer.queue('sync', syncProcessor, {
    concurrency: 1,                    // Synchronous operations
    processIntervalMs: 10              // Avoid tight loops
});

const asyncQueue = observer.queue('async', asyncProcessor, {
    concurrency: 10,                   // Parallel async operations
    rateLimitCapacity: 100,
    rateLimitIntervalMs: 1000
});

// Batch operations when possible
const batch = [];
observer.on('item', (data) => {
    batch.push(data);
    if (batch.length >= 100) {
        processBatch(batch.splice(0));
    }
});
```

### Type Definitions Quick Reference

```typescript
// Event shape
type Events<Shape> = keyof Shape

// Event data extraction
type EventData<S, E> = E extends Events<S> ? S[E] : RgxEmitData<S>

// Regex emit format
type RgxEmitData<Shape> = {
    event: Events<Shape>
    data: Shape[Events<Shape>]
}

// Cleanup function
type Cleanup = () => void

// Event callback
type EventCallback<T> = (data: T, info?: { event: string, listener: Function }) => void

// Queue options
interface QueueOpts {
    name: string
    type?: 'fifo' | 'lifo'
    concurrency?: number
    pollIntervalMs?: number
    processIntervalMs?: number
    taskTimeoutMs?: number
    jitterFactor?: number
    maxQueueSize?: number
    rateLimitCapacity?: number
    rateLimitIntervalMs?: number
    autoStart?: boolean
    debug?: boolean | 'info' | 'verbose'
}
```

## Utils

### Flow Control

#### attempt() - Async error handling

```ts
const [result, err] = await attempt(() => fetch('/api').then(r => r.json()))
if (err) return handleError(err)
// use result safely
```

#### attemptSync() - Sync error handling

```ts
const [data, err] = attemptSync(() => JSON.parse(rawJson))
if (err) return defaultData
```

#### retry() - Retry with backoff

```ts
const resilient = retry(fetchData, {
    retries: 3,
    delay: 1000,
    backoff: 2,        // 1s, 2s, 4s
    jitterFactor: 0.1,
    shouldRetry: (err) => err.message.includes('50')
})
```

#### circuitBreaker() - Prevent cascading failures

```ts
const protected = circuitBreaker(apiCall, {
    maxFailures: 5,
    resetAfter: 30000,
    onOpen: () => console.warn('Circuit opened')
})
```

#### withTimeout() - Add timeout protection

```ts
const timed = withTimeout(slowOperation, {
    timeout: 5000,
    onTimeout: () => console.warn('Timed out')
})
```

#### composeFlow() - Layer multiple protections

```ts
const bulletproof = composeFlow(apiCall, {
    withTimeout: { timeout: 5000 },
    retry: { retries: 3, delay: 1000 },
    circuitBreaker: { maxFailures: 5 },
    rateLimit: { maxCalls: 100, windowMs: 60000 }
})
```

#### rateLimit() - Control call frequency

```ts
const limited = rateLimit(apiCall, {
    maxCalls: 10,
    windowMs: 1000,    // 10/sec
    throws: false      // Queue instead of throw
})
```

#### batch() - Process arrays with concurrency

```ts
const results = await batch(processItem, {
    items: array,
    concurrency: 5,
    failureMode: 'continue',
    onError: (err, item) => console.error(err),
    onStart: (total) => console.log(`Processing ${total} items`),
    onEnd: (results) => console.log(`Processed ${results.length} items`),
    onChunkStart: (params) => console.log(`Processing chunk ${params.index + 1} of ${params.total}`),
    onChunkEnd: (params) => console.log(`Processed chunk ${params.index + 1} of ${params.total}`)
})
```

#### withInflightDedup() - Deduplicate concurrent calls

```ts
// Basic usage - share in-flight promises
const fetchUser = withInflightDedup(async (id: string) => {
    return db.users.findById(id)
})

// Three concurrent calls → one database query
const [u1, u2, u3] = await Promise.all([
    fetchUser("42"),
    fetchUser("42"),
    fetchUser("42")
])

// With observability hooks
const search = withInflightDedup(searchAPI, {
    hooks: {
        onStart: (key) => logger.debug("started", key),
        onJoin: (key) => logger.debug("joined", key),
        onResolve: (key) => logger.debug("completed", key)
    }
})

// Custom key for hot paths
const getProfile = withInflightDedup(fetchProfile, {
    keyFn: (req) => req.userId  // Extract only discriminating field
})
```

### Data Operations

#### clone() - Deep clone with modern types

```ts
const copy = clone(complexObject)  // Maps, Sets, Dates preserved
```

#### equals() - Deep equality check

```ts
if (equals(state1, state2)) {
    // Objects are deeply equal
}
```

#### merge() - Deep merge with options

```ts
const merged = merge(target, source, {
    arrays: 'concat',   // or 'replace'
    maps: 'merge',      // or 'replace'
    sets: 'union'       // or 'replace'
})
```

#### reach() - Type-safe property access

```ts
const value = reach(obj, 'deep.nested.property') ?? defaultValue
```

### Performance

#### memoize() - Cache async results with stale-while-revalidate

```ts
// Basic caching
const cached = memoize(expensiveAsyncFn, {
    ttl: 300000,       // 5 min
    maxSize: 1000,
    generateKey: (args) => args.join(':')
})

// Stale-while-revalidate for instant responses
const fastCached = memoize(expensiveAsyncFn, {
    ttl: 600000,       // Cache 10 min
    staleIn: 120000,   // Stale after 2 min
    staleTimeout: 200, // Max 200ms wait for fresh data
    maxSize: 1000
})

// Cache management
cached.cache.clear()
cached.cache.stats()  // { hits, misses, hitRate }
```

#### memoizeSync() - Cache sync results

```ts
const cached = memoizeSync(expensiveSyncFn, {
    maxSize: 500
})
```

#### debounce() - Delay until calls stop

```ts
const search = debounce(searchAPI, {
    delay: 300,  // Wait 300ms after typing stops
    onDebounce: () => showSpinner()
})
```

#### throttle() - Limit call frequency

```ts
const limited = throttle(handleScroll, {
    delay: 100,       // Max 10/sec
    throws: false
})
```

### Validation

#### assert() - Runtime assertions

```ts
assert(value, 'Value required')
assert(num > 0, 'Must be positive', ValidationError)
```

#### assertObject() - Deep object validation

```ts
assertObject(data, {
    'user.email': (val) => [
        val?.includes('@'),
        'Invalid email'
    ],
    'user.age': (val) => [
        val >= 18,
        'Must be 18+'
    ]
})
```

#### Type Guards

```ts
// Primitives
isFunction(val)
isObject(val)
isPlainObject(val)
isPrimitive(val)
isDefined(val)
isNull(val)
isUndefined(val)

// Collections
allKeysValid(obj, (val, key) => isDefined(val))
allItemsValid(array, (item) => typeof item === 'string')

// Environment
isBrowser()
isNode()
isReactNative()
```

### Error Types


```ts
// Specific error classes
RetryError
TimeoutError
CircuitBreakerError
RateLimitError
ThrottleError
AssertError

// Type guards for error handling
if (isTimeoutError(err)) { /* handle timeout */ }
if (isRateLimitError(err)) { /* handle rate limit */ }
if (isCircuitBreakerError(err)) { /* handle circuit open */ }
```

### Examples

#### API Call with Full Protection

```ts

const bulletproof = composeFlow(
    fetch,
    {
        withTimeout: { timeout: 5000 },
        retry: { retries: 3, delay: 1000, backoff: 2 },
        circuitBreaker: { maxFailures: 5 }
    }
)

const [data, err] = await attempt(
    () => bulletproof('/api/data').then(r => r.json())
);

if (err) {
    if (isTimeoutError(err)) return 'Request timed out'
    if (isRetryError(err)) return 'Multiple failures'
    return 'Unknown error'
}
```

#### Safe State Updates

```ts
const updateState = (state, updates) => {

    const newState = clone(state);

    merge(newState, updates, {
        mergeArrays: true,
        mergeSets: true,
    });

    return newState
}
```

#### Cached Calculations with Stale-While-Revalidate

```ts
// Instant responses with background refresh
const calculate = memoize(
    async (params) => {
        const [result, err] = await attempt(
            () => expensiveCalculation(params)
        );

        if (err) throw err
        return result
    },
    {
        ttl: 300000,       // Cache 5 min
        staleIn: 60000,    // Stale after 1 min
        staleTimeout: 300, // Wait max 300ms for fresh
        maxSize: 100
    }
)

// Returns cached immediately if fresh data takes > 300ms
// Always updates cache with fresh data in background
```

#### Form Validation

```ts
const validateForm = (data) => {
    assertObject(data, {
        'email': (v) => [v?.includes('@'), 'Invalid email'],
        'age': (v) => [v >= 18, 'Must be 18+'],
        'terms': (v) => [v === true, 'Must accept terms']
    })
    return data
}
```

#### Batch Processing

```ts
const results = await batch(
    async (item) => {
        const [result, err] = await attempt(
            () => processItem(item)
        );

        if (err) throw err;
        return result;
    },
    {
        items: largeArray,
        concurrency: 10,
        failureMode: 'continue',
        onError: (err, item) => console.error(`Failed: ${item.id}`, err)
    }
)
```

## DOM

### Element Selection

```typescript
// Basic selection - always returns arrays
const buttons = $<HTMLButtonElement>('button');           // HTMLButtonElement[]
const form = $('form')[0];                               // Single element
const inputs = $<HTMLInputElement>('input', form);       // Context-aware

// Type-safe selection
const modals = $<HTMLDialogElement>('#modal');           // HTMLDialogElement[]
```


### CSS Module

#### Get Styles

```typescript
// Single element, single property
const color = html.css.get(div, 'color');                // string

// Multiple elements, single property
const colors = html.css.get([div, span], 'color');       // string[]

// Single element, multiple properties
const styles = html.css.get(div, ['color', 'fontSize']); // { color, fontSize }

// Multiple elements, multiple properties
const allStyles = html.css.get([div, span], ['color', 'fontSize']); // [{}...]
```

#### Set/Remove Styles

```typescript
// Set styles
html.css.set(div, { color: 'red', fontSize: '16px' });
html.css.set([div, span], { opacity: '0.5' });

// Remove styles
html.css.remove(div, 'color');
html.css.remove([div, span], ['color', 'fontSize']);
```


### Attributes Module

#### Get/Check Attributes

```typescript
// Get attributes
const method = html.attrs.get(form, 'method');           // string | null
const attrs = html.attrs.get(form, ['method', 'action']); // { method, action }

// Check existence
const hasRequired = html.attrs.has(input, 'required');  // boolean
const hasAttrs = html.attrs.has(input, ['required', 'disabled']); // { required, disabled }
```

#### Set/Remove Attributes

```typescript
// Set attributes
html.attrs.set(input, { name: 'username', required: 'true' });
html.attrs.set([input1, input2], { 'data-validated': 'false' });

// Remove attributes
html.attrs.remove(input, 'disabled');
html.attrs.remove([input1, input2], ['required', 'disabled']);
```


### Events Module

#### Add Event Listeners

```typescript
// Basic events - returns cleanup function
const cleanup = html.events.on(button, 'click', handleClick);

// Multiple targets/events
const cleanup = html.events.on([btn1, btn2], 'click', handleClick);
const cleanup = html.events.on(input, ['focus', 'blur'], handleFocus);
const cleanup = html.events.on([input1, input2], ['focus', 'blur'], handleFocus);

// One-time event
const cleanup = html.events.once(button, 'click', handleClick);

// Always clean up
cleanup();
```

#### Custom Events

```typescript
// Emit custom event
html.events.emit(document.body, 'app:ready');
html.events.emit(modal, 'modal:open', { modalId: 'settings' });

// Listen for custom events
html.events.on(modal, 'modal:open', (e: CustomEvent) => {
    console.log('Modal:', e.detail.modalId);
});
```


### Behaviors Module

#### Basic Binding

```typescript
// Bind behavior to elements
const cleanup = html.behaviors.bind('.accordion', 'Accordion', (el) => {
    const toggle = el.querySelector('.toggle') as HTMLElement;

    return html.events.on(toggle, 'click', () => {
        toggle.classList.toggle('open');
    });
});
```

#### Auto-Discovery with MutationObserver

```typescript
// Watch for new elements
html.behaviors.observe('tooltip', '[data-tooltip]', {
    root: document.getElementById('app'),
    debounceMs: 100
});
```

#### Batch Registration

```typescript
const { cleanup, dispatch } = html.behaviors.create({
    accordion: {
        els: '.accordion',
        handler: (el) => new AccordionController(el),
        shouldObserve: true
    },

    keyboard: () => html.events.on(document, 'keydown', handleShortcuts),

    analytics: {
        els: '[data-track]',
        handler: (el) => new AnalyticsTracker(el),
        debounceMs: 50
    }
}, {
    shouldDispatch: true,
    shouldObserve: true
});

dispatch();  // Initialize all
cleanup();   // Clean up all
```

#### State Management

```typescript
// Check if bound
if (!html.behaviors.isBound(element, 'MyBehavior')) {
    html.behaviors.bind(element, 'MyBehavior', handler);
}

// Get all behaviors
const behaviors = html.behaviors.allBound(element);

// Cleanup
html.behaviors.unbind(element, 'MyBehavior');
html.behaviors.unbindAll(element);
```


### Viewport Utilities

#### Measurements

```typescript
// Document/viewport dimensions
const docHeight = documentHeight();
const viewWidth = viewportWidth();
const scrollbarW = scrollbarWidth();

// Scroll position
const scrollY = scrollTop();
const progress = scrollProgress();        // 0-100%

// Position checks
const atBottom = isAtBottom(100);        // Within 100px threshold
const visible = isPartiallyVisible(element);
```

#### Smooth Scrolling

```typescript
// Scroll to element
scrollToElement(targetElement);
scrollToElement(targetElement, {
    offset: 80,              // Fixed header offset
    behavior: 'smooth'
});

// Scroll to position
scrollToPosition(0, 500, { behavior: 'smooth' });
```


### DOM Utilities

#### Element Creation

```typescript
// Simple
const div = createEl('div');

// Full-featured with cleanup
const form = createElWith('form', {
    attrs: { method: 'post', action: '/submit' },
    class: ['form', 'enhanced'],
    css: { padding: '1rem' },
    domEvents: {
        submit: (e) => e.preventDefault()
    },
    customEvents: {
        validate: (e) => console.log('Valid:', e.detail)
    },
    children: [
        createEl('input'),
        createEl('button')
    ]
});

form.cleanup();  // Remove all listeners
```

#### DOM Manipulation

```typescript
// Add children
appendIn(container, element1, element2);

// Insert relative to target
appendAfter(target, element1, element2);
appendBefore(target, element1, element2);

// Utilities
copyToClipboard('Text to copy');
swapClasses(el, 'active', 'inactive');

// Wait for DOM ready
onceReady(() => {
    initializeApp();
});
```


### Examples and Tips

#### Component Pattern

```typescript
class MyComponent {
    #cleanup: (() => void)[] = [];

    constructor(el: HTMLElement) {
        // Bind events
        this.#cleanup.push(
            html.events.on(el, 'click', this.handleClick)
        );

        // Set initial styles
        html.css.set(el, { opacity: '1' });

        // Add attributes
        html.attrs.set(el, { 'data-initialized': 'true' });
    }

    handleClick = (e: Event) => {
        // Handle click
    }

    destroy() {
        this.#cleanup.forEach(fn => fn());
    }
}

// Register as behavior
html.behaviors.bind('.my-component', 'MyComponent', (el) => {
    const component = new MyComponent(el as HTMLElement);
    return () => component.destroy();
});
```

#### Form Enhancement

```typescript
const forms = $<HTMLFormElement>('form[data-enhance]');

forms.forEach(form => {
    const cleanup = html.events.on(form, 'submit', async (e) => {
        e.preventDefault();

        // Get form data
        const method = html.attrs.get(form, 'method') || 'POST';
        const action = html.attrs.get(form, 'action') || '/';

        // Visual feedback
        html.css.set(form, { opacity: '0.5' });
        html.attrs.set(form, { 'aria-busy': 'true' });

        // Submit
        const response = await fetch(action, {
            method,
            body: new FormData(form)
        });

        // Reset
        html.css.remove(form, 'opacity');
        html.attrs.remove(form, 'aria-busy');
    });
});
```

#### Dynamic Content Loading

```typescript
// Watch for new content
html.behaviors.observe('lazy-load', '[data-lazy]');

// Register handler
html.behaviors.on('lazy-load', () => {
    return html.behaviors.bind('[data-lazy]', 'LazyLoad', (el) => {
        const img = el as HTMLImageElement;

        // Check visibility
        if (isPartiallyVisible(img, 100)) {
            const src = html.attrs.get(img, 'data-src');
            if (src) {
                html.attrs.set(img, { src });
                html.attrs.remove(img, 'data-lazy');
            }
        }
    });
});

// Initialize
html.behaviors.dispatch('lazy-load');
```


### Type-Safe Patterns

#### Custom Event Types

```typescript
interface CustomEvents {
    'modal:open': { modalId: string };
    'modal:close': { reason: string };
}

// Type-safe custom events
const modal = createElWith<CustomEvents>('div', {
    customEvents: {
        'modal:open': (e) => {
            console.log(e.detail.modalId);  // Typed!
        }
    }
});
```

#### Behavior Registry

```typescript
interface BehaviorRegistry {
    tooltip: BehaviorInit;
    modal: BehaviorInit;
    dropdown: BehaviorInit;
}

const behaviors: BehaviorRegistry = {
    tooltip: {
        els: '[data-tooltip]',
        handler: (el) => new Tooltip(el)
    },
    modal: {
        els: '[data-modal]',
        handler: (el) => new Modal(el)
    },
    dropdown: {
        els: '.dropdown',
        handler: (el) => new Dropdown(el)
    }
};

html.behaviors.create(behaviors);
```

## Localize

### Quick Setup

```typescript
import { LocaleManager } from '@logosdx/localize'

// Define translations
const english = {
    welcome: 'Welcome, {name}!',
    nav: {
        home: 'Home',
        about: 'About Us'
    },
    items: '{items.length} items in cart'
}

// Setup types
type LangType = typeof english
type LangCodes = 'en' | 'es'


const spanish: LangType = {
    welcome: '¡Bienvenido, {name}!',
    nav: {
        home: 'Inicio',
        about: 'Acerca de'
    },
    items: '{items.length} artículos en carrito'
}

// Initialize manager
const locale = new LocaleManager<LangType, LangCodes>({
    current: 'en',
    fallback: 'en',
    locales: {
        en: english,
        es: spanish
    }
})
```

### Getting Translations

#### Basic Usage

```typescript
// Simple text
const aboutText = locale.text('nav.about')
// "About Us"

// Shorthand alias
const homeText = locale.t('nav.home')
// "Home"
```

#### With Placeholders

```typescript
// Indexed placeholders {0}, {1}
const msg = locale.t('message', ['Hello', 'World'])
// "Hello world, World!"

// Named placeholders
const welcome = locale.t('welcome', { name: 'Alice' })
// "Welcome, Alice!"

// Nested objects
const text = locale.t('items', { items: [1, 2, 3] })
// "5 items in cart"
```

#### Complex Values

```typescript
// Deep object access in placeholders
const translations = {
    welcome: 'Hello {user.profile.firstName}!'
}

locale.t('welcome', {
    user: {
        profile: {
            firstName: 'John'
        }
    }
})
// "Hello John!"

// Array access
const trans = {
    first: 'First user: {users.0.name}'
}

locale.t('first', {
    users: [
        { name: 'Alice' },
        { name: 'Bob' }
    ]
})
// "First user: Alice"
```


### Language Management

#### Change Language

```typescript
// Switch language
locale.changeTo('es')
locale.changeTo('en')

// Check current
console.log(locale.current)  // 'es'
console.log(locale.fallback) // 'en'
```

#### Update Translations

```typescript
// Dynamically update language pack
const frenchTranslations = await fetch('/api/lang/fr').then(r => r.json())

locale.updateLang('fr', frenchTranslations)
locale.changeTo('fr')
```

#### Available Languages

```typescript
// Get list of configured locales
locale.locales.forEach(lang => {
    console.log(lang.code, lang.text)
})
// 'en', 'English'
// 'es', 'Español'
```


### Events

#### Listen to Changes

```typescript
// Subscribe to language changes
locale.on('locale-change', (event) => {
    console.log('Language changed to:', event.code)
    updateUI()
})

// One-time listener
locale.on('locale-change', handler, true)

// Unsubscribe
locale.off('locale-change', handler)
```


### Common Patterns

#### React Integration

```typescript
function useLocale() {
    const [lang, setLang] = useState(locale.current)

    useEffect(() => {
        const handler = (e) => setLang(e.code)
        locale.on('locale-change', handler)
        return () => locale.off('locale-change', handler)
    }, [])

    return {
        t: locale.t.bind(locale),
        changeLang: locale.changeTo.bind(locale),
        currentLang: lang
    }
}
```

#### Language Selector

```typescript
class LanguageSelector {
    constructor(private locale: LocaleManager) {}

    render() {
        return this.locale.locales.map(lang => ({
            code: lang.code,
            text: lang.text,
            active: lang.code === this.locale.current
        }))
    }

    select(code: string) {
        this.locale.changeTo(code)
    }
}
```

#### Lazy Loading

```typescript
async function loadLanguage(code: string) {
    const cached = localStorage.getItem(`lang:${code}`)

    if (cached) {

        locale.updateLang(code, JSON.parse(cached))
    }
    else {

        const data = await fetch(`/api/lang/${code}`).then(r => r.json())

        localStorage.setItem(`lang:${code}`, JSON.stringify(data))
        locale.updateLang(code, data)
    }

    locale.changeTo(code)
}
```

#### Type-Safe Keys

```typescript
// Use TypeScript path types
type TranslationKeys = PathsToValues<LangType>
// 'welcome' | 'nav.home' | 'nav.about' | 'items'

function translate(key: TranslationKeys): string {
    return locale.t(key)
}
```


### Examples and Tips

#### Non-language usage

```typescript
const baseLabels = {
    nav: {
        home: 'Home',
        about: 'About Us'
    },
    items: '{items.length} items in cart'
}

type LangType = typeof baseLabels

const ncl: LangType = {
    nav: {
        home: 'Base',
        about: 'Discover Us'
    },
    items: '{items.length} things in your basket'
}

const rcc: LangType = {
    nav: {
        home: 'RCC',
        about: 'Learn More'
    },
}

type LangCodes = 'base' | 'ncl' | 'rcc'

const labels = new LocaleManager<LangType, LangCodes>({
    current: 'base',
    fallback: 'base',
    locales: {
        base: baseLabels,
        ncl: ncl,
        rcc: rcc
    }
});
```

#### Multiple Instances

```typescript
// App translations
const appLocale = new LocaleManager({
    current: 'en',
    fallback: 'en',
    locales: { en: appStrings, es: appStringsES }
})

// Date/time formatting
const dateLocale = new LocaleManager({
    current: 'en',
    fallback: 'en',
    locales: { en: dateFormats, es: dateFormatsES }
})
```

#### Regional Variants

```typescript
const locale = new LocaleManager({
    current: 'en-US',
    fallback: 'en',
    locales: {
        'en': britishEnglish,
        'en-US': americanEnglish,
        'en-GB': britishEnglish,
        'es': spainSpanish,
        'es-MX': mexicanSpanish,
        'es-AR': argentinianSpanish
    }
})
```

#### Fallback Chain

```typescript
// If key missing in current, uses fallback
const locale = new LocaleManager({
    current: 'es-MX',
    fallback: 'es',  // Falls back to generic Spanish
    locales: {
        'es': spanishBase,
        'es-MX': mexicanOverrides  // Can be partial
    }
})
```

### Placeholder Formats

```typescript
// Indexed: {0}, {1}, {2}
'{0} bought {1} for ${2}'

// Named: {name}, {price}
'{name} costs ${price}'

// Nested: {user.name}, {order.items.0.name}
'Hello {user.profile.name}, your first item is {order.items.0.name}'
```


## Storage


### Quick Setup

```typescript
import { StorageAdapter } from '@logosdx/storage'

interface AppStorage {
    user: { id: string; name: string; email: string }
    settings: { theme: 'light' | 'dark'; notifications: boolean }
    cart: { id: string; quantity: number }[]
}

const storage = new StorageAdapter<AppStorage>(localStorage, 'myapp')
```


### Core Operations

#### Get Data

```typescript
// Get all
const all = storage.get()

// Get single key
const user = storage.get('user')

// Get multiple keys
const { user, settings } = storage.get(['user', 'settings'])
```

#### Set Data

```typescript
// Set single
storage.set('user', { id: '123', name: 'Alice', email: 'alice@example.com' })

// Set multiple
storage.set({
    user: { id: '123', name: 'Alice', email: 'alice@example.com' },
    settings: { theme: 'dark', notifications: true }
})
```

#### Merge Objects

```typescript
// Shallow merge existing object
storage.assign('user', { email: 'newemail@example.com' })
// Only updates email, keeps id and name
```

#### Remove Data

```typescript
// Remove single
storage.rm('user')

// Remove multiple
storage.rm(['user', 'settings'])

// Clear all (with prefix)
storage.clear()
```


### Events

```typescript
// Listen to changes
storage.on('storage-after-set', (event) => {
    console.log('Updated:', event.key, event.value)
})

// One-time listener
storage.on('storage-after-set', handler, true)

// Remove listener
storage.off('storage-after-set', handler)
```

#### Available Events

- `storage-before-set` - Before write
- `storage-after-set` - After write
- `storage-before-unset` - Before delete
- `storage-after-unset` - After delete
- `storage-reset` - After clear


### Utilities

#### Check Existence

```typescript
const exists = storage.has('user')  // boolean
const [hasUser, hasCart] = storage.has(['user', 'cart'])  // boolean[]
```

#### Wrapped Interface

```typescript
// Create single-key accessor
const userStorage = storage.wrap('user')

userStorage.set({ id: '456', name: 'Bob', email: 'bob@example.com' })
userStorage.assign({ name: 'Robert' })
const user = userStorage.get()
userStorage.remove()
```

#### Inspection

```typescript
storage.keys()     // ['user', 'settings', 'cart']
storage.values()   // [userData, settingsData, cartData]
storage.entries()  // [['user', userData], ['settings', settingsData]]
```


### Best Practices

#### Type Safety

```typescript
// Define strict types
interface AppStorage {
    user: User
    session: { token: string; expires: number }
    preferences: UserPreferences
}

const storage = new StorageAdapter<AppStorage>(localStorage, 'app')
```

#### Prefixing Strategy

```typescript
// Hierarchical prefixes
const userStorage = new StorageAdapter(localStorage, 'myapp:user')
const cacheStorage = new StorageAdapter(localStorage, 'myapp:cache')
const tempStorage = new StorageAdapter(sessionStorage, 'myapp:temp')
```

#### Cross-Tab Sync

```typescript
// Listen to changes from other tabs
window.addEventListener('storage', (event) => {
    if (event.key?.startsWith('myapp:')) {
        // Refresh UI
    }
})
```

#### Domain Wrappers

```typescript
class UserManager {
    private storage = new StorageAdapter<AppStorage>(localStorage, 'app')
    private user = this.storage.wrap('user')

    login(userData: User) {
        this.user.set(userData)
    }

    logout() {
        this.user.remove()
    }

    updateProfile(updates: Partial<User>) {
        this.user.assign(updates)
    }
}
```


### Common Patterns

#### Safe Retrieval

```typescript
const getUser = (): User | null => {
    const user = storage.get('user')
    if (!user || typeof user !== 'object') return null
    return user
}
```

#### Bulk Operations

```typescript
// Save related data together
const saveSession = (session: SessionData) => {
    storage.set({
        token: session.token,
        userId: session.userId,
        expires: session.expires
    })
}
```

#### Date Handling

```typescript
// Dates become strings in JSON
storage.set('lastLogin', new Date().toISOString())
const lastLogin = new Date(storage.get('lastLogin'))
```

### Gotchas

- JSON serialization changes types:
  - `Date` → string
  - `undefined` → `null`
  - Functions not serializable
- Keys are prefixed: `'user'` → `'myapp:user'`
- `clear()` only removes prefixed keys
- `assign()` throws if value isn't object