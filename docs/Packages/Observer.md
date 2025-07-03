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

## 📘 Full Guides

* [Concepts & Patterns](/docs/observer/core-patterns)
* [Debugging Tools](/docs/observer/debugging)
* [API Reference](https://typedoc.logosdx.dev/modules/_logosdx_observer.html)

---

## 🔥 Why It's Better

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
gen.destroy();

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

---

## 🧠 Conceptual Comparison

| Feature                   | EventEmitter | RxJS | `@logosdx/observer` |
| ------------------------- | ------------ | ---- | ------------------- |
| Works everywhere          | ❌            | ✅    | ✅                   |
| Full TypeScript support   | ⚠️           | ✅    | ✅                   |
| Regex-based subscriptions | ❌            | ❌    | ✅                   |
| Promises for events       | ❌            | ⚠️   | ✅                   |
| Async generators          | ❌            | ✅    | ✅                   |
| Built-in validation       | ❌            | ⚠️   | ✅                   |
| Manual memory management  | ✅            | ⚠️   | ❌ (auto-cleanup)    |

---

## 📚 Explore More

* [Patterns & Use Cases](/docs/observer/core-patterns): queues, workflows, signals
* [Debugging & Internals](/docs/observer/debugging): spy, facts, leaks
* [Full TypeDoc API](https://typedoc.logosdx.dev/modules/_logosdx_observer.html)
