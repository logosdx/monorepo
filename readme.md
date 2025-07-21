# Logos DX

Logos DX provides focused TypeScript utilities for building UIs and apps. It rejects bloated frameworks and vague wrappers, delivering direct tools that leverage web standards for reliability and performance. Use it in browsers, Node.js, React, or anywhere JavaScript runs.

## Why This Exists

Modern web development suffers from over-engineered libraries that hide complexity behind magic, leading to unpredictable behavior and debugging nightmares. Logos DX cuts through that:

- Replaces old event systems with a typed observer that handles regex patterns and queues without surprises.
- Fixes flaky network calls by wrapping Fetch with built-in retries, timeouts, and validation— no more manual error handling boilerplate.
- Simplifies DOM work without jQuery-like bloat, using native APIs with safe, declarative behaviors.
- Avoids state management traps like infinite loops or stale data via a stream-based machine with time-travel.

These tools exist to make code predictable, testable, and maintainable. No hype, just utilities that work.

## Core Packages

### @logosdx/utils

Essential functions for data, flow control, and validation. Replaces scattered helpers with typed, composable alternatives.

- Data: `clone`, `equals`, `merge`, `PriorityQueue`.
- Flow: `attempt` (error monad), `retry`, `throttle`, `memo`, `circuitBreaker`.
- Misc: `assert`, `wait`, `chunk`.

```ts
import { attempt, retry } from '@logosdx/utils';

const [result, err] = await attempt(() => fetchData());
if (err) throw err;

const reliableFetch = retry(fetchData, { maxAttempts: 3 });
```

### @logosdx/observer

Typed event system with regex support, queuing, and spying. Avoids callback hell and missed events in dynamic UIs.

- Methods: `on`, `once`, `emit`, `off`, `queue`.
- Features: Regex listeners, event spying, child observables.

```ts
import { ObserverEngine } from '@logosdx/observer';

const obs = new ObserverEngine();
obs.on('update', (data) => console.log(data));
obs.emit('update', { value: 42 });

obs.queue('task', processTask, { concurrency: 2 });
```

### @logosdx/fetch

Resilient Fetch wrapper. Solves native Fetch's lack of retries, timeouts, and easy interception.

- Features: Auto-retry with backoff, abort signals, header/param validation, interceptors.

```ts
import { FetchEngine } from '@logosdx/fetch';

const api = new FetchEngine({ baseUrl: 'https://api.example.com' });
const [data, err] = await attempt(() => api.get('/users'));
```

### @logosdx/dom

DOM utilities emphasizing native APIs. Rejects heavy selectors; provides safe behaviors and events.

- Modules: `css`, `attrs`, `events`, `behaviors`.
- Utils: `$` (query), `createElWith`, viewport measurements.

```ts
import { html } from '@logosdx/dom';

html.events.on(button, 'click', handleClick);
html.behaviors.bind('[copy]', 'Copy', (el) => new CopyHandler(el));
```

## Supporting Packages

- **@logosdx/kit**: Bundles packages into a typed app starter (observer, state, storage, fetch).

## In development

- **@logosdx/localize**: Typed i18n with fallback and dynamic loading.
- **@logosdx/state-machine**: Stream-based state with reducers and history.
- **@logosdx/storage**: Typed wrapper for LocalStorage/AsyncStorage.

## LLM Helpers

Prompt templates and utilities for AI-assisted development in `/llm-helpers`. Includes guides for utils, fetch, observer, and dom. [Check it out](./llm-helpers/README.md)

## Installation

```bash
pnpm add @logosdx/kit

# Or individual packages
pnpm add @logosdx/utils
pnpm add @logosdx/observer
pnpm add @logosdx/fetch
pnpm add @logosdx/dom
```

See docs at [logosdx.dev](https://logosdx.dev/) for full API references.


