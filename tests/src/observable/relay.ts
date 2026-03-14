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

        describe('emit → send', function () {

            it('should call send when emit is called', function () {

                const relay = new TestRelay({ name: 'test' });

                relay.emit('msg:hello', { greeting: 'hi' });

                expect(relay.sent.length).to.eq(1);
                expect(relay.sent[0]!.event).to.eq('msg:hello');
                expect(relay.sent[0]!.data).to.deep.eq({ greeting: 'hi' });
            });

            it('should call send for each emission', function () {

                const relay = new TestRelay({ name: 'test' });

                relay.emit('msg:hello', { greeting: 'hi' });
                relay.emit('msg:goodbye', { farewell: 'bye' });

                expect(relay.sent.length).to.eq(2);
                expect(relay.sent[1]!.event).to.eq('msg:goodbye');
            });
        });

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
                expect(processed[0]!.data).to.deep.eq({ greeting: 'hi' });
                expect(processed[0]!.ctx).to.eq(ctx);

                queue.shutdown(true);
            });
        });

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
                expect(received[0]!.data).to.deep.eq({ greeting: 'hello world' });
                expect(received[0]!.ctx).to.eq(ctx);

                // Shutdown
                relay.shutdown();

                relay.emit('msg:hello', { greeting: 'should be ignored' });

                expect(bus.length).to.eq(0);
                expect(relay.isShutdown).to.eq(true);
            });
        });
    });
});
