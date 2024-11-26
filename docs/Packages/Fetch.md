---
permalink: '/packages/fetch'
aliases: ["Fetch", "@logos-ui/fetch"]
---

If you have ever thought to yourself:

> It's 2023 and we're still using Axios when there's an entire `Fetch` API available to us on everything single browser

Then say hello to `FetchFactory`. It simplifies the process of making HTTP requests using the `Fetch` API while giving you access to all of its features. It provides an intuitive interface and flexible configuration options to streamlines the development of API integrations. Very simply, you define the base URL and additional headers for your FetchFactory instance.

A great feature of `FetchFactory` is its ability to customize request options based on the current state. Through the `modifyOptions` callback function, you can dynamically modify the request options before each request is sent. This enables tasks like adding authentication headers or applying specific logic based on the instance's state. `FetchFactory` also provides a convenient way to handle response data, allowing developers to access and process the results of their API requests.

```sh
npm install @logos-ui/fetch
yarn add @logos-ui/fetch
pnpm add @logos-ui/fetch
```
## Example

Even though below is a somewhat complete example of how this library can be used, you can [find the typedocs here](https://logos-ui.github.io/modules/_logos_ui_fetch.LogosUiFetch.html).

```ts

type FetchHeaders = {
	'authorization'?: string,
	'x-api-key'?: string,
	'hmac': string,
	'time': number
}

type FetchState = {
	isAuthenticated?: boolean,
	authToken?: string
	refreshToken?: string,
}

const api = new FetchFactory<FetchHeaders, FetchState>({

	// FetchOptions
	baseUrl: testUrl,
	defaultType: 'json', // handle type when FetchFactory cannot
	headers: {           // default headers
		'content-type': 'application/json',
		'authorization': 'abc123'
	},
	methodHeaders: {
		POST: {          // Headers for POST requests
			'x-some-key': process.env.SOME_KEY
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
		}
	},

	// If you don't want FetchFactory to guess your content type,
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
	mode: 'cors'
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

## Making Calls

### `request(...)`

Make a request against any HTTP method

**Example**

```ts
const someType = await api.request <SomeType>('SEARCH', '/some-endpoint', {
	payload: { limit: 50 },
	headers: { ... },
	determineType(response: Response) { return 'json' },
	formatHeaders(headers: Headers) { snakeCase(headers) },
	onError(err: FetchError) { ... },
	onBeforeReq(opts: LogosUiFetch.RequestOpts) { ... }
	onAfterReq(response: Response, opts: LogosUiFetch.RequestOpts) { ... },
});
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
const someData = await api.get <ResponseType>('/some-endpoint', {
	headers: { ... }
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

## Modifying your fetch instance

### `addHeader(...)`

Set an object of headers

**Example**

```ts
api.addHeader({ authorization: 'abc123' });
```

### `rmHeader(...)`

Remove one or many headers

**Example**

```ts
api.rmHeader('authorization');
api.rmHeader(['authorization', 'x-api-key']);
```

### `hasHeader(...)`

Checks if header is set

**Example**

```ts
api.hasHeader('authorization');
// true
```

### `setState(...)`

Merges a passed object into the `FetchFactory` instance state

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

Resets the `FetchFactory` instance state.

**Example**

```ts
api.resetState();
```

### `getState()`

Returns the `FetchFactory` instance state.

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


## Events

`FetchFactory` emits a variety of events during different phases of the request process. These events can be intercepted and processed using event listeners.

| Event                 | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `fetch-before`        | Triggered before the request is made.                                   |
| `fetch-after`         | Triggered after the request is made, unless there is an error.          |
| `fetch-abort`         | Triggered when a request is explicitly aborted using the abort method.  |
| `fetch-error`         | Triggered when an error occurs during the request.                      |
| `fetch-response`      | Triggered when a successful response is received.                       |
| `fetch-header-add`    | Triggered when a header is added.                                       |
| `fetch-header-remove` | Triggered when a header is removed.                                     |
| `fetch-state-set`     | Triggered when the instance state is set using the setState method.     |
| `fetch-state-reset`   | Triggered when the instance state is reset using the resetState method. |
| `fetch-url-change`    | Triggered when the instance base URL is changed.                        |

## Aborting Requests

Aborting requests can be particularly useful in scenarios where the need for a request becomes obsolete due to user interactions, changing application state, or other factors. By promptly canceling unnecessary requests, developers can enhance the performance and responsiveness of their applications. Request abortion can also be beneficial when implementing features such as autocomplete, where users may input multiple characters quickly, triggering multiple requests. In such cases, aborting previous requests can prevent unnecessary processing and ensure that only the latest relevant response is handled.

By leveraging `FetchFactory`'s request abortion functionality, developers have fine-grained control over their application's network requests, enabling efficient resource management and improved user experience.

```ts
// requests return an agumented Promise called an AbortablePromise
const call = api.get('/');

if (condition) {

	call.abort();
}

const res = await call;
```

