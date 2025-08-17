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

```ts
import { attempt } from '@logosdx/utils'

const [user, err] = await attempt(() => fetchUser(userId));

if (err) {

    return respond(404, 'User not found');
}
```

```ts
import { FetchEngine } from '@logosdx/fetch'
import { attempt } from '@logosdx/utils'

const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retryConfig: { maxAttempts: 3, baseDelay: 250 },
    timeoutMs: 5_000,
})

const [res, err] = await attempt(() => api.get('/orders'))

if (err) {
    // Handle error appropriately
}
```

```ts
import { ObserverEngine } from '@logosdx/observer'

interface Events {
    'order:created': { id: string; total: number }
}

const bus = new ObserverEngine<Events>()

bus.on('order:created', ({ id }) => queueFulfillment(id));
bus.queue('order:created', processOrder, { concurrency: 4 });
```

## Principles and guarantees

- **Observability**: Hooks are added, events are emitted, and metrics are collected so work can be measured and traced.
- **Compatibility**: Works with native `fetch` and standard browser/Node APIs; no custom runtimes required.
- **Versioning discipline**: Semantic versioning; no breaking changes in minor releases.
- **Type safety**: Types are always prioritized for an optimal developer experience.
- **Minimal dependencies**: Only `@logosdx/*` packages—no dependency hell, no abandoned addons.
