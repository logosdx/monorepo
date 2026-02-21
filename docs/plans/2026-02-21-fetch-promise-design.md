# FetchPromise: Chainable Response API


## Overview

Replace the current `AbortablePromise<FetchResponse<T>>` return type from FetchEngine HTTP methods with a new `FetchPromise<T>` class that supports chainable parsing directives and streaming via async iteration.

**Goal:** `api.get('/users').json()`, `api.post(data).text()`, `api.get('/events').stream()`

## Class Structure

### Two classes, two interfaces

```ts
// @logosdx/utils — unchanged
class AbortablePromise<T> extends Promise<T> {
    abort(reason?: string): void;
    isFinished: boolean;
    isAborted: boolean;
}

// @logosdx/fetch — new
class FetchPromise<T, H, P, RH> extends AbortablePromise<FetchResponse<T, H, P, RH>> {
    #overrideSet = false;

    json(): FetchPromise<T, H, P, RH>;
    text(): FetchPromise<string, H, P, RH>;
    blob(): FetchPromise<Blob, H, P, RH>;
    arrayBuffer(): FetchPromise<ArrayBuffer, H, P, RH>;
    formData(): FetchPromise<FormData, H, P, RH>;
    raw(): FetchPromise<Response, H, P, RH>;
    stream(): FetchStreamPromise<H, P, RH>;

    // Exists at runtime, hidden from TS until .stream() narrows the type
    [Symbol.asyncIterator](): AsyncIterator<Uint8Array>;
}

// Type-level gating — exposes async iteration only after .stream()
interface FetchStreamPromise<H, P, RH>
    extends FetchPromise<Response, H, P, RH>, AsyncIterable<Uint8Array> {}
```

### Override guard

Each directive method checks `#overrideSet` and throws if already called. One directive per request — prevents nonsensical chains like `.json().stream().raw()`.

## Directive Categories

| Category | Methods | `data` resolves to | Parses body? |
|----------|---------|---------------------|--------------|
| Auto (default) | none | depends on content-type | yes |
| Parse directive | `.json()`, `.text()`, `.blob()`, `.arrayBuffer()`, `.formData()` | specified type | yes, explicit |
| Raw | `.raw()` | `Response` | no |
| Stream | `.stream()` | `Response` + async iterable | no |

## Execution Flow

1. HTTP method called (`api.get('/users')`) — creates `FetchPromise`, kicks off fetch
2. Optional chain (`.json()` / `.stream()` / etc.) — sets directive synchronously before microtask resolves
3. Await — executor checks directive at parse time:
   - No directive → auto-parse (backwards compatible with `defaultType` config)
   - Parse directive → use specified parser, ignore content-type
   - `.raw()` → skip parsing, `data = Response`
   - `.stream()` → skip parsing, `data = Response`, wire async iterator from `response.body`

**Timing safety:** directives are set synchronously in the same tick. `fetch()` always resolves asynchronously, so the directive is guaranteed to be set before resolution.

## Streaming

When `.stream()` is called:

- `FetchPromise` stores a reference to `ReadableStream` from `response.body` on resolution
- `Symbol.asyncIterator` yields `Uint8Array` chunks via the stream reader
- `.abort()` cancels the reader and the underlying fetch
- Cache and dedup are not applicable (single live connection)
- `FetchPromise` still resolves to `FetchResponse<Response>` — headers, status, etc. accessible

```ts
// Iterate chunks
for await (const chunk of api.get('/events').stream()) {
    console.log(new TextDecoder().decode(chunk));
}

// Abort mid-stream
const req = api.get('/events').stream();
setTimeout(() => req.abort(), 5000);
for await (const chunk of req) { ... }

// Access response metadata
const stream = api.get('/events').stream();
const response = await stream;
console.log(response.status, response.headers);
for await (const chunk of stream) { ... }
```

## Breaking Changes

- **`{ stream: true }` option removed** — replaced by `.stream()` chain
- **Return type narrows** from `AbortablePromise<FetchResponse<T>>` to `FetchPromise<T, H, P, RH>` — subtype, so assignments compatible
- Beta release, breaking changes expected

## What Does NOT Change

- `FetchResponse<T>` envelope shape (data, headers, status, request, config)
- Auto-parsing behavior when no directive is chained
- `defaultType` configuration option
- Plugin/hook architecture
- Event system
- AbortablePromise in @logosdx/utils
