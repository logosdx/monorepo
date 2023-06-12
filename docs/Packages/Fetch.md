---
permalink: '/packages/fetch'
aliases: ["Fetch", "@logos-ui/fetch"]
---

If you have ever thought to yourself:

> It's 2023 and we're still using Axios when there's an entire `Fetch` API available to us on everything single browser

Then say hello to `FetchFactory` is. It simplifies the process of making HTTP requests using the `Fetch` API. It provides an intuitive interface and flexible configuration options to streamlines the development of API integrations. Very simply, you define the base URL, fetch type, and additional headers for your FetchFactory instance.

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

const api = new FetchFactory<FecthState, FetchHeaders>({
	baseUrl: testUrl,
	type: 'json',
	headers: {
		'content-type': 'application/json',
		'authorization': 'abc123'
	},
	modifyOptions(opts, state) {

		if (state.authToken) {
			const time = +new Date();
			opts.headers.authorization = state.authToken;
			opts.headers.hmac = makeHmac(time);
			opts.headers.time = time;
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
            FetchFactoryRequestOptions<InstanceHeaders> &
            ({ payload: Data | null } | {})
         ) = { payload: null }
    ): AbortablePromise<Res>
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
	    options: FetchFactoryRequestOptions<InstanceHeaders> = {}
	): AbortablePromise<Res>
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
	    options: FetchFactoryRequestOptions<InstanceHeaders> = {}
	): AbortablePromise<Res>
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
	    options: FetchFactoryRequestOptions<InstanceHeaders> = {}
	): AbortablePromise<Res>
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
	    options: FetchFactoryRequestOptions<InstanceHeaders> = {}
	): AbortablePromise<Res>
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
	    options: FetchFactoryRequestOptions<InstanceHeaders> = {}
	): AbortablePromise<Res>
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
	    options: FetchFactoryRequestOptions<InstanceHeaders> = {}
	): AbortablePromise<Res>
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

	addHeader(headers: HeaderObj<InstanceHeaders>): void

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

	rmHeader (headers: keyof InstanceHeaders): void;
    rmHeader (headers: (keyof InstanceHeaders)[]): void;
    rmHeader (headers: string): void;
    rmHeader (headers: string[]): void;
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

	hasHeader(name: (keyof HeaderObj<InstanceHeaders>)): boolean;

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
```

**Interface**

```ts
declare class FetchFactory /* ... */ {

	setState(conf: Partial<State>): void;
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

	getState(): State;
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
interface FetchHeaders {
	authorization?: string;
	'content-type'?: string;
}

declare class FetchFactory<
	State = {},
	InstanceHeaders = FetchHeaders
> extends EventTarget {

	removeHeader: FetchFactory<State, InstanceHeaders>['rmHeader'];

	constructor({ baseUrl, type, ...opts }: FetchFactoryOptions<State, InstanceHeaders>);

	request<Res = any, Data = any>(
		method: HttpMethods,
		path: string,
		options?: (
			FetchFactoryRequestOptions<InstanceHeaders> & (
				{
					payload: Data | null;
				} |
				{}
			)
		)
	): AbortablePromise<Res>;

	options<Res = any>(
		path: string,
		options?: FetchFactoryRequestOptions<InstanceHeaders>
	): AbortablePromise<Res>;

	get<Res = any>(
		path: string,
		options?: FetchFactoryRequestOptions<InstanceHeaders>
	): AbortablePromise<Res>;

	delete<Res = any, Data = any>(
		path: string,
		payload?: Data | null,
		options?: FetchFactoryRequestOptions<InstanceHeaders>
	): AbortablePromise<Res>;

	post<Res = any, Data = any>(
		path: string,
		payload?: Data | null,
		options?: FetchFactoryRequestOptions<InstanceHeaders>
	): AbortablePromise<Res>;

	put<Res = any, Data = any>(
		path: string,
		payload?: Data | null,
		options?: FetchFactoryRequestOptions<InstanceHeaders>
	): AbortablePromise<Res>;

	patch<Res = any, Data = any>(
		path: string,
		payload?: Data | null,
		options?: FetchFactoryRequestOptions<InstanceHeaders>
	): AbortablePromise<Res>;

	addHeader(headers: HeaderObj<InstanceHeaders>): void;

	rmHeader(headers: keyof InstanceHeaders): void;
	rmHeader(headers: (keyof InstanceHeaders)[]): void;
	rmHeader(headers: string): void;
	rmHeader(headers: string[]): void;

	hasHeader(name: (keyof HeaderObj<InstanceHeaders>)): boolean;

	setState(conf: Partial<State>): void;
	resetState(): void;
	getState(): State;

	changeBaseUrl(url: string): void;

	on(
		ev: FetchEventName | '*',
		listener: (
			e: (FetchEvent<State, InstanceHeaders>)
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
type TypeOfFactory = "arrayBuffer" | "blob" | "formData" | "json" | "text";

type HttpMethods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'PATCH' | string;

type RequestOptions = Omit<RequestInit, 'headers'>;

type HeaderObj<T> = Record<string, string> & T;

type RequestHeaders = HeaderObj<FetchHeaders>;

type FetchReqOpts = RequestOptions & {
	controller: AbortController;
	headers?: RequestHeaders;
	timeout?: number;
};

type FetchFactoryLifecycle = {
	onError?: (err: FetchError) => void | Promise<void>;
	onBeforeReq?: (opts: FetchReqOpts) => void | Promise<void>;
	onAfterReq?: (response: Response, opts: FetchReqOpts) => void | Promise<void>;
};

type FetchFactoryOptions<
	State = {},
	InstanceHeaders = RequestHeaders
> = (

	Omit<FetchReqOpts, 'method' | 'body' | 'integrity' | 'controller'> & {

		modifyOptions?: (opts: FetchReqOpts, state: State) => FetchReqOpts;
		baseUrl: string;
		type: TypeOfFactory;
		headers?: HeaderObj<InstanceHeaders>;
		timeout?: number;
	}
);

interface AbortablePromise<T> extends Promise<T> {
	abort(reason?: string): void;
}

type FetchFactoryRequestOptions<InstanceHeaders = FetchHeaders> = (
	FetchFactoryLifecycle &
	Omit<FetchReqOpts, 'body' | 'method' | 'controller'> &
	{
		headers?: HeaderObj<InstanceHeaders>;
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
	InstanceHeaders = FetchHeaders
> extends Event {
	state: State;
	url?: string;
	method?: HttpMethods;
	headers?: HeaderObj<InstanceHeaders>;
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
