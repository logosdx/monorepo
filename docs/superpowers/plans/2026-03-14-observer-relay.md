# ObserverRelay Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `ObserverRelay`, an abstract class that bridges ObserverEngine events across network/process boundaries via two internal engines (pub and sub).

**Architecture:** Abstract class with one abstract method (`send`) and one protected concrete method (`receive`). The pub engine's `/.+/` catch-all forwards emissions to `send`. The subclass calls `receive` to feed inbound data into the sub engine. Consumer-facing API (`on`, `once`, `off`, `queue`, etc.) delegates to the sub engine with events wrapped as `{ data, ctx }` via a `RelayEvents` mapped type.

**Tech Stack:** TypeScript, `@logosdx/observer` (ObserverEngine), Vitest, Sinon

**Spec:** `docs/superpowers/specs/2026-03-14-observer-relay-design.md`

---

## Chunk 1: Foundation — Types, Test Harness, Core Flow

### Task 1: Types and Class Skeleton

**Files:**
- Create: `packages/observer/src/relay.ts`

- [ ] **Step 1: Write the `RelayEvents` type and `ObserverRelayOptions` interface**

```ts
import { ObserverEngine } from './engine.ts';

export type RelayEvents<TEvents extends Record<string, any>, TCtx extends object> = {
    [K in keyof TEvents]: { data: TEvents[K]; ctx: TCtx }
}

export interface ObserverRelayOptions {
    name?: string
    spy?: ObserverEngine.Spy<any>
    signal?: AbortSignal
    emitValidator?: {
        pub?: ObserverEngine.EmitValidator<any>
        sub?: ObserverEngine.EmitValidator<any>
    }
}
```

- [ ] **Step 2: Write the abstract class skeleton with constructor and internal engines**

In `packages/observer/src/relay.ts`, below the types:

```ts
import type { Events } from './types.ts';

export abstract class ObserverRelay<
    TEvents extends Record<string, any>,
    TCtx extends object
> {

    #pub: ObserverEngine<TEvents>
    #sub: ObserverEngine<RelayEvents<TEvents, TCtx>>
    #isShutdown = false

    constructor(options?: ObserverRelayOptions) {

        const name = options?.name

        this.#pub = new ObserverEngine<TEvents>({
            name: name ? `${name}:pub` : undefined,
            spy: options?.spy,
            signal: options?.signal,
            emitValidator: options?.emitValidator?.pub,
        })

        this.#sub = new ObserverEngine<RelayEvents<TEvents, TCtx>>({
            name: name ? `${name}:sub` : undefined,
            spy: options?.spy,
            signal: options?.signal,
            emitValidator: options?.emitValidator?.sub,
        })

        this.#pub.on(/.+/, ({ event, data }) => this.send(event as string, data))

        if (options?.signal) {

            options.signal.addEventListener('abort', () => {

                this.#isShutdown = true
            })
        }
    }

    protected abstract send(event: string, data: unknown): void

    protected receive(event: string, data: unknown, ctx: TCtx): void {

        if (this.#isShutdown) return
        this.#sub.emit(
            event as Events<RelayEvents<TEvents, TCtx>>,
            { data, ctx } as RelayEvents<TEvents, TCtx>[keyof TEvents]
        )
    }
}
```

- [ ] **Step 3: Verify the file compiles**

Run: `cd packages/observer && npx tsc --noEmit`
Expected: No errors (the class is abstract, no instantiation needed)

- [ ] **Step 4: Commit**

```bash
git add packages/observer/src/relay.ts
git commit -m "feat(observer): add ObserverRelay skeleton with types"
```

---

### Task 2: Test Harness — TestRelay Subclass

**Files:**
- Create: `tests/src/observable/relay.ts`

- [ ] **Step 1: Create the test file with a concrete `TestRelay` subclass and test event/context types**

```ts
import { describe, it, afterEach, expect } from 'vitest'

import { ObserverRelay } from '@logosdx/observer';

import { sandbox } from '../_helpers.ts';

interface TestEvents {
    'msg:hello': { greeting: string }
    'msg:goodbye': { farewell: string }
}

interface TestCtx {
    ack(): void
    nack(): void
}

class TestRelay extends ObserverRelay<TestEvents, TestCtx> {

    sent: Array<{ event: string; data: unknown }> = []

    protected send(event: string, data: unknown): void {

        this.sent.push({ event, data })
    }

    // Expose receive for testing
    ingest(event: string, data: unknown, ctx: TestCtx): void {

        this.receive(event, data, ctx)
    }
}

const makeCtx = (): TestCtx => ({
    ack: sandbox.stub(),
    nack: sandbox.stub(),
})

describe('@logosdx/observer', function () {

    describe('ObserverRelay', function () {

        afterEach(() => {

            sandbox.resetHistory();
        });

        it('should be extendable with send and receive', function () {

            const relay = new TestRelay({ name: 'test' });

            expect(relay).to.be.instanceOf(ObserverRelay);
        });
    });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd tests && pnpm test relay`
Expected: PASS — 1 test passes

- [ ] **Step 3: Commit**

```bash
git add tests/src/observable/relay.ts
git commit -m "test(observer): add ObserverRelay test harness with TestRelay"
```

---

### Task 3: Outbound Flow — emit → send

**Files:**
- Modify: `tests/src/observable/relay.ts`
- Modify: `packages/observer/src/relay.ts`

- [ ] **Step 1: Write failing tests for emit → send flow**

Add to the `ObserverRelay` describe block in `tests/src/observable/relay.ts`:

```ts
        describe('emit → send', function () {

            it('should call send when emit is called', function () {

                const relay = new TestRelay({ name: 'test' });

                relay.emit('msg:hello', { greeting: 'hi' });

                expect(relay.sent.length).to.eq(1);
                expect(relay.sent[0].event).to.eq('msg:hello');
                expect(relay.sent[0].data).to.deep.eq({ greeting: 'hi' });
            });

            it('should call send for each emission', function () {

                const relay = new TestRelay({ name: 'test' });

                relay.emit('msg:hello', { greeting: 'hi' });
                relay.emit('msg:goodbye', { farewell: 'bye' });

                expect(relay.sent.length).to.eq(2);
                expect(relay.sent[1].event).to.eq('msg:goodbye');
            });
        });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tests && pnpm test relay`
Expected: FAIL — `relay.emit is not a function` (emit not yet exposed)

- [ ] **Step 3: Add the `emit` property to `ObserverRelay`**

In `packages/observer/src/relay.ts`, add a typed class property and assign in the constructor. We wrap the bound emit with a shutdown guard:

Add class property:

```ts
    emit: ObserverEngine<TEvents>['emit']
```

Add to the constructor (after the `.bind()` calls for on/once/off):

```ts
    const pubEmit = this.#pub.emit.bind(this.#pub)

    this.emit = ((...args: any[]) => {

        if (this.#isShutdown) return
        pubEmit(...args)
    }) as ObserverEngine<TEvents>['emit']
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tests && pnpm test relay`
Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/observer/src/relay.ts tests/src/observable/relay.ts
git commit -m "feat(observer): add emit → send outbound flow"
```

---

### Task 4: Inbound Flow — receive → on

**Files:**
- Modify: `tests/src/observable/relay.ts`
- Modify: `packages/observer/src/relay.ts`

- [ ] **Step 1: Write failing tests for receive → on flow**

Add to the `ObserverRelay` describe block:

```ts
        describe('receive → on', function () {

            it('should deliver { data, ctx } to subscribers', function () {

                const relay = new TestRelay({ name: 'test' });
                const fake = sandbox.stub();
                const ctx = makeCtx();

                relay.on('msg:hello', fake);
                relay.ingest('msg:hello', { greeting: 'hi' }, ctx);

                expect(fake.callCount).to.eq(1);

                const { args: [received] } = fake.getCall(0);

                expect(received.data).to.deep.eq({ greeting: 'hi' });
                expect(received.ctx).to.eq(ctx);
            });

            it('should support multiple listeners on the same event', function () {

                const relay = new TestRelay({ name: 'test' });
                const fake1 = sandbox.stub();
                const fake2 = sandbox.stub();
                const ctx = makeCtx();

                relay.on('msg:hello', fake1);
                relay.on('msg:hello', fake2);
                relay.ingest('msg:hello', { greeting: 'hi' }, ctx);

                expect(fake1.callCount).to.eq(1);
                expect(fake2.callCount).to.eq(1);
            });

            it('should return a cleanup function from on', function () {

                const relay = new TestRelay({ name: 'test' });
                const fake = sandbox.stub();
                const ctx = makeCtx();

                const cleanup = relay.on('msg:hello', fake);

                cleanup();
                relay.ingest('msg:hello', { greeting: 'hi' }, ctx);

                expect(fake.callCount).to.eq(0);
            });
        });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tests && pnpm test relay`
Expected: FAIL — `relay.on is not a function`

- [ ] **Step 3: Add `on`, `once`, `off` delegations to `ObserverRelay`**

In `packages/observer/src/relay.ts`, use typed property declarations with `.bind()` in the constructor. This approach preserves all overload signatures from ObserverEngine (8 overloads for `on`, 6 for `once`, etc.). Using `Parameters<>` would collapse overloads into a single union, breaking type inference.

Add class properties:

```ts
    on: ObserverEngine<RelayEvents<TEvents, TCtx>>['on']
    once: ObserverEngine<RelayEvents<TEvents, TCtx>>['once']
    off: ObserverEngine<RelayEvents<TEvents, TCtx>>['off']
```

Add to the constructor (after engine initialization, before the catch-all):

```ts
    this.on = this.#sub.on.bind(this.#sub)
    this.once = this.#sub.once.bind(this.#sub)
    this.off = this.#sub.off.bind(this.#sub)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tests && pnpm test relay`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/observer/src/relay.ts tests/src/observable/relay.ts
git commit -m "feat(observer): add receive → on inbound flow with on/once/off"
```

---

## Chunk 2: Full API Surface

### Task 5: once and off Behavior

**Files:**
- Modify: `tests/src/observable/relay.ts`

- [ ] **Step 1: Write tests for `once` and `off`**

Add to the `ObserverRelay` describe block:

```ts
        describe('once', function () {

            it('should resolve with { data, ctx } and fire only once', async function () {

                const relay = new TestRelay({ name: 'test' });
                const ctx = makeCtx();

                const promise = relay.once('msg:hello');
                relay.ingest('msg:hello', { greeting: 'hi' }, ctx);

                const result = await promise;

                expect(result.data).to.deep.eq({ greeting: 'hi' });
                expect(result.ctx).to.eq(ctx);
            });

            it('should call callback only once', function () {

                const relay = new TestRelay({ name: 'test' });
                const fake = sandbox.stub();
                const ctx = makeCtx();

                relay.once('msg:hello', fake);
                relay.ingest('msg:hello', { greeting: 'hi' }, ctx);
                relay.ingest('msg:hello', { greeting: 'hi again' }, ctx);

                expect(fake.callCount).to.eq(1);
            });
        });

        describe('off', function () {

            it('should remove a specific listener', function () {

                const relay = new TestRelay({ name: 'test' });
                const fake = sandbox.stub();
                const ctx = makeCtx();

                relay.on('msg:hello', fake);
                relay.off('msg:hello', fake);
                relay.ingest('msg:hello', { greeting: 'hi' }, ctx);

                expect(fake.callCount).to.eq(0);
            });
        });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd tests && pnpm test relay`
Expected: PASS — once/off already implemented in Task 4

- [ ] **Step 3: Commit**

```bash
git add tests/src/observable/relay.ts
git commit -m "test(observer): add once and off behavior tests for ObserverRelay"
```

---

### Task 6: Regex Listeners

**Files:**
- Modify: `tests/src/observable/relay.ts`

- [ ] **Step 1: Write tests for regex listener nesting**

```ts
        describe('regex listeners', function () {

            it('should receive nested { event, data: { data, ctx } }', function () {

                const relay = new TestRelay({ name: 'test' });
                const fake = sandbox.stub();
                const ctx = makeCtx();

                relay.on(/^msg:/, fake);
                relay.ingest('msg:hello', { greeting: 'hi' }, ctx);

                expect(fake.callCount).to.eq(1);

                const { args: [received] } = fake.getCall(0);

                expect(received.event).to.eq('msg:hello');
                expect(received.data.data).to.deep.eq({ greeting: 'hi' });
                expect(received.data.ctx).to.eq(ctx);
            });

            it('should match multiple events with regex', function () {

                const relay = new TestRelay({ name: 'test' });
                const fake = sandbox.stub();
                const ctx = makeCtx();

                relay.on(/^msg:/, fake);
                relay.ingest('msg:hello', { greeting: 'hi' }, ctx);
                relay.ingest('msg:goodbye', { farewell: 'bye' }, ctx);

                expect(fake.callCount).to.eq(2);
            });
        });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd tests && pnpm test relay`
Expected: PASS — regex listeners work via sub engine delegation

- [ ] **Step 3: Commit**

```bash
git add tests/src/observable/relay.ts
git commit -m "test(observer): add regex listener tests for ObserverRelay"
```

---

### Task 7: Queue Delegation

**Files:**
- Modify: `tests/src/observable/relay.ts`
- Modify: `packages/observer/src/relay.ts`

- [ ] **Step 1: Write failing test for queue delegation**

```ts
        describe('queue', function () {

            it('should process inbound messages through the queue', async function () {

                const relay = new TestRelay({ name: 'test' });
                const processed: Array<{ data: TestEvents['msg:hello']; ctx: TestCtx }> = [];
                const ctx = makeCtx();

                const queue = relay.queue('msg:hello', (item) => {

                    processed.push(item);
                }, {
                    name: 'test-queue',
                    concurrency: 1,
                });

                relay.ingest('msg:hello', { greeting: 'hi' }, ctx);

                // Give queue time to process
                await new Promise(r => setTimeout(r, 300));

                expect(processed.length).to.eq(1);
                expect(processed[0].data).to.deep.eq({ greeting: 'hi' });
                expect(processed[0].ctx).to.eq(ctx);

                queue.shutdown(true);
            });
        });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tests && pnpm test relay`
Expected: FAIL — `relay.queue is not a function`

- [ ] **Step 3: Add `queue` delegation to `ObserverRelay`**

In `packages/observer/src/relay.ts`, add a typed class property:

```ts
    queue: ObserverEngine<RelayEvents<TEvents, TCtx>>['queue']
```

Add to the constructor (alongside other `.bind()` calls):

```ts
    this.queue = this.#sub.queue.bind(this.#sub)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tests && pnpm test relay`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/observer/src/relay.ts tests/src/observable/relay.ts
git commit -m "feat(observer): add queue delegation to ObserverRelay"
```

---

### Task 8: Constructor Options — Name, Spy, Signal

**Files:**
- Modify: `tests/src/observable/relay.ts`

- [ ] **Step 1: Write tests for constructor options**

```ts
        describe('constructor options', function () {

            it('should suffix engine names with :pub and :sub', function () {

                const relay = new TestRelay({ name: 'redis' });
                const internals = relay.$internals();

                expect(internals.pub.name).to.eq('redis:pub');
                expect(internals.sub.name).to.eq('redis:sub');
            });

            it('should pass spy to both engines', function () {

                const spyFn = sandbox.stub();
                const relay = new TestRelay({ name: 'test', spy: spyFn });
                const ctx = makeCtx();

                relay.emit('msg:hello', { greeting: 'hi' });
                relay.ingest('msg:hello', { greeting: 'hi' }, ctx);

                // Spy should be called for both pub and sub operations
                const pubCalls = spyFn.getCalls().filter(
                    (c: any) => c.args[0]?.context?.name === 'test:pub'
                );
                const subCalls = spyFn.getCalls().filter(
                    (c: any) => c.args[0]?.context?.name === 'test:sub'
                );

                expect(pubCalls.length).to.be.greaterThan(0);
                expect(subCalls.length).to.be.greaterThan(0);
            });

            it('should shut down when signal is aborted', function () {

                const controller = new AbortController();
                const relay = new TestRelay({ name: 'test', signal: controller.signal });

                controller.abort();

                expect(relay.isShutdown).to.eq(true);
            });
        });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tests && pnpm test relay`
Expected: FAIL — `relay.$internals is not a function`, `relay.isShutdown is not a property`

These will be implemented in Tasks 9 and 10.

- [ ] **Step 3: Mark all three tests with `.skip`**

Use `it.skip(...)` on all three tests. Tasks 9 and 10 will implement the missing methods, and Task 9 Step 5 will remove the `.skip`.

---

### Task 9: Observability — spy(), $has(), $facts(), $internals()

**Files:**
- Modify: `packages/observer/src/relay.ts`
- Modify: `tests/src/observable/relay.ts`

- [ ] **Step 1: Write tests for observability methods**

```ts
        describe('observability', function () {

            it('should spy on both engines via spy()', function () {

                const relay = new TestRelay({ name: 'test' });
                const spyFn = sandbox.stub();
                const ctx = makeCtx();

                relay.spy(spyFn);
                relay.emit('msg:hello', { greeting: 'hi' });
                relay.ingest('msg:hello', { greeting: 'hi' }, ctx);

                expect(spyFn.callCount).to.be.greaterThan(0);
            });

            it('should return { pub, sub } from $has()', function () {

                const relay = new TestRelay({ name: 'test' });
                const fake = sandbox.stub();

                relay.on('msg:hello', fake);

                const result = relay.$has('msg:hello' as any);

                expect(result).to.deep.eq({ pub: false, sub: true });
            });

            it('should return { pub, sub } from $facts()', function () {

                const relay = new TestRelay({ name: 'test' });

                const facts = relay.$facts();

                expect(facts).to.have.property('pub');
                expect(facts).to.have.property('sub');
                expect(facts.pub).to.have.property('listeners');
                expect(facts.sub).to.have.property('listeners');
            });

            it('should return { pub, sub } from $internals()', function () {

                const relay = new TestRelay({ name: 'test' });

                const internals = relay.$internals();

                expect(internals).to.have.property('pub');
                expect(internals).to.have.property('sub');
                expect(internals.pub).to.have.property('name');
                expect(internals.sub).to.have.property('name');
            });
        });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tests && pnpm test relay`
Expected: FAIL — methods not yet defined

- [ ] **Step 3: Implement observability methods**

In `packages/observer/src/relay.ts`, add to the class:

```ts
    spy(spy: ObserverEngine.Spy<any>): void {

        if (this.#isShutdown) return

        this.#pub.spy(spy, true)
        this.#sub.spy(spy, true)
    }

    $has(event: string | RegExp) {

        return {
            pub: this.#pub.$has(event as any),
            sub: this.#sub.$has(event as any),
        }
    }

    $facts() {

        return {
            pub: this.#pub.$facts(),
            sub: this.#sub.$facts(),
        }
    }

    $internals() {

        return {
            pub: this.#pub.$internals(),
            sub: this.#sub.$internals(),
        }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tests && pnpm test relay`
Expected: PASS

- [ ] **Step 5: Remove any `.skip` from Task 8 constructor tests and re-run**

Run: `cd tests && pnpm test relay`
Expected: PASS — all constructor option tests now pass too

- [ ] **Step 6: Commit**

```bash
git add packages/observer/src/relay.ts tests/src/observable/relay.ts
git commit -m "feat(observer): add observability methods to ObserverRelay"
```

---

### Task 10: Shutdown Lifecycle

**Files:**
- Modify: `packages/observer/src/relay.ts`
- Modify: `tests/src/observable/relay.ts`

- [ ] **Step 1: Write tests for shutdown behavior**

```ts
        describe('shutdown', function () {

            it('should set isShutdown to true', function () {

                const relay = new TestRelay({ name: 'test' });

                expect(relay.isShutdown).to.eq(false);

                relay.shutdown();

                expect(relay.isShutdown).to.eq(true);
            });

            it('should ignore emit after shutdown', function () {

                const relay = new TestRelay({ name: 'test' });

                relay.shutdown();
                relay.emit('msg:hello', { greeting: 'hi' });

                expect(relay.sent.length).to.eq(0);
            });

            it('should ignore receive after shutdown', function () {

                const relay = new TestRelay({ name: 'test' });
                const fake = sandbox.stub();
                const ctx = makeCtx();

                relay.on('msg:hello', fake);
                relay.shutdown();
                relay.ingest('msg:hello', { greeting: 'hi' }, ctx);

                expect(fake.callCount).to.eq(0);
            });

            it('should be idempotent', function () {

                const relay = new TestRelay({ name: 'test' });

                relay.shutdown();
                relay.shutdown();

                expect(relay.isShutdown).to.eq(true);
            });

            it('should clear both engines', function () {

                const relay = new TestRelay({ name: 'test' });
                const fake = sandbox.stub();

                relay.on('msg:hello', fake);
                relay.emit('msg:hello', { greeting: 'hi' });

                expect(relay.sent.length).to.eq(1);

                relay.shutdown();

                const facts = relay.$facts();

                expect(facts.pub.listeners.length).to.eq(0);
                expect(facts.pub.rgxListeners.length).to.eq(0);
                expect(facts.sub.listeners.length).to.eq(0);
            });

            it('should return { pub: false, sub: false } from $has after shutdown', function () {

                const relay = new TestRelay({ name: 'test' });

                relay.on('msg:hello', sandbox.stub());
                relay.shutdown();

                const result = relay.$has('msg:hello' as any);

                expect(result).to.deep.eq({ pub: false, sub: false });
            });

            it('should silently ignore spy() after shutdown', function () {

                const relay = new TestRelay({ name: 'test' });

                relay.shutdown();

                // Should not throw
                relay.spy(sandbox.stub());
            });
        });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tests && pnpm test relay`
Expected: FAIL — `relay.isShutdown` and `relay.shutdown` not defined

- [ ] **Step 3: Implement `shutdown()` and `isShutdown`**

In `packages/observer/src/relay.ts`, add to the class:

```ts
    get isShutdown(): boolean {

        return this.#isShutdown
    }

    shutdown(): void {

        if (this.#isShutdown) return

        this.#isShutdown = true
        this.#pub.clear()
        this.#sub.clear()
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tests && pnpm test relay`
Expected: PASS — all shutdown tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/observer/src/relay.ts tests/src/observable/relay.ts
git commit -m "feat(observer): add shutdown lifecycle to ObserverRelay"
```

---

## Chunk 3: Integration and Export

### Task 11: emitValidator — Pub and Sub Validation

**Files:**
- Modify: `tests/src/observable/relay.ts`

- [ ] **Step 1: Write tests for emitValidator on both sides**

```ts
        describe('emitValidator', function () {

            it('should validate outbound emissions via pub validator', function () {

                const pubValidator = sandbox.stub();
                const relay = new TestRelay({
                    name: 'test',
                    emitValidator: { pub: pubValidator },
                });

                relay.emit('msg:hello', { greeting: 'hi' });

                expect(pubValidator.callCount).to.be.greaterThan(0);
            });

            it('should validate inbound data via sub validator', function () {

                const subValidator = sandbox.stub();
                const relay = new TestRelay({
                    name: 'test',
                    emitValidator: { sub: subValidator },
                });

                const ctx = makeCtx();

                relay.ingest('msg:hello', { greeting: 'hi' }, ctx);

                expect(subValidator.callCount).to.be.greaterThan(0);
            });

            it('should throw from pub validator when outbound data is invalid', function () {

                const relay = new TestRelay({
                    name: 'test',
                    emitValidator: {
                        pub: () => { throw new Error('invalid outbound') },
                    },
                });

                expect(() => relay.emit('msg:hello', { greeting: 'hi' }))
                    .to.throw('invalid outbound');
            });

            it('should throw from sub validator when inbound data is invalid', function () {

                const relay = new TestRelay({
                    name: 'test',
                    emitValidator: {
                        sub: () => { throw new Error('invalid inbound') },
                    },
                });

                const ctx = makeCtx();

                expect(() => relay.ingest('msg:hello', { greeting: 'hi' }, ctx))
                    .to.throw('invalid inbound');
            });
        });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd tests && pnpm test relay`
Expected: PASS — emitValidator is already wired via constructor options in Task 1

- [ ] **Step 3: Commit**

```bash
git add tests/src/observable/relay.ts
git commit -m "test(observer): add emitValidator tests for ObserverRelay"
```

---

### Task 12: Export from Package

**Files:**
- Modify: `packages/observer/src/index.ts`

- [ ] **Step 1: Add ObserverRelay and RelayEvents to the barrel export**

Add to `packages/observer/src/index.ts`:

```ts
export {
    ObserverRelay,
    type RelayEvents,
    type ObserverRelayOptions,
} from './relay.ts';
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd packages/observer && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run the full test suite to verify no regressions**

Run: `cd tests && pnpm test`
Expected: All tests pass, including the new relay tests

- [ ] **Step 4: Commit**

```bash
git add packages/observer/src/index.ts
git commit -m "feat(observer): export ObserverRelay from @logosdx/observer"
```

---

### Task 13: Full Integration Test

**Files:**
- Modify: `tests/src/observable/relay.ts`

- [ ] **Step 1: Write an end-to-end integration test simulating a real transport**

```ts
        describe('integration: full relay flow', function () {

            it('should simulate a complete pub/sub cycle', async function () {

                // Simulate an in-memory transport
                const bus: Array<{ event: string; data: unknown }> = [];

                class MemoryRelay extends ObserverRelay<TestEvents, TestCtx> {

                    protected send(event: string, data: unknown): void {

                        bus.push({ event, data });
                    }

                    drain(ctx: TestCtx) {

                        while (bus.length > 0) {

                            const msg = bus.shift()!;
                            this.receive(msg.event, msg.data, ctx);
                        }
                    }
                }

                const relay = new MemoryRelay({ name: 'memory' });
                const received: Array<{ data: TestEvents['msg:hello']; ctx: TestCtx }> = [];

                relay.on('msg:hello', (payload) => {

                    received.push(payload);
                });

                // Emit outbound
                relay.emit('msg:hello', { greeting: 'hello world' });

                expect(bus.length).to.eq(1);
                expect(received.length).to.eq(0);

                // Drain inbound
                const ctx = makeCtx();

                relay.drain(ctx);

                expect(bus.length).to.eq(0);
                expect(received.length).to.eq(1);
                expect(received[0].data).to.deep.eq({ greeting: 'hello world' });
                expect(received[0].ctx).to.eq(ctx);

                // Shutdown
                relay.shutdown();

                relay.emit('msg:hello', { greeting: 'should be ignored' });

                expect(bus.length).to.eq(0);
                expect(relay.isShutdown).to.eq(true);
            });
        });
```

- [ ] **Step 2: Run the test**

Run: `cd tests && pnpm test relay`
Expected: PASS

- [ ] **Step 3: Run the full test suite one final time**

Run: `cd tests && pnpm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add tests/src/observable/relay.ts
git commit -m "test(observer): add full integration test for ObserverRelay"
```

---

### Task 14: Documentation Updates

**Files:**
- Modify: `skills/logosdx/references/observer.md` (if it exists)
- Modify: `docs/packages/observer.md` (if it exists)

- [ ] **Step 1: Check which documentation files exist and update them**

Add ObserverRelay to the observer package documentation:
- Brief description of the class and its purpose
- Link to the design spec for detailed architecture
- Code example showing a basic subclass implementation

- [ ] **Step 2: Commit**

```bash
git add docs/ skills/
git commit -m "docs(observer): add ObserverRelay to package documentation"
```
