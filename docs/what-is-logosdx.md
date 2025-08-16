
## What is LogosDX?

LogosDX is a small set of TypeScript-first utilities for building predictable applications across runtimes (browsers, Node.js, Deno, Bun, workers). It focuses on developer experience, debugging-friendliness, and runtime reliability. Birthed from the need to build cross-runtime, reliable applications, LogosDX is a collection of utilities that are designed to be used in a variety of different contexts. They are meant to be foundational building blocks for applications and libraries.

**Why is this different?**

1. **Explicit error handling control flow**: Utilities like `attempt`/`attemptSync` return `[value, error]` tuples. No mandatory try/catch, no invisible throw paths. Reduced nested logic. This makes tests, retries, and fallbacks straightforward and more legible.

2. **Resilience is a primary concern**: `retry`, `withTimeout`, `circuitBreaker`, and `rateLimit` are available as primitives. The `FetchEngine` adds timeouts, retries, backoff, and gives you abstractions to handle common patterns (e.g., honor `Retry-After`) on top of the standard Fetch API.

3. **It offers observability, but more advanced**: `ObserverEngine` provides typed topics, regex subscriptions, async iteration, and priority queues so you can coordinate workloads. TypeScript and debugging aren't an afterthought.

4. **Runtime-agnostic by construction**: No Node-only globals or browser-only assumptions. Everything runs the same in React apps, CLIs, workers, and scripts.

5. **Tight dependency policy**: Only `@logosdx/*` dependencies. This reduces supply-chain churn and makes upgrades predictable.


## Our goal

Offer small, reliable building blocks that make code easier to reason about and easier to keep running in production.


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
