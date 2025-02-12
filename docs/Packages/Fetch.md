---
permalink: '/packages/fetch'
aliases: ["Fetch", "@logos-ui/fetch"]
---

If you have ever thought to yourself:

> It's 2023 and we're still using Axios when there's an entire `Fetch` API available to us on everything single browser

Then say hello to `FetchEngine`. It simplifies the process of making HTTP requests using the `Fetch` API while giving you access to all of its features. It provides an intuitive interface and flexible configuration options to streamlines the development of API integrations. Very simply, you define the base URL and additional headers for your FetchEngine instance.

A great feature of `FetchEngine` is its ability to customize request options based on the current state. Through the `modifyOptions` callback function, you can dynamically modify the request options before each request is sent. This enables tasks like adding authentication headers or applying specific logic based on the instance's state. `FetchEngine` also provides a convenient way to handle response data, allowing developers to access and process the results of their API requests.

```sh
npm install @logos-ui/fetch
yarn add @logos-ui/fetch
pnpm add @logos-ui/fetch
```
## Example

Even though below is a somewhat complete example of how this library can be used, you can [find the typedocs here](https://logos-ui.github.io/modules/_logos_ui_fetch.LogosUiFetch.html).

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

`FetchEngine` emits a variety of events during different phases of the request process. These events can be intercepted and processed using event listeners.


| Event                 | Description                |
| --------------------- | -------------------------- |
| `fetch-before`        | Before a request           |
| `fetch-after`         | After a request            |
| `fetch-abort`         | When a request is aborted  |
| `fetch-error`         | When a request failed      |
| `fetch-response`      | On successful response     |
| `fetch-header-add`    | When a header is added     |
| `fetch-header-remove` | When a header is removed   |
| `fetch-param-add`     | When a param is added      |
| `fetch-param-remove`  | When a param is removed    |
| `fetch-state-set`     | When the state is set      |
| `fetch-state-reset`   | When the state is reset    |
| `fetch-url-change`    | When the `baseUrl` changes |

## Aborting Requests

Aborting requests can be particularly useful in scenarios where the need for a request becomes obsolete due to user interactions, changing application state, or other factors. By promptly canceling unnecessary requests, developers can enhance the performance and responsiveness of their applications. Request abortion can also be beneficial when implementing features such as autocomplete, where users may input multiple characters quickly, triggering multiple requests. In such cases, aborting previous requests can prevent unnecessary processing and ensure that only the latest relevant response is handled.

By leveraging `FetchEngine`'s request abortion functionality, developers have fine-grained control over their application's network requests, enabling efficient resource management and improved user experience.

```ts
// requests return an agumented Promise called an AbortablePromise
const call = api.get('/');

if (condition) {

	call.abort();
}

const res = await call;
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

