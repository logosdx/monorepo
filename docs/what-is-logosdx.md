# What is LogosDX?

**Logos** */lōgōs/ n.*<br />
&nbsp;&nbsp;&nbsp;&nbsp;**¹** From the ancient Greek meaning "divine reason" and "rational principle."<br />
&nbsp;&nbsp;&nbsp;&nbsp;**²** Represents the fundamental order that governs the universe.<br />
&nbsp;&nbsp;&nbsp;&nbsp;**³** The stoics believed it was the rational law underlying all things.<br />

**DX** */di-eks/ n.*<br />
&nbsp;&nbsp;&nbsp;&nbsp;**¹** Stands for "developer experience."<br />

**LogosDX** */lōgōs di-eks/ n.*<br />
&nbsp;&nbsp;&nbsp;&nbsp;**¹** A rational developer experience.

---

In the ancient Greek conception of **Logos** - the divine reason that brings order to chaos - we found inspiration for these utilities. After years of rebuilding the same retry logic across projects, copying storage wrappers between codebases, and watching our own teams rediscover patterns we'd already solved, LogosDX emerged from the recognition that certain principles appear in every reliable system.

These aren't just utility packages. They're the distilled patterns we kept reaching for: explicit error handling that makes failure paths visible, storage abstractions that work everywhere, events that understand patterns, HTTP clients that handle failure gracefully. The utilities we wished existed when we were building cross-platform applications that needed to work reliably in production.

The rational principles that create order from development complexity.

**Why is this different?**

1. **Explicit error handling control flow**: Utilities like `attempt`/`attemptSync` return `[value, error]` tuples, which eliminates the need for try/catch— no more invisible error paths due to nested logic. This makes tests, retries, and fallbacks straightforward and more legible.

2. **Resilience is a primary concern**: `retry`, `withTimeout`, `circuitBreaker`, and `rateLimit` are available as primitives. The `FetchEngine` adds timeouts, retries, backoff, and gives you abstractions to handle common patterns (e.g., honor `Retry-After`) on top of the standard Fetch API.

3. **It offers observability, but more advanced**: `ObserverEngine` provides typed topics, regex subscriptions, async iteration, and priority queues so you can coordinate workloads. TypeScript and debugging aren't an afterthought.

4. **Runtime-agnostic by construction**: No Node-only globals or browser-only assumptions. Everything runs the same in React apps, CLIs, workers, and scripts.

5. **Tight dependency policy**: Only `@logosdx/*` dependencies. This reduces supply-chain churn and makes upgrades predictable.


## Our goals

- TypeScript-first.
- Resilience built in.
- Tree-shakable.
- Runtime agnostic.
- Small and fast.
- Debuggable, testable, and well-documented.
- Zero external dependencies.

## Use Cases

- **Shared logic across runtimes**: Validation, transformation, and I/O utilities that work in browsers and servers without forking code.
- **Processing and ETL**: Controlled concurrency, backoff, and explicit error handling for bulk jobs and data pipelines.
- **Third-party integrations**: Handle timeouts, rate limits, and partial failures without littering code with custom retry logic.
- **Event-driven systems**: Typed channels with queueing and async iteration for workflows and background work.

## Quick examples

Error tuples are the cleanest way to handle errors. This avoids nested try-catch blocks, which can often lead to invisible error paths and unexpected behavior. It keeps your code legible and explicit.

```ts
import { attempt } from '@logosdx/utils'

const [user, err] = await attempt(() => fetchUser(userId));

if (err) {

    return respond(404, 'User not found');
}
```

Fetch API is great and available everywhere, but it lacks quite a bit of the features we'd expect from a modern HTTP client. Fetch engine gives us timeouts, retries, lifecycle hooks, and more. Use it together with `attempt` to handle errors gracefully.

```ts
import Fetch, { FetchEngine, isFetchError } from '@logosdx/fetch'
import { attempt } from '@logosdx/utils'

const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retry: { maxAttempts: 3, baseDelay: 250 },
    timeoutMs: 5_000,
    defaultType: 'json',
    headers: {
        'Content-Type': 'application/json',
    },
    state: {
        userId: '123',
    },
});

const [res, err] = await attempt(() => api.get('/orders'))

if (isFetchError(err)) {
    // Handle error appropriately
}

// Or use the global instance
const [res, err] = await attempt(() => Fetch.get('https://logosdx.dev/cheat-sheet.html'));
```

The `ObserverEngine` is a mature event system with typed topics, regex subscriptions, async iteration, and priority queues. It's a great way to coordinate work across your application. Use it to build event-driven systems, background work, and more.

```ts
import { ObserverEngine } from '@logosdx/observer'

interface Events {
    'order:created': { id: string; total: number }
}

const bus = new ObserverEngine<Events>()

bus.on('order:created', ({ id }) => queueFulfillment(id));
bus.queue('order:created', processOrder, { concurrency: 4 });
```

Combine all these utilities together to build robust, resilient, and maintainable applications.

```ts
import { attempt, assert, isDefined } from '@logosdx/utils';
import { $, attrs } from '@logosdx/dom';
import { ObserverEngine } from '@logosdx/observer';
import { FetchEngine } from '@logosdx/fetch';
import { StorageEngine } from '@logosdx/storage';

type Events = {
    'app:ready': void;
}

const bus = new ObserverEngine<Events>();

type AppStorage = {
    apiState: AppState;
}

const storage = new StorageEngine<AppStorage>(localStorage, 'logosdx');


const generateHmac = async (secret: string, _message: unknown) => {

    assert(isDefined(_message), 'Message must be a string');
    assert(typeof secret === 'string', 'Secret must be a string');

    // Encode the secret key and message as Uint8Array
    // const encoder = new TextEncoder();
    // ...
    // const cryptoKey = await window.crypto.subtle.importKey(...)

    return hashHex;
}

interface AppHeaders {
    'X-Client-Version': string;
    'X-HMAC-Token': string;
    'X-Timestamp': string;
}

interface AppState {
    userId: string;
    jwt: string;
}

const api = new FetchEngine<
    AppHeaders,
    {},
    AppState,
>({
    baseUrl: window.location.origin,
    modifyOptions: (opts, state) => {

        if (opts.url.includes('/api/')) {
            opts.headers['X-Client-Version'] = '1.0.0';
        }

        if (state.userId) {
            const message = {
                time: Date.now(),
                url: opts.url,
                body: opts.body,
            }
            const hmac = await generateHmac(state.userId, message);
            opts.headers['X-HMAC-Token'] = hmac;
            opts.headers['X-Timestamp'] = message.time.toString();
        }

        return opts;
    },
    modifyMethodOptions: {
        POST: (opts) => {

            const tag = $('meta[name="csrf-token"]').pop();
            opts.headers['X-CSRF-Token'] = attrs.get(tag, 'content') || '';

            return opts;
        }
    }
});

api.on('fetch-state-set', (state) => storage.set('apiState', state));

const app = async () => {

    const [apiState, apiErr] = await attempt(() => storage.get('apiState'));

    if (apiErr) throw apiErr;

    api.setState(apiState); // Restore the state after a refresh

    bus.emit('app:ready');
}

app();
```

## Principles and guarantees

- **Observability**: Hooks are added, events are emitted, and metrics are collected so work can be measured and traced.
- **Compatibility**: Works with native `fetch` and standard browser/Node APIs; no custom runtimes required.
- **Versioning discipline**: Semantic versioning; no breaking changes in minor releases.
- **Type safety**: Types are always prioritized for an optimal developer experience.
- **Minimal dependencies**: Only `@logosdx/*` packages—no dependency hell, no abandoned addons.
