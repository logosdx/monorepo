---
permalink: '/packages/observer'
aliases: ["Observer", "@logosdx/observer"]
---
# @logosdx/observer

**Type-safe, regex-native, memory-leak-proof event system.**

Node's `EventEmitter` is broken. The DOM has no real alternative. RxJS is bloated. `@logosdx/observer` gives you event-driven architecture that doesn't fight you.

* Fully type-safe
* Works in Node, browsers, workers, and React Native
* Regex-based event matching
* Promises and generators for async event flow
* Built-in debugging and memory safety

```bash
npm install @logosdx/observer
```

```bash
npm install @logosdx/observer
```

```bash
pnpm add @logosdx/observer
```

With jsdeliver:

```html
<script src="https://cdn.jsdelivr.net/npm/@logosdx/observer@latest/dist/browser/bundle.js"></script>
```


```html
<script>
	const { ObserverEngine } = LogosDx.Observer;
</script>
```

## Quick Start

```ts
import { ObserverEngine } from '@logosdx/observer';

type Events = {
  ready: void;
  message: { from: string, content: string };
}

const observer = new ObserverEngine<Events>();

observer.once('ready', () => console.log('System is ready'));

observer.emit('ready'); // System is ready

observer.on('message', ({ from, content }) => {
  console.log(`${from} says: ${content}`);
});

observer.emit('message', { from: 'Alice', content: 'Hello world' }); // Alice says: Hello world
```

---

## Full Guides

* [Concepts & Patterns](/docs/observer/core-patterns)
* [Debugging Tools](/docs/observer/debugging)
* [Event Queue](/docs/observer/queue)
* [API Reference](https://typedoc.logosdx.dev/modules/_logosdx_observer.html)

---

## Why It's Better

### 1. **Type Safety That Works**

```ts
observer.on('message', (data) => {
  // data is fully typed: { from: string; content: string }
});

observer.emit('message', {
  from: 'alice@ether.net',
  content: 'Hello world'
});
```

Misspell an event? Wrong payload shape? TypeScript will catch it.

### 2. **Regex-Based Event Matching**

```ts
observer.on(/user:/, ({ event, data }) => {
  if (event === 'user:login') logUserIn(data); // TypeScript knows this is a user:login event
});

observer.emit('user:login', { id: 1 });
```

Regex-based listeners let you listen to structured event families. Regex matches receive `{ event, data }`.

### 3. **Promise-Driven Flow Control**

```ts
await observer.once('ready');
```

```ts
const { event, data } = await observer.once(/user:/);
```

Async/await works natively. Stop nesting callbacks and writing janky state machines.

### 4. **Event Generators for Async Streams**

```ts
const loginEvents = observer.on('user:login');

while (!loginEvents.done) {
  const user = await loginEvents.next();
  welcome(user);
}
```

Generators give you fine-grained async control for debounce, throttle, buffering, etc. Think `EventEmitter` × `AsyncIterable`.

### 5. **Memory Safety by Default**

Every listener, generator, or promise returns a cleanup method:

```ts
const cleanup = observer.on('something', () => {});
cleanup();

const gen = observer.on('stream');
gen.cleanup();

const promise = observer.once('done');
promise.cleanup();
```

No more mystery leaks or zombie listeners in React or long-lived processes.

### 6. **Built-in Debugging**

```ts
observer.debug(true);
```

```ts
observer.$facts();      // Listener counts
observer.$has('event'); // Check if anyone is listening
observer.$internals();  // Debugging only
```

Add a `.spy()` function for full telemetry:

```ts
const observer = new ObserverEngine({
  spy: ({ fn, event, data }) => {
    console.log(`[${fn}] ${event}`, data);
  }
});
```

### 7. **Emit Validation**

```ts
const observer = new ObserverEngine({
  emitValidator: (event, data) => {
    assertValidPayload(event, data); // Use Joi, Zod, whatever
  }
});
```

Prevent garbage from even entering your system. Optional but powerful.

### 8. **Class Inheritance or Delegation**

```ts
class ModalController extends ObserverEngine<{ open: void; close: void }> {
  open() { this.emit('open'); }
  close() { this.emit('close'); }
}
```

### 9. **Event Queues**

Use the event emitter as a queue.

```ts
const queue = observer.queue('some-event', myProcessor, {
  name: 'some-reaction-to-some-event',
  concurrency: 1,
  debounceMs: 100,
  jitter: 0.5,
  processIntervalMs: 1000,
  timeoutMs: 10000,
  maxQueueSize: 1000,
  rateLimitItems: 100,
});

queue.on('error', ({ data, error }) => {

  if (is5xxError(error)) {
    queue.add(data); // Retry the job
    return;
  }

  // Do something else
  analytics.track('error', { error, data });
});
```

And now you can emit events to the queue from anywhere.

```ts
observer.emit('some-event', { data: 'some-data' });
```

Or directly from the queue.

```ts
queue.add(data);
// with priority
queue.add(data, 10);
```

---

## Conceptual Comparison

* ❌ = Not supported
* ⚠️ = Partial, limited, or awkward
* ✅ = Supported or built-in

| Feature                   | EventEmitter | RxJS | `@logosdx/observer` |
| ------------------------- | ------------ | ---- | ------------------- |
| Works everywhere          | ❌           | ✅   | ✅                  |
| Full TypeScript support   | ⚠️           | ✅   | ✅                  |
| Regex-based subscriptions | ❌           | ❌   | ✅                  |
| Promises for events       | ❌           | ⚠️   | ✅                  |
| Async generators          | ❌           | ✅   | ✅                  |
| Built-in validation       | ❌           | ⚠️   | ✅                  |
| Manual memory management  | ✅           | ⚠️   | ❌ (auto-cleanup)   |
| Easy to use               | ✅           | ❌   | ✅                  |
| Debugging support         | ❌           | ⚠️   | ✅                  |
| Class-based extension     | ✅           | ❌   | ✅                  |
| Runtime safety            | ❌           | ⚠️   | ✅                  |
| Streaming control flow    | ❌           | ✅   | ✅                  |

---

## FAQ

**Q: Is this just another `EventEmitter` clone?**

No.

`ObserverEngine` is a full replacement with:

* Full TypeScript support
* Regex subscriptions
* Promises and generators
* Built-in validation and cleanup
* Debugging tools

`EventEmitter` is 2009 tech. This is built for 2025+ systems.

---

**Q: Can I use this in the browser?**

Yes. It works in:

* Node.js
* Browsers (ESM or bundled)
* Web Workers
* React and React Native

No shims required.

---

**Q: Does it support wildcard events like `"user:*"`?**

Not exactly–it supports real RegExp-based event subscriptions:

```ts
observer.on(/user:/, ({ event, data }) => ...)
```

This gives you better control using real RegExp, not fake pattern-matching syntax.

---

**Q: Is this reactive like RxJS or Signals?**

No. It's more fundamental:

* No chained operators
* No observable streams
* No implicit reactivity

Think of it as a **flexible async event bus**, not a reactive state graph.

---

**Q: How is this better than Redux or Zustand?**

If you're using events as your UI model, `ObserverEngine` replaces the need for an external state container.

Instead of reducers, use event handlers.
Instead of action types, use string or regex event keys.

---

**Q: Is it fast?**

That's the wrong question. The real question is:

* Am I building realtime game engines or physics simulations?
* Am I building a high-frequency trading systems?
* Am I building custom instrumentation inside javascript runtimes / polyfills?
* Am I building benchmarks / microbenchmark libraries

If you answer yes to any of these, you might not even want to be using NodeJS. `ObserverEngine` is not designed to maximize ops/sec in microbenchmarks.

But here's the real-world tradeoff. I've done benchmarks between `EventEmitter`, `ObserverEngine`, and `EventTarget` since they are the most readily available event emitters in the JS ecosystem. They were simple, single event listeners and emitters. I attached 500 listeners to each and measured the number of events emitted per second.

```text
fastest: EventEmitter emits 651 ops/s
slowest: EventTarget emits 468 ops/s

diff:
    EventEmitter: +52 ops/s
    EventTarget: -131 ops/s

opsPerSecond:
    EventEmitter: 651 (325500 listeners called)
    ObserverEngine: 599 (299500 listeners called)
    EventTarget: 468 (234000 listeners called)

percent:
    EventEmitter: +10% (+/- 2%)
    EventTarget: -28% (+/- 2%)

```

You're trading ~10% emit speed for:

* First-class TypeScript
* Regex support
* Memory safety
* Debugging, validation, and inspection
* Better abstractions

It's not faster. It's more useful.

---

**Q: Can I extend or compose observers?**

Yes.

```ts
class MyService extends ObserverEngine<MyEvents> { ... }
```

You can also use delegation via `observer.observe(instance)`.

---

**Q: What about validation? Can I block bad payloads?**

Yes.

Use `emitValidator`:

```ts
new ObserverEngine({
  emitValidator: (event, data) => validate(event, data)
});
```

You can plug in Zod, Joi, custom checks, anything.

---

**Q: Is this stable?**

Yes.

Used in production systems. Battle-tested across Node, browser, React Native, and hybrid environments.

This was originally built out of the necessity of having a bridge between NodeJS, a React Native app, and React web app. I needed a single way to react to the same events in all three environments without writing the same code over and over.

No breaking changes planned without major semver.

---

## Explore More

* [Patterns & Use Cases](/docs/observer/core-patterns): queues, workflows, signals
* [Debugging & Internals](/docs/observer/debugging): spy, facts, leaks
* [Full TypeDoc API](https://typedoc.logosdx.dev/modules/_logosdx_observer.html)
