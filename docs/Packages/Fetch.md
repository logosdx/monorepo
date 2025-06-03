---
permalink: '/packages/fetch'
aliases: ["Fetch", "@logosdx/fetch"]
---

If you have ever thought to yourself:

> It's 2025 and we're still using Axios when there's an entire `Fetch` API available to us on everything single browser

Then say hello to `FetchEngine`. It simplifies the process of making HTTP requests using the `Fetch` API while giving you access to all of its features. It provides an intuitive interface and flexible configuration options to streamlines the development of API integrations. Very simply, you define the base URL and additional headers for your FetchEngine instance.

A great feature of `FetchEngine` is its ability to customize request options based on the current state. Through the `modifyOptions` callback function, you can dynamically modify the request options before each request is sent. This enables tasks like adding authentication headers or applying specific logic based on the instance's state. `FetchEngine` also provides a convenient way to handle response data, allowing developers to access and process the results of their API requests.

```sh
npm install @logosdx/fetch
yarn add @logosdx/fetch
pnpm add @logosdx/fetch
```

## Quick Start

Get up and running quickly with FetchEngine:

```typescript
// 1. Create a simple instance
const api = new FetchEngine({
    baseUrl: 'https://api.example.com'
});

// 2. Make requests
const data = await api.get('/users');
await api.post('/users', { name: 'John' });

// 3. Handle errors
try {
    const response = await api.get('/users');
} catch (error) {
    if (error instanceof FetchError) {
        console.error(`${error.status}: ${error.message}`);
    }
}

// 4. Add retry capabilities
api.get('/users', {
    retryConfig: {
        maxAttempts: 3,
        retryableStatusCodes: [500, 502, 503]
    }
});

// 5. Cancel requests
const request = api.get('/users');
request.abort(); // Cancel when needed
```

## Example

Even though below is a somewhat complete example of how this library can be used, you can [find the typedocs here](https://logosdx.github.io/modules/_logos_ui_fetch.LogosUiFetch.html).

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

	// FetchOptions
	baseUrl: testUrl,
	defaultType: 'json', // handle type when FetchEngine cannot
	headers: {           // default headers
		'content-type': 'application/json',
		'authorization': 'abc123'
	},
	methodHeaders: {
		POST: {          // Headers for POST requests
			'x-some-key': process.env.SOME_KEY
		}
	},

	params: {
		auth_token: ''  // default params
	},
	methodParams: {
		POST: {
			scope: ''   // params for POST requests
		}
	},

	// runs every request and allows modifying options
	modifyOptions(opts, state) {

		if (state.authToken) {
			const time = +new Date();
			opts.headers.authorization = state.authToken;
			opts.headers.hmac = makeHmac(time);
			opts.headers.time = time;
		}
	},

	// modify options per http method
	modifyMethodOptions: {
		PATCH(opts, state) {

			if (state.permission) {
				opts.headers['special-patch-only-header'] = 'abc123'
			}
		}
	},

	validate: {

		headers(headers) {    // Validate headers

			Joi.assert(headersSchema, headers);
		},

		state(state) {        // Validate state

			Joi.assert(fetchStateSchema, state);
		},

		params(params) {

			Joi.assert(paramsSchema, params);
		},

		perRequest: {
			headers: true,
			params: true
		}
	},

	// If you don't want FetchEngine to guess your content type,
	// handle it yourself.
	determineType(response) {

		if (/json/.test(response.headers.get('content-type'))) {
			return 'text';
		}

		return 'blob'
	},

	// If your server requires specific header formatting, you can
	// use this option to modify them. Set to `false` to never format.
	formatHeaders: 'lowercase',

	// RequestInit options
	cache: 'no-cache',
	credentials: 'include',
	mode: 'cors',

    retryConfig: {
        maxAttempts: 3,
        retryableStatusCodes: [500, 502, 503],
        baseDelay: 1000,
        maxDelay: 10000,
        useExponentialBackoff: true,
        shouldRetry: (error, attempt) => {
            return !error.status || error.status === 503;
        }
    }
});

const res = await api.get <SomeType>('/some-endpoint');
const res = await api.delete <SomeType>('/some-endpoint');
const res = await api.post <SomeType>('/some-endpoint', { payload });
const res = await api.put <SomeType>('/some-endpoint', { payload });
const res = await api.patch <SomeType>('/some-endpoint', { payload });

if (res.authToken) {

	api.setState({ authToken: res.authToken });
}
```

## How responses are handled

When you configure your `FetchEngine` instance, you might pass the `defaultType` configuration. This only states how FetchEngine should handle your if it can't resolve it itself. Servers usually respond with the standard-place header `Content-Type` to signify the mime-type that should be used to handle the response. `FetchEngine` extracts those headers and guesses how it should handle that response.

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

If you don't want `FetchEngine` to guess your content type, you can handle it yourself. You can do this by passing a function to the `determineType` configuration option. This function should return a string that matches the type you want to handle.

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

You can also use the static `FetchEngine.useDefault` symbol to tell FetchEngine to use the internal response handler to determine the type. This way, you can handle your very specific use cases and let FetchEngine handle the rest.

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

Aborting requests can be particularly useful in scenarios where the need for a request becomes obsolete due to user interactions, changing application state, or other factors. By promptly canceling unnecessary requests, developers can enhance the performance and responsiveness of their applications. Request abortion can also be beneficial when implementing features such as autocomplete, where users may input multiple characters quickly, triggering multiple requests. In such cases, aborting previous requests can prevent unnecessary processing and ensure that only the latest relevant response is handled.

By leveraging `FetchEngine`'s request abortion functionality, developers have fine-grained control over their application's network requests, enabling efficient resource management and improved user experience.

### Using Built-in Abort Functionality

```ts
// requests return an agumented Promise called an AbortablePromise
const call = api.get('/');

if (condition) {
    call.abort();
}

const res = await call;
```

### Using External Abort Controllers

You can provide your own AbortController to manage request cancellation externally. This is particularly useful when you need to:
- Cancel multiple requests at once
- Share abort signals across different parts of your application
- Integrate with frameworks that provide their own abort controllers

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
try {
    const response = await api.get('/endpoint');
} catch (error) {
    if (error instanceof FetchError && error.aborted) {
        console.log('Request was aborted:', error.message);
    }
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
try {
    const response = await api.get('/endpoint');
} catch (error) {
    if (error instanceof FetchError) {
        console.log(`Failed after ${error.attempt} attempts`);
        console.log(`Failed during ${error.step} step`); // 'fetch', 'parse', or 'response'
        console.log(`Status code: ${error.status}`);
    }
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
try {
    const response = await api.get('/endpoint', {
        retryConfig: {
            maxAttempts: 3
        }
    });
} catch (error) {
    if (error instanceof FetchError) {
        // Handle different error scenarios
        switch (error.step) {
            case 'fetch':
                // Network level errors
                console.error('Network error:', error.message);
                break;

            case 'parse':
                // Response parsing errors
                console.error('Failed to parse response:', error.message);
                break;

            case 'response':
                // Server errors or non-200 responses
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

3. **Use step information for detailed logging**
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
try {
    await api.get<User>('/user/1');
} catch (error) {
    if (error instanceof FetchError<{ message: string }>) {
        // Error.data will be typed as { message: string } | null
        console.error(error.data?.message);
    }
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
		onBeforeReq(opts: LogosUiFetch.RequestOpts) { ... }
		onAfterReq(
			clonedResponse: Response,
			opts: LogosUiFetch.RequestOpts
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

### Authentication and Security

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    modifyOptions: (opts, state) => {

		// Add hmac header if token is present
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

// Token is automatically added to subsequent requests
// and hmac header is added if token is present
const userData = await api.get('/user/profile');
```

### Rate Limiting

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retryConfig: {
        shouldRetry: (error, attempt) => {
            if (error.status === 429) { // Too Many Requests
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

### Caching Responses

```typescript
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const api = new FetchEngine({
    baseUrl: 'https://api.example.com'
});

const getCached = async <T>(url: string): Promise<T> => {
    const cached = cache.get(url);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < CACHE_TTL) {
        return cached.data;
    }

    const data = await api.get<T>(url);
    cache.set(url, { data, timestamp: now });
    return data;
};

// Use cached requests
const data = await getCached('/frequently-accessed-endpoint');
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

Set an object of params

**Example**

```ts
api.addParams({ auth_token: 'abc123' });
api.addParams({ scope: 'abc123' }, 'POST');
```

### `rmParams(...)`

Remove one or many headers

**Example**

```ts
api.rmParams('auth_token');
api.rmParams(['auth_token', 'scope']);
api.rmParams('auth_token', 'POST');
```

### `hasParam(...)`

Checks if header is set

**Example**

```ts
api.hasHeader('scope');
api.hasHeader('scope', 'POST');
```


### `setState(...)`

Merges a passed object into the `FetchEngine` instance state

**Example**

```ts
api.setState({
	refreshToken: 'abc123',
	authToken: 'abc123',
	isAuthenticated: true
});

api.setState('isAuthenticated', false);
```

### `resetState()`

Resets the `FetchEngine` instance state.

**Example**

```ts
api.resetState();
```

### `getState()`

Returns the `FetchEngine` instance state.

**Example**

```ts
const state = api.getState();
```


### `changeBaseUrl(...)`

Changes the base URL for this fetch instance

**Example**

```ts
api.changeBaseUrl('http://dev.sample.com');
```


