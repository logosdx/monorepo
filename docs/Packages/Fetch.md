---
permalink: '/packages/fetch'
aliases: ["Fetch", "@logosdx/fetch"]
---

# @logosdx/fetch

**A lightweight, type-safe wrapper for the Fetch API with production-grade resilience.**

Modern applications need HTTP clients that handle real-world network conditions gracefully. `@logosdx/fetch` provides a thin layer over the native Fetch API, adding retry logic, request cancellation, and state management without the overhead of traditional HTTP libraries.

Works everywhere the Fetch API works: browsers, React Native, Cloudflare Workers, Node.js.

> 📚 **Complete API Documentation**: [typedoc.logosdx.dev](https://typedoc.logosdx.dev/modules/_logosdx_fetch.html)

```bash
npm install @logosdx/fetch
```

```bash
pnpm add @logosdx/fetch
```

```bash
yarn add @logosdx/fetch
```

## Quick Start

Get up and running quickly with FetchEngine:

```typescript
import { attempt } from '@logosdx/utils';
import { FetchEngine, isFetchError } from '@logosdx/fetch';

// 1. Create a simple instance
const api = new FetchEngine({
    baseUrl: 'https://api.example.com'
});

// 2. Make requests
const data = await api.get('/users');
await api.post('/users', { name: 'John' });

// 3. Handle errors
const [response, error] = await attempt(() => api.get('/users'));

// Helper type-assert for FetchError
if (isFetchError(error)) {
    console.error(`${error.status}: ${error.message}`);
}

// 4. Add retry capabilities
api.get('/users', {
    retryConfig: {
        maxAttempts: 3,
        retryableStatusCodes: [500, 502, 503]
    }
});

// 5. Cancel requests with `AbortablePromise` returned by request methods
const request = api.get('/users');
request.abort(); // Cancel when needed
```

## The Problem

Building reliable HTTP communication requires handling several challenges:

**Library overhead**: Many HTTP libraries add significant bundle size for features already available in web standards. You need functionality, not bloat. Axios is 18kb gzipped, and has 3rd party dependencies.

**Retry complexity**: Network failures are inevitable. Writing proper retry logic with exponential backoff is error-prone and often skipped until production issues arise.

**State coordination**: Authentication tokens, feature flags, and user context need consistent management across requests. Manual header management leads to inconsistencies.

**Network resilience**: Rate limits, timeouts, and transient failures are normal in distributed systems. Your HTTP client should handle these gracefully by default.

Consider a typical scenario: You're building a SaaS application that authenticates users, handles rate limits, and needs to gracefully recover from network failures. Without proper abstractions, you're implementing the same patterns repeatedly across your codebase.

## How FetchEngine Solves This

### 1. Standards-First Design

FetchEngine builds on the native Fetch API, adding only what's needed for the extra features:

```typescript
// Traditional approach with external libraries
import axios from 'axios'; // 18KB bundle addition, has 3rd party dependencies

const instance = axios.create({
    baseURL: 'https://api.example.com'
});

const response = await instance.get('/users');

// FetchEngine approach - minimal overhead
import { FetchEngine } from '@logosdx/fetch'; // 5.5KB, extends native Fetch, no 3rd party dependencies outside of @logosdx

const api = new FetchEngine({
    // FetchEngine options
    baseUrl: 'https://api.example.com',
    retryConfig: {
        maxAttempts: 3,
        retryableStatusCodes: [500, 502, 503]
    },

    // Rest of the Fetch API options
    cache: 'no-cache',
    credentials: 'include',
    mode: 'cors',
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
    integrity: 'sha256-...'
});

const users = await api.get('/users'); // Built-in retry, type-safe, cancellable, and more
```

By extending rather than replacing web standards, you get familiar APIs with production-grade enhancements.

### 2. Built-In Network Resilience

Production applications face network failures, timeouts, and rate limits. FetchEngine handles these scenarios automatically:

```typescript
// Manual retry implementation (error-prone)
async function fetchUserData(id: string) {
    let attempts = 0;
    while (attempts < 3) {
        try {
            const response = await fetch(`/api/users/${id}`);
            return response.json();
        } catch (error) {
            attempts++;
            if (attempts >= 3) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
    }
}

// FetchEngine approach with proper retry logic
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retryConfig: {
        maxAttempts: 3,
        baseDelay: 1000,
        useExponentialBackoff: true,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        shouldRetry: (error, attempt) => {
            // Skip retrying cancelled requests
            if (error.aborted) return false;

            // Respect rate limit headers
            if (error.status === 429) {
                const retryAfter = error.headers?.['retry-after'];

                const now = Date.now();
                const nextAllowed = parseInt(retryAfter) - now;

                // Return the number of milliseconds to wait before retrying
                // which will override the default exponential backoff
                return nextAllowed;
            }

            // Default retry logic, will retry if the error is not a 429
            return true;
        }
    }
});

// Clean, reliable API calls
const userData = await api.get(`/users/${id}`);
```

### 3. Centralized State Management

Managing authentication, feature flags, and request context becomes simple with FetchEngine's state system:

```typescript
// Scattered header management
const token = getAuthToken();
const response1 = await fetch('/api/data', {
    headers: {
        'Authorization': `Bearer ${token}`,
        'X-User-ID': getCurrentUserId(),
        'X-Feature-Flags': getFeatureFlags().join(',')
    }
});

// Oops - forgot headers on another request
const response2 = await fetch('/api/other-data');

// FetchEngine approach
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    modifyOptions: (opts, state) => {

        // Modify each request based on the state
        // of the fetch engine instance
        if (state.token) {
            opts.headers.authorization = `Bearer ${state.token}`;
            opts.headers['x-user-id'] = state.userId;
            opts.headers['x-feature-flags'] = state.featureFlags.join(',');
        }
        return opts;
    }
});

// Configure once, and all requests will automatically include proper headers
api.setState({
    token: 'abc123',
    userId: 'user-456',
    featureFlags: ['new-ui', 'beta-features']
});

// All requests automatically include proper headers
const data = await api.get('/data');
const otherData = await api.get('/other-data');
```

### 4. Observable Request Lifecycle

Monitor and debug your HTTP layer with comprehensive events:

```typescript
// Track performance
api.on('fetch-before', (event) => {
    console.log(`Starting ${event.method} ${event.url}`);
    performance.mark(`request-start-${event.url}`);
});

api.on('fetch-after', (event) => {
    performance.mark(`request-end-${event.url}`);
    performance.measure(
        `request-duration-${event.url}`,
        `request-start-${event.url}`,
        `request-end-${event.url}`
    );
});

// Handle errors systematically
api.on('fetch-error', (event) => {
    errorReporting.captureException(event.error, {
        tags: {
            url: event.url,
            method: event.method,
            status: event.status,
            attempt: event.attempt
        }
    });
});

// Monitor retry patterns
api.on('fetch-retry', (event) => {
    metrics.increment('api.retry', {
        url: event.url,
        attempt: event.attempt
    });
});
```

### 5. Complete TypeScript Support

Get compile-time safety for your entire HTTP layer:

```typescript
// Define your API contract
type SomeHeaders = {
    'Authorization'?: string,
    'X-API-Key'?: string
}

type SomeParams = {
    'auth_token'?: string,
    'scope'?: string,
    'page'?: string,
    'limit'?: string,
}

type SomeState = {
    'isAuthenticated'?: boolean,
    'authToken'?: string,
    'refreshToken'?: string
}

// Create a type-safe instance
const api = new FetchEngine<SomeHeaders, SomeParams, SomeState>({
    baseUrl: 'https://api.example.com',
    headers: {
        'Authorization': `Bearer ${authToken}`
    }
});

// Type-safe request and response
type AuthResponse = {
    authToken: string,
    refreshToken: string
}

const { authToken, refreshToken } = await api.get<AuthResponse>('/auth/refresh', {
    params: {
        auth_token: '1234567890'
    },
    headers: {
        'Authorization': `Bearer ${authToken}`
    },

    // Request lifecycle hooks that resolve asynchronously
    onBeforeReq: async (opts) => {
        if (someCondition) {

            opts.controller.abort();
        }
    },

    onAfterReq: async (response, opts) => {

        if (response.status === 200) {

            api.setState({ isAuthenticated: true });
        }
    },

    onError: async (error) => {

        if (error.status === 401) {

            api.setState({ isAuthenticated: false });
        }
    },

    // Native Fetch API options
    cache: 'no-cache',
    credentials: 'include',
    mode: 'cors',
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
    integrity: 'sha256-...',
});

// Type-safe POST request
type SearchResponse = {
    users: {
        id: string,
        name: string
    }[]
}

const res = await api.post<SearchResponse>(
    '/users/search',
    {
        // Payload
        filter: {
            name: 'John'
        }
    },
    {
        // ... request options
    }
});
```

## Example

Here's a complete example showing how to configure and use FetchEngine. For detailed API documentation, visit [the typedocs](https://typedoc.logosdx.dev).

```ts

type SomeHeaders = {
	'authorization'?: string,
	'x-api-key'?: string,
	'hmac': string,
	'time': number
}

type SomeParams = {
	auth_token: string,
	scope: string
}

type SomeState = {
	isAuthenticated?: boolean,
	authToken?: string
	refreshToken?: string,
}

const api = new FetchEngine<SomeHeaders, SomeParams, SomeState>({
	// Base configuration
	baseUrl: testUrl,
	defaultType: 'json',
	headers: {
		'content-type': 'application/json',
		'authorization': 'abc123'
	},

	// Method-specific headers
	methodHeaders: {
		POST: {
			'x-some-key': process.env.SOME_KEY
		}
	},

	// Default parameters
	params: {
		auth_token: ''
	},

	// Method-specific parameters
	methodParams: {
		POST: {
			scope: ''
		}
	},

	// Modify options for every request
	modifyOptions(opts, state) {
		if (state.authToken) {
			const time = +new Date();
			opts.headers.authorization = state.authToken;
			opts.headers.hmac = makeHmac(time);
			opts.headers.time = time;
		}
	},

	// Method-specific option modifiers
	modifyMethodOptions: {
		PATCH(opts, state) {

			if (state.permission) {
				opts.headers['special-patch-only-header'] = 'abc123'
			}
		}
	},

	// Validation configuration
	validate: {
		headers(headers) {
			Joi.assert(headersSchema, headers);
		},
		state(state) {
			zodStateSchema.parse(state);
		},
		params(params) {
			jsonschema.validate(params, paramsSchema);
		},

		// Validate per request or only when setting
        // headers or params
		perRequest: {
			headers: true,
			params: true
		}
	},

	// Custom response type determination
	determineType(response) {

		if (/json/.test(response.headers.get('content-type'))) {
			return 'text';
		}

		return 'blob'
	},

	// Header formatting
	formatHeaders: 'lowercase' || 'uppercase' || 'none',

	// Retry configuration
	retryConfig: {
		maxAttempts: 3,
		retryableStatusCodes: [500, 502, 503],
		baseDelay: 1000,
		maxDelay: 10000,
		useExponentialBackoff: true,

        // Resolve asynchronously
		shouldRetry: async (error, attempt) => {
			return !error.status || error.status === 503;
		}
	},

	// Standard RequestInit options
	cache: 'no-cache',
	credentials: 'include',
	mode: 'cors',
});

// Making requests
const userData = await api.get<UserType>('/users/me');
const deleted = await api.delete<DeleteResponse>('/users/123');
const created = await api.post<User>('/users', { name: 'John', email: 'john@example.com' });
const updated = await api.put<User>('/users/123', { name: 'John Doe' });
const patched = await api.patch<User>('/users/123', { email: 'newemail@example.com' });

// Update state based on response
if (userData.authToken) {
	api.setState({ authToken: userData.authToken });
}
```

## How responses are handled

When you configure your `FetchEngine` instance, you might pass the `defaultType` configuration. This only states how FetchEngine should handle your response if it can't resolve it itself. Servers usually respond with the standard-place header `Content-Type` to signify the mime-type that should be used to handle the response. `FetchEngine` extracts those headers and guesses how it should handle that response.

### Reponses are matched and handled in the following order

| Content-Type Matches                           | Handled as            | Data Type                                      | Examples                                                                              |
| ---------------------------------------------- | --------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| text, xml, html, form-urlencoded               | `text`                | `string`                                       | `application/xml`<br>`text/html`<br>`text/css`<br>`application/x-www-form-urlencoded` |
| json                                           | `json`                | Anything serializable by `JSON.stringify(...)` | `application/json`<br>`application/calendar+json`                                     |
| form-data                                      | `formData`            | `FormData`                                     | `multipart/form-data`                                                                 |
| image, audio, video, font, binary, application | `blob`                | Binary                                         | `image/gif`<br>`audio/aac`<br>`font/otf`<br>`application/vnd.openblox.game-binary`    |
| No match                                       | throws `Error`        | -                                              | -                                                                                     |
| No header                                      | `options.defaultType` | user defined                                   | -                                                                                     |

### Handling your own responses

You can override FetchEngine's response type determination by providing a custom `determineType` function:

```ts
const api = new FetchEngine<SomeHeaders, SomeParams, SomeState>({
	// other configurations
	determineType(response) {

		if (/json/.test(response.headers.get('content-type'))) {
			return 'text';
		}

		return 'blob'
	}
});
```

Use the static `FetchEngine.useDefault` symbol to fall back to internal handling for specific cases:

```ts
const api = new FetchEngine<SomeHeaders, SomeParams, SomeState>({
	// other configurations
	determineType(response) {

		if (shouldSpecialHandle(response.headers)) {
			return 'arrayBuffer';
		}

		// Let FetchEngine handle other cases
		return FetchEngine.useDefault;
	}
});
```

## Events

FetchEngine emits a variety of events during different phases of the request process. These events can be intercepted and processed using event listeners.

| Event                 | Description                | Event Data                                                     |
| --------------------- | -------------------------- | -------------------------------------------------------------- |
| `fetch-before`        | Before a request           | `{ url, method, headers, params, payload, attempt }`           |
| `fetch-after`         | After a request            | `{ url, method, headers, params, payload, response, attempt }` |
| `fetch-abort`         | When a request is aborted  | `{ url, method, error, attempt }`                              |
| `fetch-error`         | When a request failed      | `{ url, method, error, attempt, step, status }`                |
| `fetch-response`      | On successful response     | `{ url, method, response, data, attempt }`                     |
| `fetch-retry`         | When a request is retried  | `{ error, attempt, nextAttempt, delay }`                       |
| `fetch-header-add`    | When a header is added     | `{ headers, value, updated, method }`                          |
| `fetch-header-remove` | When a header is removed   | `{ headers, updated, method }`                                 |
| `fetch-param-add`     | When a param is added      | `{ params, value, updated, method }`                           |
| `fetch-param-remove`  | When a param is removed    | `{ params, updated, method }`                                  |
| `fetch-state-set`     | When the state is set      | `{ state, data }`                                              |
| `fetch-state-reset`   | When the state is reset    | `{ state }`                                                    |
| `fetch-url-change`    | When the `baseUrl` changes | `{ state, data }`                                              |

## Aborting Requests

Request cancellation is essential for responsive applications. Common use cases include:

- User navigation that makes pending requests obsolete
- Autocomplete features where rapid typing triggers multiple requests
- Cleanup when components unmount

FetchEngine provides two approaches for request cancellation.

### Using Built-in Abort Functionality

```ts
// FetchEngine requests return an AbortablePromise
const call = api.get('/endpoint');

if (condition) {
    call.abort();
}

const res = await call;
```

### Using External Abort Controllers

You can provide your own AbortController for more control:

```ts
// Create an abort controller
const controller = new AbortController();

// Use it in a request
const response = await api.get('/endpoint', {
    abortController: controller
});

// Later, you can abort the request from anywhere that has access to the controller
controller.abort('Request cancelled by user');

// You can also use the same controller for multiple requests
const [responseA, responseB] = await Promise.all([
    api.get('/endpoint-a', { abortController: controller }),
    api.get('/endpoint-b', { abortController: controller })
]);

// Aborting will cancel all requests using this controller
controller.abort();
```

### Handling Aborted Requests

When a request is aborted, either through the built-in `abort()` method or an external AbortController, you can handle it using try-catch or by listening to the `fetch-abort` event:

```ts
// Using try-catch
const [response, error] = await attempt(() => api.get('/endpoint'));

if (isFetchError(error) && error.aborted) {
    console.log('Request was aborted:', error.message);
}

// Using events
api.on('fetch-abort', (event) => {
    console.log('Request aborted:', event.error?.message);
});
```

## Retry Mechanism

FetchEngine includes a powerful retry mechanism that automatically handles retrying failed requests with configurable options. This is particularly useful for handling transient network issues, rate limiting, and temporary server errors.

### Configuration

You can configure the retry behavior both globally (when creating the FetchEngine instance) and per request:

```ts
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retryConfig: {
        maxAttempts: 3,                    // Maximum number of retry attempts
        baseDelay: 1000,                   // Base delay between retries in ms
        maxDelay: 10000,                   // Maximum delay between retries in ms
        useExponentialBackoff: true,       // Whether to use exponential backoff
        retryableStatusCodes: [            // Status codes that trigger a retry
            408, // Request Timeout
            429, // Too Many Requests
            499, // Client Closed Request
            500, // Internal Server Error
            502, // Bad Gateway
            503, // Service Unavailable
            504  // Gateway Timeout
        ],
        shouldRetry: (error, attempt) => { // Custom retry logic
            // Don't retry if request was aborted
            if (error.aborted) return false;

            // Don't retry if we've exceeded max attempts
            if (attempt >= 3) return false;

            // Override the default retry time with a number
            if (attempt === 1) return 1000; // 1 second

            // Retry on network errors or configured status codes
            return !error.status ||
                   [500, 502, 503, 504].includes(error.status);
        }
    }
});
```

### Per-Request Configuration

You can override the retry configuration for individual requests:

```ts
const response = await api.get('/endpoint', {
    retryConfig: {
        maxAttempts: 5,                     // Override max attempts
        baseDelay: 500,                     // Override base delay
        shouldRetry: (error, attempt) => {  // Custom retry logic for this request
            return error.status === 500 && attempt < 5;
        }
    }
});
```

### Monitoring Retries

FetchEngine emits events during the retry process that you can listen to:

```ts
api.on('fetch-retry', (event) => {
    console.log(`Retrying request (attempt ${event.attempt} of ${event.maxAttempts})`);
    console.log(`Next attempt in ${event.delay}ms`);
    console.log('Error:', event.error);
});
```

### Error Handling with Retries

The FetchError object includes additional information about retries:

```ts
const [response, error] = await attempt(() => api.get('/endpoint', {
    retryConfig: {
        maxAttempts: 3
    }
}));

if (error && error instanceof FetchError) {
    console.log(`Failed after ${error.attempt} attempts`);
    console.log(`Failed during ${error.step} step`);
    console.log(`Status code: ${error.status}`);
}
```

### Default Retry Behavior

By default, FetchEngine will:

- Retry up to 3 times
- Use exponential backoff starting at 1 second
- Maximum delay of 10 seconds between retries
- Retry on status codes 408, 429, 499, 500, 502, 503, and 504
- Not retry aborted requests
- Use smart backoff with jitter to prevent thundering herd problems

## Error Handling

FetchEngine provides comprehensive error handling capabilities that integrate with both retry and abort mechanisms. The `FetchError` class includes detailed information about what went wrong and at what stage.

### Error Properties

```ts
interface FetchError<T = {}> extends Error {
    data: T | null;           // Any error data from the response
    status: number;           // HTTP status code or custom error code
    method: HttpMethods;      // HTTP method used
    path: string;            // Request path
    aborted?: boolean;       // Whether request was aborted
    attempt?: number;        // Which retry attempt failed
    step?: 'fetch' | 'parse' | 'response'; // Where the error occurred
    url?: string;           // Full URL that was requested
}
```

### Handling Different Error Scenarios

```ts
import { isFetchError } from '@logosdx/fetch';

const [response, error] = await attempt(() => api.get('/endpoint', {
    retryConfig: {
        maxAttempts: 3
    }
}));

if (isFetchError(error)) {
    // Handle different error scenarios
    switch (error.step) {
        case 'fetch':
            console.error('Network error:', error.message);
            break;
        case 'parse':
            console.error('Failed to parse response:', error.message);
            break;
        case 'response':
            console.error(`Server error ${error.status}:`, error.data);
            break;
    }

    // Check if it was an aborted request
    if (error.aborted) {
        console.log('Request was aborted after', error.attempt, 'attempts');
    }

    // Check if it failed after retries
    if (error.attempt && error.attempt > 1) {
        console.log(`Request failed after ${error.attempt} attempts`);
    }
}
```

### Using Events for Error Monitoring

You can use events to monitor errors across all requests:

```ts
// Monitor all errors
api.on('fetch-error', (event) => {
    console.error(`Request to ${event.path} failed:`, {
        status: event.status,
        attempt: event.attempt,
        step: event.step
    });
});

// Monitor retries
api.on('fetch-retry', (event) => {
    console.log(`Retrying ${event.path} (attempt ${event.attempt})`);
});

// Monitor aborted requests
api.on('fetch-abort', (event) => {
    console.log(`Request to ${event.path} was aborted`);
});
```

### Best Practices

1. **Always handle aborted requests separately**

```ts
if (error.aborted) {
	// Don't show error to user if request was intentionally cancelled
	return;
}
```

2. **Consider retry attempts in error messages**

```ts
const errorMessage = error.attempt > 1
	? `Failed after ${error.attempt} attempts`
	: 'Request failed';
```

3. **Use step information for detailed logging** This helps you see where the error occurred (fetch, parse, response).

```ts
logger.error(`${error.method} ${error.path} failed at ${error.step} step`, {
	status: error.status,
	attempt: error.attempt,
	data: error.data
});
```

## TypeScript Integration

FetchEngine is built with TypeScript and provides strong type safety. Here's how to leverage TypeScript features:

### Type Parameters

FetchEngine accepts three type parameters:

```typescript
FetchEngine<Headers, Params, State>
```

- `Headers`: Type for your custom headers
- `Params`: Type for URL parameters
- `State`: Type for the instance state

### Type-Safe Requests

```typescript
// Define your types
interface User {
    id: number;
    name: string;
    email: string;
}

interface CreateUserPayload {
    name: string;
    email: string;
}

// Use with requests
const user = await api.get<User>('/user/1');
const newUser = await api.post<User, CreateUserPayload>('/users', {
    name: 'John',
    email: 'john@example.com'
});

// Type-safe error handling
const [user, userError] = await attempt(() => api.get<User>('/user/1'));

if (isFetchError(userError)) {
    console.error(userError.data?.message);
}
```

### Type-Safe Headers and State

```typescript
interface CustomHeaders {
    'x-api-key': string;
    'authorization': string;
}

interface AppState {
    isAuthenticated: boolean;
    token: string | null;
}

const api = new FetchEngine<CustomHeaders, {}, AppState>({
    baseUrl: 'https://api.example.com',
    headers: {
        'x-api-key': 'your-api-key' // Type checked
    }
});

// Type-safe state management
api.setState({
    isAuthenticated: true,
    token: 'abc123'
});

// Type-safe header management
api.addHeader('authorization', `Bearer ${api.getState().token}`);
```

## Making Calls

### `request(...)`

Make a request against any HTTP method

**Example**

```ts
const someType = await api.request <SomeType>(
	'SEARCH',
	'/some-endpoint',
	{
		payload: { categories: ['a', 'b'] },
		params: { limit: 50, page: 1 },
		headers: { 'x-api-key': 'abc123' },
		determineType: () => 'json',
		formatHeaders(headers: Headers) { return snakeCase(headers) },
		onError(err: FetchError) { ... },
		onBeforeReq(opts: FetchEngine.RequestOpts) { ... }
		onAfterReq(
			clonedResponse: Response,
			opts: FetchEngine.RequestOpts
		) { ... },
	}
);
```

### `options(...)`

Makes an options request

**Example**

```ts
const someData = await api.options <ResponseType>('/some-endpoint', {
	headers: { ... }
});
```

### `get(...)`

Makes a get request

**Example**

```ts
// Basic usage
const someData = await api.get<ResponseType>('/some-endpoint', {
    headers: { ... }
});

// With retry and abort configuration
const controller = new AbortController();
const response = await api.get<ResponseType>('/some-endpoint', {
    headers: { ... },
    abortController: controller,
    retryConfig: {
        maxAttempts: 5,
        baseDelay: 500,
        shouldRetry: (error, attempt) => {
            return error.status === 500 && attempt < 5;
        }
    }
});

// With timeout and event handlers
const data = await api.get<ResponseType>('/some-endpoint', {
    timeout: 5000,
    onBeforeReq: (opts) => {
        console.log('About to make request:', opts);
    },
    onAfterReq: (response, opts) => {
        console.log('Request completed:', response.status);
    },
    onError: (error) => {
        console.error(`Request failed on attempt ${error.attempt}:`, error);
    }
});
```

### `post(...)`

Makes a post request

**Example**

```ts
const someData = await api.post <ResponseType, PayloadType>(
	'/some-endpoint',
	payload,
	{
		headers: { ... }
	}
);
```

### `put(...)`

Makes a put request

**Example**

```ts
const someData = await api.put <ResponseType, PayloadType>(
	'/some-endpoint',
	payload,
	{
		headers: { ... }
	}
);
```

### `delete(...)`

Makes a delete request

**Example**

```ts
const someData = await api.delete <ResponseType, PayloadType>(
	'/some-endpoint',
	payload,
	{
		headers: { ... }
	}
);
```

### `patch(...)`

Makes a put request

**Example**

```ts
const someData = await api.patch <ResponseType, PayloadType>(
	'/some-endpoint',
	payload,
	{
		headers: { ... }
	}
);
```

## Common Patterns

### Authentication

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    modifyOptions: (opts, state) => {

		// Add security headers when authenticated
		if (state.token) {
			opts.headers.hmac = makeHmac(opts.body, state.token);
		}

		return opts;
    }
});

// Login and store token
const { token } = await api.post('/login', credentials);

api.setState({ isAuthenticated: true, token });
api.addHeader('authorization', `Bearer ${token}`);

// Subsequent requests automatically include auth headers
const userData = await api.get('/user/profile');
```

### Rate Limit Handling

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retryConfig: {
        shouldRetry: (error, attempt) => {
            if (error.status === 429) {
                const retryAfter = error.headers?.get('retry-after');
                if (retryAfter) {
                    return true;
                }
            }
            return false;
        },
        baseDelay: (error) => {
            // Use server's retry-after header if available
            const retryAfter = error.headers?.get('retry-after');
            return retryAfter ? parseInt(retryAfter) * 1000 : 1000;
        }
    }
});
```

## Modifying your fetch instance

### `addHeader(...)`

Set an object of headers

**Example**

```ts
api.addHeader({ authorization: 'abc123' });
api.addHeader({ something: 'else' }, 'POST');
```

### `rmHeader(...)`

Remove one or many headers

**Example**

```ts
api.rmHeader('authorization');
api.rmHeader(['authorization', 'x-api-key']);
api.rmHeader(['authorization', 'x-api-key'], 'POST');
```

### `hasHeader(...)`

Checks if header is set

**Example**

```ts
api.hasHeader('authorization');
api.hasHeader('authorization', 'POST');
```


### `addParams(...)`

Set an object of params. These will be added to the URL as query parameters.

**Example**

```ts
api.addParams({ auth_token: 'abc123' });
api.addParams({ scope: 'abc123' }, 'POST');
```

### `rmParams(...)`

Remove one or many params

**Example**

```ts
api.rmParams('auth_token');
api.rmParams(['auth_token', 'scope']);
api.rmParams('auth_token', 'POST');
```

### `hasParam(...)`

Checks if param is set

**Example**

```ts
api.hasHeader('scope');
api.hasHeader('scope', 'POST');
```

### `setState(...)`

Merges a passed object into the `FetchEngine` instance state

**Example**

```ts
// Either an entire object
api.setState({
	refreshToken: 'abc123',
	authToken: 'abc123',
	isAuthenticated: true
});

// Or a single key
api.setState('isAuthenticated', false);
```

### `resetState()`

Resets the `FetchEngine` instance state to an empty object.

**Example**

```ts
api.resetState();
```

### `getState()`

Returns the `FetchEngine` instance state. This is a shallow copy of the state object.

**Example**

```ts
const state = api.getState();
```


### `changeBaseUrl(...)`

Changes the base URL for this fetch instance. This is useful if you need to change the base URL for a request.

**Example**

```ts
myApp.on('change-env', (env) => {

    api.changeBaseUrl(`http://${env}.example.com`);
})
```


