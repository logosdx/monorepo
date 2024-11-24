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
	defaultType: 'json',
	headers: {
		'content-type': 'application/json',
		'authorization': 'abc123'
	},
	methodHeaders: {
		POST: {
			'x-some-key': process.env.SOME_KEY
		}
	},
	modifyOptions(opts, state) {

		if (state.authToken) {
			const time = +new Date();
			opts.headers.authorization = state.authToken;
			opts.headers.hmac = makeHmac(time);
			opts.headers.time = time;
		}
	},
	modifyMethodOptions: {
		PATCH(opts, state) {

			if (state.permission) {
				opts.headers['special-patch-only-header'] = 'abc123'
			}
		}
	},
	validate: {

		headers(headers) {

			Joi.assert(headersSchema, headers);
		},

		state(state) {

			Joi.assert(fetchStateSchema, state);
		}
	},

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
	headers: { ... }
});
```

**Interface**

```ts

declare class FetchFactory /* ... */ {

	request <Res = any, Data = any>(
        method: HttpMethods,
        path: string,
        options: (
            LogosUiFetch.CallOptions<H> &
            ({ payload: Data | null } | {})
         ) = { payload: null }
    ): LogosUiFetch.AbortablePromise<Res>
}
```

### `options(...)`

Makes an options request

**Example**

```ts
const someData = await api.options <ResponseType>('/some-endpoint', {
	headers: { ... }
});
```

**Interface**

```ts
declare class FetchFactory /* ... */ {

    options <Res = any>(
	    path: string,
	    options: LogosUiFetch.CallOptions<H> = {}
	): LogosUiFetch.AbortablePromise<Res>
}
```


### `get(...)`

Makes a get request

**Example**

```ts
const someData = await api.get <ResponseType>('/some-endpoint', {
	headers: { ... }
});
```

**Interface**

```ts
declare class FetchFactory /* ... */ {

    get <Res = any>(
	    path: string,
	    options: LogosUiFetch.CallOptions<H> = {}
	): LogosUiFetch.AbortablePromise<Res>
}
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

**Interface**

```ts
declare class FetchFactory /* ... */ {

    post <Res = any, Data = any>(
	    path: string,
	    payload: Data | null = null,
	    options: LogosUiFetch.CallOptions<H> = {}
	): LogosUiFetch.AbortablePromise<Res>
}
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

**Interface**

```ts
declare class FetchFactory /* ... */ {

    put <Res = any, Data = any>(
	    path: string,
	    payload: Data | null = null,
	    options: LogosUiFetch.CallOptions<H> = {}
	): LogosUiFetch.AbortablePromise<Res>
}
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

**Interface**

```ts
declare class FetchFactory /* ... */ {

    delete <Res = any, Data = any>(
	    path: string,
	    payload: Data | null = null,
	    options: LogosUiFetch.CallOptions<H> = {}
	): LogosUiFetch.AbortablePromise<Res>
}
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

**Interface**

```ts
declare class FetchFactory /* ... */ {

    patch <Res = any, Data = any>(
	    path: string,
	    payload: Data | null = null,
	    options: LogosUiFetch.CallOptions<H> = {}
	): LogosUiFetch.AbortablePromise<Res>
}
```

## Modifying your fetch instance

### `addHeader(...)`

Set an object of headers

**Example**

```ts
api.addHeader({ authorization: 'abc123' });
```

**Interface**

```ts
declare class FetchFactory /* ... */ {

    addHeader<K extends keyof H>(name: K, value: H[K]): void;
    addHeader(name: string, value: string): void;
    addHeader(headers: LogosUiFetch.Headers<H>): void;

}
```

### `rmHeader(...)`

Remove one or many headers

**Example**

```ts
api.rmHeader('authorization');
api.rmHeader(['authorization', 'x-api-key']);
```

**Interface**

```ts
declare class FetchFactory /* ... */ {

    rmHeader(headers: keyof H): void;
    rmHeader(headers: (keyof H)[]): void;
    rmHeader(headers: string): void;
    rmHeader(headers: string[]): void;
}
```


### `hasHeader(...)`

Checks if header is set

**Example**

```ts
api.hasHeader('authorization');
// true
```

**Interface**

```ts
declare class FetchFactory /* ... */ {

    hasHeader(name: (keyof LogosUiFetch.Headers<H>)): boolean;

}
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

**Interface**

```ts
declare class FetchFactory /* ... */ {

	setState<N extends keyof S>(name: N, value: S[N]): void;
	setState(conf: Partial<S>): void;
}
```

### `resetState()`

Resets the `FetchFactory` instance state.

**Example**

```ts
api.resetState();
```

**Interface**

```ts
declare class FetchFactory /* ... */ {

	resetState(): void;
}
```

### `getState()`

Returns the `FetchFactory` instance state.

**Example**

```ts
const state = api.getState();
```

**Interface**

```ts
declare class FetchFactory /* ... */ {

	getState(): S;
}
```


### `changeBaseUrl(...)`

Changes the base URL for this fetch instance

**Example**

```ts
api.changeBaseUrl('http://dev.sample.com');
```

**Interface**

```ts
declare class FetchFactory /* ... */ {

	changeBaseUrl(url: string): void;
}
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

## Main Interfaces

```ts
declare class FetchFactory<
	H = FetchHeaders,
	S = {},
> extends EventTarget {

	removeHeader: FetchFactory<H, S>['rmHeader'];

	constructor({ baseUrl, type, ...opts }: LogosUiFetch.Options<H, S>);

	request<Res = any, Data = any>(
		method: HttpMethods,
		path: string,
		options?: (
			LogosUiFetch.CallOptions<H> & (
				{
					payload: Data | null;
				} |
				{}
			)
		)
	): LogosUiFetch.AbortablePromise<Res>;

	options<Res = any>(
		path: string,
		options?: LogosUiFetch.CallOptions<H>
	): LogosUiFetch.AbortablePromise<Res>;

	get<Res = any>(
		path: string,
		options?: LogosUiFetch.CallOptions<H>
	): LogosUiFetch.AbortablePromise<Res>;

	delete<Res = any, Data = any>(
		path: string,
		payload?: Data | null,
		options?: LogosUiFetch.CallOptions<H>
	): LogosUiFetch.AbortablePromise<Res>;

	post<Res = any, Data = any>(
		path: string,
		payload?: Data | null,
		options?: LogosUiFetch.CallOptions<H>
	): LogosUiFetch.AbortablePromise<Res>;

	put<Res = any, Data = any>(
		path: string,
		payload?: Data | null,
		options?: LogosUiFetch.CallOptions<H>
	): LogosUiFetch.AbortablePromise<Res>;

	patch<Res = any, Data = any>(
		path: string,
		payload?: Data | null,
		options?: LogosUiFetch.CallOptions<H>
	): LogosUiFetch.AbortablePromise<Res>;

	addHeader(headers: HeaderObj<H>): void;

	rmHeader(headers: keyof H): void;
	rmHeader(headers: (keyof H)[]): void;
	rmHeader(headers: string): void;
	rmHeader(headers: string[]): void;

	hasHeader(name: (keyof HeaderObj<H>)): boolean;

	get headers(): {
		readonly default: Readonly<HeaderObj<H>>;
		readonly get?: Readonly<HeaderObj<H>>;
		readonly post?: Readonly<HeaderObj<H>>;
		readonly put?: Readonly<HeaderObj<H>>;
		readonly delete?: Readonly<HeaderObj<H>>;
		readonly options?: Readonly<HeaderObj<H>>;
		readonly patch?: Readonly<HeaderObj<H>>;
	};

	setState<N extends keyof S>(name: N, value: S[N]): void;
	setState(conf: Partial<S>): void;

	resetState(): void;
	getState(): S;

	changeBaseUrl(url: string): void;

	on(
		ev: FetchEventName | '*',
		listener: (
			e: (FetchEvent<H, S>)
		) => void,
		once?: boolean
	): void;

	off(
		ev: FetchEventName | '*',
		listener: EventListenerOrEventListenerObject
	): void;
}
```

## Supporting Interfaces

```ts
export type _InternalHttpMethods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'PATCH';
export type HttpMethods = _InternalHttpMethods | string;
export type HttpMethodOpts<T> = Partial<Record<_InternalHttpMethods, T>>;
export type RawRequestOptions = Omit<RequestInit, 'headers'>;
export type HeaderObj<T> = Record<string, string> & Partial<T>;
export type MethodHeaders<T> = HttpMethodOpts<HeaderObj<T>>;

export declare namespace LogosUiFetch {
    type Type = 'arrayBuffer' | 'blob' | 'formData' | 'json' | 'text';
    /**
     * Override this interface with the headers you intend
     * to use and set throughout your app.
     */
    interface InstanceHeaders {
        Authorization?: string;
        'Content-Type'?: string;
    }
    type Headers<T = InstanceHeaders> = HeaderObj<T>;
    type HeaderKeys = keyof Headers;
    interface DetermineTypeFn {
        (response: Response): Type;
    }
    interface FormatHeadersFn {
        (headers: Headers): Headers;
    }
    type Lifecycle = {
        onError?: (err: FetchError) => void | Promise<void>;
        onBeforeReq?: (opts: LogosUiFetch.RequestOpts) => void | Promise<void>;
        onAfterReq?: (response: Response, opts: LogosUiFetch.RequestOpts) => void | Promise<void>;
    };
    type RequestOpts<T = InstanceHeaders> = RawRequestOptions & {
        controller: AbortController;
        headers?: Headers<T>;
        timeout?: number;
        determineType?: DetermineTypeFn;
        formatHeaders?: boolean | 'lowercase' | 'uppercase' | FormatHeadersFn;
    };
    type Options<H = Headers, S = {}> = (Omit<RequestOpts<H>, 'method' | 'body' | 'integrity' | 'controller'> & {
        /**
         * The base URL for all requests
         */
        baseUrl: string;
        /**
         * The default type of response expected from the server.
         * This will be used to determine how to parse the
         * response from the server when content-type headers
         * are not present or fail to do so.
         */
        defaultType?: Type;
        /**
         * The headers to be set on all requests
         */
        headers?: HeaderObj<H>;
        /**
         * The headers to be set on requests of a specific method
         * @example
         * {
         *     GET: { 'content-type': 'application/json' },
         *     POST: { 'content-type': 'application/x-www-form-urlencoded'
         * }
         */
        methodHeaders?: MethodHeaders<H>;
        /**
         *
         * @param opts
         * @param state
         * @returns
         */
        modifyOptions?: (opts: RequestOpts<H>, state: S) => RequestOpts<H>;
        modifyMethodOptions?: HttpMethodOpts<Options<H, S>['modifyOptions']>;
        timeout?: number;
        validate?: {
            headers?: (headers: Headers<H>, method?: _InternalHttpMethods) => void;
            state?: (state: S) => void;
            perRequest?: {
                headers?: boolean;
            };
        };
        determineType?: DetermineTypeFn;
        formatHeaders?: false | 'lowercase' | 'uppercase' | FormatHeadersFn;
    });
    interface AbortablePromise<T> extends Promise<T> {
        isFinished: boolean;
        isAborted: boolean;
        abort(reason?: string): void;
    }
    type CallOptions<H = InstanceHeaders> = (Lifecycle & Omit<RequestOpts, 'body' | 'method' | 'controller'> & {
        headers?: HeaderObj<H>;
    });
}

type FetchFactoryRequestOptions<H = FetchHeaders> = (
	FetchFactoryLifecycle &
	Omit<FetchReqOpts, 'body' | 'method' | 'controller'> &
	{
		headers?: HeaderObj<H>;
	}
);

interface FetchError<T = {}> extends Error {
	data: T | null;
	status: number;
	method: HttpMethods;
	path: string;
	aborted?: boolean;
}

declare class FetchEvent<
	State = {},
	H = FetchHeaders
> extends Event {
	state: State;
	url?: string;
	method?: HttpMethods;
	headers?: HeaderObj<H>;
	options?: FetchReqOpts;
	data?: any;
	payload?: any;
	response?: Response;
	error?: FetchError;
}

declare enum FetchEventNames {
	'fetch-before' = "fetch-before",
	'fetch-after' = "fetch-after",
	'fetch-abort' = "fetch-abort",
	'fetch-error' = "fetch-error",
	'fetch-response' = "fetch-response",
	'fetch-header-add' = "fetch-header-add",
	'fetch-header-remove' = "fetch-header-remove",
	'fetch-state-set' = "fetch-state-set",
	'fetch-state-reset' = "fetch-state-reset",
	'fetch-url-change' = "fetch-url-change"
}

type FetchEventName = keyof typeof FetchEventNames;
```
