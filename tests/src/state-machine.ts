import { describe, it, expect, vi, beforeEach } from 'vitest';

import { StateMachine, StateHub } from '../../packages/state-machine/src/index.ts';
import type { StorageAdapter } from '../../packages/state-machine/src/index.ts';


// --- Helpers ---

interface CounterContext {
    count: number
    error: string | null
}

interface CounterEvents {
    INCREMENT: void
    DECREMENT: void
    SET: { value: number }
    RESET: void
    FAIL: { message: string }
    RETRY: void
    FETCH: void
    SUCCESS: { value: number }
    FAILURE: { message: string }
}

function makeCounterMachine() {

    return new StateMachine<CounterContext, CounterEvents>({
        initial: 'idle',
        context: { count: 0, error: null },
        transitions: {
            idle: {
                on: {
                    INCREMENT: {
                        target: 'idle',
                        action: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
                    },
                    DECREMENT: {
                        target: 'idle',
                        action: (ctx) => ({ ...ctx, count: ctx.count - 1 }),
                    },
                    SET: {
                        target: 'idle',
                        action: (ctx, data) => ({ ...ctx, count: data.value }),
                    },
                    RESET: {
                        target: 'idle',
                        action: () => ({ count: 0, error: null }),
                    },
                    FAIL: {
                        target: 'error',
                        action: (ctx, data) => ({ ...ctx, error: data.message }),
                    },
                    FETCH: 'loading',
                },
            },
            loading: {
                on: {
                    SUCCESS: {
                        target: 'idle',
                        action: (ctx, data) => ({ ...ctx, count: data.value }),
                    },
                    FAILURE: {
                        target: 'error',
                        action: (ctx, data) => ({ ...ctx, error: data.message }),
                    },
                },
            },
            error: {
                on: {
                    RETRY: 'loading',
                    RESET: {
                        target: 'idle',
                        action: () => ({ count: 0, error: null }),
                    },
                },
            },
        },
    });
}


describe('@logosdx/state-machine', () => {

    describe('StateMachine: construction', () => {

        it('creates a machine with initial state and context', () => {

            const machine = makeCounterMachine();

            expect(machine.state).to.equal('idle');
            expect(machine.context).to.deep.equal({ count: 0, error: null });
        });

        it('context is cloned — mutations do not affect internal state', () => {

            const machine = makeCounterMachine();
            const ctx = machine.context;

            ctx.count = 999;

            expect(machine.context.count).to.equal(0);
        });

        it('throws on missing config', () => {

            expect(() => new StateMachine(null as any)).to.throw();
        });

        it('throws on invalid initial state', () => {

            expect(() => new StateMachine({
                initial: 'nonexistent',
                context: {},
                transitions: { idle: {} },
            } as any)).to.throw(/does not exist/);
        });

        it('throws when transition target references a nonexistent state', () => {

            expect(() => new StateMachine({
                initial: 'idle',
                context: {},
                transitions: {
                    idle: {
                        on: { GO: 'nowhere' },
                    },
                },
            } as any)).to.throw(/does not exist/);
        });

        it('throws when a final state has transitions', () => {

            expect(() => new StateMachine({
                initial: 'idle',
                context: {},
                transitions: {
                    idle: { on: { DONE: 'end' } },
                    end: { final: true, on: { BACK: 'idle' } },
                },
            } as any)).to.throw(/Final state/);
        });
    });


    describe('StateMachine: send', () => {

        it('transitions to a new state via string shorthand', () => {

            const machine = makeCounterMachine();

            machine.send('FETCH');

            expect(machine.state).to.equal('loading');
        });

        it('transitions with action that modifies context', () => {

            const machine = makeCounterMachine();

            machine.send('INCREMENT');

            expect(machine.state).to.equal('idle');
            expect(machine.context.count).to.equal(1);
        });

        it('passes typed data to action', () => {

            const machine = makeCounterMachine();

            machine.send('SET', { value: 42 });

            expect(machine.context.count).to.equal(42);
        });

        it('chains multiple transitions', () => {

            const machine = makeCounterMachine();

            machine.send('INCREMENT');
            machine.send('INCREMENT');
            machine.send('INCREMENT');

            expect(machine.context.count).to.equal(3);
        });

        it('transitions through multiple states', () => {

            const machine = makeCounterMachine();

            machine.send('FETCH');
            expect(machine.state).to.equal('loading');

            machine.send('FAILURE', { message: 'Network error' });
            expect(machine.state).to.equal('error');
            expect(machine.context.error).to.equal('Network error');

            machine.send('RETRY');
            expect(machine.state).to.equal('loading');

            machine.send('SUCCESS', { value: 10 });
            expect(machine.state).to.equal('idle');
            expect(machine.context.count).to.equal(10);
        });
    });


    describe('StateMachine: rejected transitions', () => {

        it('ignores events not valid for the current state', () => {

            const machine = makeCounterMachine();

            machine.send('RETRY');

            expect(machine.state).to.equal('idle');
        });

        it('emits $rejected with no_transition reason', () => {

            const machine = makeCounterMachine();
            const rejected = vi.fn();

            machine.on('$rejected', rejected);
            machine.send('RETRY');

            expect(rejected).toHaveBeenCalledOnce();
            expect(rejected.mock.calls[0][0]).to.deep.include({
                state: 'idle',
                event: 'RETRY',
                reason: 'no_transition',
            });
        });

        it('emits $rejected with guard_failed reason', () => {

            const machine = new StateMachine<{ count: number }, { INCREMENT: void }>({
                initial: 'idle',
                context: { count: 0 },
                transitions: {
                    idle: {
                        on: {
                            INCREMENT: {
                                target: 'idle',
                                action: (ctx) => ({ count: ctx.count + 1 }),
                                guard: (ctx) => ctx.count < 3,
                            },
                        },
                    },
                },
            });

            machine.send('INCREMENT');
            machine.send('INCREMENT');
            machine.send('INCREMENT');

            const rejected = vi.fn();

            machine.on('$rejected', rejected);
            machine.send('INCREMENT');

            expect(machine.context.count).to.equal(3);
            expect(rejected).toHaveBeenCalledOnce();
            expect(rejected.mock.calls[0][0].reason).to.equal('guard_failed');
        });
    });


    describe('StateMachine: guards', () => {

        it('prevents transition when guard returns false', () => {

            const machine = new StateMachine<{ count: number }, { INCREMENT: void }>({
                initial: 'idle',
                context: { count: 5 },
                transitions: {
                    idle: {
                        on: {
                            INCREMENT: {
                                target: 'idle',
                                action: (ctx) => ({ count: ctx.count + 1 }),
                                guard: (ctx) => ctx.count < 5,
                            },
                        },
                    },
                },
            });

            machine.send('INCREMENT');

            expect(machine.context.count).to.equal(5);
        });

        it('allows transition when guard returns true', () => {

            const machine = new StateMachine<{ count: number }, { INCREMENT: void }>({
                initial: 'idle',
                context: { count: 3 },
                transitions: {
                    idle: {
                        on: {
                            INCREMENT: {
                                target: 'idle',
                                action: (ctx) => ({ count: ctx.count + 1 }),
                                guard: (ctx) => ctx.count < 5,
                            },
                        },
                    },
                },
            });

            machine.send('INCREMENT');

            expect(machine.context.count).to.equal(4);
        });

        it('receives event data in guard', () => {

            const guardFn = vi.fn(() => true);

            const machine = new StateMachine<{}, { GO: { target: string } }>({
                initial: 'a',
                context: {},
                transitions: {
                    a: {
                        on: {
                            GO: {
                                target: 'a',
                                guard: guardFn,
                            },
                        },
                    },
                },
            });

            machine.send('GO', { target: 'test' });

            expect(guardFn).toHaveBeenCalledWith({}, { target: 'test' });
        });
    });


    describe('StateMachine: on / off', () => {

        it('listens for a specific state entry', () => {

            const machine = makeCounterMachine();
            const listener = vi.fn();

            machine.on('loading', listener);
            machine.send('FETCH');

            expect(listener).toHaveBeenCalledOnce();
            expect(listener.mock.calls[0][0]).to.deep.include({
                from: 'idle',
                to: 'loading',
                event: 'FETCH',
            });
        });

        it('wildcard * catches all transitions', () => {

            const machine = makeCounterMachine();
            const listener = vi.fn();

            machine.on('*', listener);
            machine.send('INCREMENT');
            machine.send('INCREMENT');

            expect(listener).toHaveBeenCalledTimes(2);
        });

        it('regex pattern matching works', () => {

            const machine = makeCounterMachine();
            const listener = vi.fn();

            machine.on(/error|loading/, listener);

            machine.send('FETCH');
            machine.send('FAILURE', { message: 'oops' });

            expect(listener).toHaveBeenCalledTimes(2);
        });

        it('on returns a cleanup function', () => {

            const machine = makeCounterMachine();
            const listener = vi.fn();

            const cleanup = machine.on('idle', listener);

            machine.send('INCREMENT');
            expect(listener).toHaveBeenCalledOnce();

            cleanup();
            machine.send('INCREMENT');
            expect(listener).toHaveBeenCalledOnce();
        });

        it('off removes a listener', () => {

            const machine = makeCounterMachine();
            const listener = vi.fn();

            machine.on('idle', listener);
            machine.send('INCREMENT');
            expect(listener).toHaveBeenCalledOnce();

            machine.off('idle', listener);
            machine.send('INCREMENT');
            expect(listener).toHaveBeenCalledOnce();
        });
    });


    describe('StateMachine: invoke', () => {

        it('runs async src on entering a state with invoke', async () => {

            const machine = new StateMachine<
                { data: string | null, error: string | null },
                { FETCH: void }
            >({
                initial: 'idle',
                context: { data: null, error: null },
                transitions: {
                    idle: {
                        on: { FETCH: 'loading' },
                    },
                    loading: {
                        invoke: {
                            src: async () => 'hello',
                            onDone: {
                                target: 'idle',
                                action: (ctx, result) => ({ ...ctx, data: result }),
                            },
                            onError: {
                                target: 'error',
                                action: (ctx, err) => ({ ...ctx, error: err.message }),
                            },
                        },
                    },
                    error: {},
                },
            });

            machine.send('FETCH');
            expect(machine.state).to.equal('loading');

            await vi.waitFor(() => {

                expect(machine.state).to.equal('idle');
            });

            expect(machine.context.data).to.equal('hello');
        });

        it('transitions to error state on rejection', async () => {

            const machine = new StateMachine<
                { error: string | null },
                { FETCH: void }
            >({
                initial: 'idle',
                context: { error: null },
                transitions: {
                    idle: {
                        on: { FETCH: 'loading' },
                    },
                    loading: {
                        invoke: {
                            src: async () => { throw new Error('boom'); },
                            onDone: { target: 'idle' },
                            onError: {
                                target: 'error',
                                action: (ctx, err) => ({ ...ctx, error: err.message }),
                            },
                        },
                    },
                    error: {},
                },
            });

            machine.send('FETCH');

            await vi.waitFor(() => {

                expect(machine.state).to.equal('error');
            });

            expect(machine.context.error).to.equal('boom');
        });

        it('cancels stale invoke when state changes before settling', async () => {

            let resolvePromise: (val: string) => void;

            const machine = new StateMachine<
                { data: string | null },
                { FETCH: void, CANCEL: void }
            >({
                initial: 'idle',
                context: { data: null },
                transitions: {
                    idle: {
                        on: { FETCH: 'loading' },
                    },
                    loading: {
                        on: { CANCEL: 'idle' },
                        invoke: {
                            src: () => new Promise((r) => { resolvePromise = r; }),
                            onDone: {
                                target: 'idle',
                                action: (ctx, result) => ({ ...ctx, data: result }),
                            },
                            onError: { target: 'error' },
                        },
                    },
                    error: {},
                },
            });

            const cancelledListener = vi.fn();

            machine.on('$invoke.cancelled', cancelledListener);

            machine.send('FETCH');
            machine.send('CANCEL');

            expect(machine.state).to.equal('idle');

            resolvePromise!('stale data');

            await vi.waitFor(() => {

                expect(cancelledListener).toHaveBeenCalledOnce();
            });

            expect(machine.context.data).to.equal(null);
        });
    });


    describe('StateMachine: persistence', () => {

        it('hydrates from storage adapter on ready()', async () => {

            const adapter: StorageAdapter = {
                load: async () => ({
                    state: 'error',
                    context: { count: 42, error: 'saved error' },
                }),
                save: vi.fn(async () => {}),
            };

            const machine = new StateMachine<CounterContext, CounterEvents>(
                {
                    initial: 'idle',
                    context: { count: 0, error: null },
                    transitions: {
                        idle: { on: { FETCH: 'loading' } },
                        loading: {},
                        error: {
                            on: {
                                RESET: {
                                    target: 'idle',
                                    action: () => ({ count: 0, error: null }),
                                },
                            },
                        },
                    },
                },
                { persistence: { key: 'test', adapter } },
            );

            await machine.ready();

            expect(machine.state).to.equal('error');
            expect(machine.context.count).to.equal(42);
        });

        it('falls back to initial if hydrated state does not exist', async () => {

            const adapter: StorageAdapter = {
                load: async () => ({
                    state: 'deleted_state',
                    context: { count: 99, error: null },
                }),
                save: vi.fn(async () => {}),
            };

            const machine = new StateMachine<CounterContext, CounterEvents>(
                {
                    initial: 'idle',
                    context: { count: 0, error: null },
                    transitions: {
                        idle: { on: { FETCH: 'loading' } },
                        loading: {},
                        error: {},
                    },
                },
                { persistence: { key: 'test', adapter } },
            );

            await machine.ready();

            expect(machine.state).to.equal('idle');
        });

        it('saves after each transition', async () => {

            const saveFn = vi.fn(async () => {});

            const adapter: StorageAdapter = {
                load: async () => null,
                save: saveFn,
            };

            const machine = new StateMachine<CounterContext, CounterEvents>(
                {
                    initial: 'idle',
                    context: { count: 0, error: null },
                    transitions: {
                        idle: {
                            on: {
                                INCREMENT: {
                                    target: 'idle',
                                    action: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
                                },
                            },
                        },
                    },
                },
                { persistence: { key: 'counter', adapter } },
            );

            await machine.ready();

            machine.send('INCREMENT');

            expect(saveFn).toHaveBeenCalledWith('counter', {
                state: 'idle',
                context: { count: 1, error: null },
            });
        });

        it('ready() resolves immediately with no persistence', async () => {

            const machine = makeCounterMachine();

            await machine.ready();

            expect(machine.state).to.equal('idle');
        });
    });


    describe('StateHub', () => {

        it('returns machines by key', () => {

            const counter = makeCounterMachine();

            const hub = new StateHub({ counter });

            expect(hub.get('counter')).to.equal(counter);
        });

        it('connects machines — entering a state triggers event on another', () => {

            interface AuthContext { user: string | null }
            interface AuthEvents { LOGIN: { user: string }, LOGOUT: void }

            const auth = new StateMachine<AuthContext, AuthEvents>({
                initial: 'loggedOut',
                context: { user: null },
                transitions: {
                    loggedOut: {
                        on: {
                            LOGIN: {
                                target: 'loggedIn',
                                action: (ctx, data) => ({ user: data.user }),
                            },
                        },
                    },
                    loggedIn: {
                        on: { LOGOUT: 'loggedOut' },
                    },
                },
            });

            const counter = makeCounterMachine();

            const hub = new StateHub({ auth, counter });

            hub.connect({
                from: 'auth',
                enters: 'loggedOut',
                to: 'counter',
                send: 'RESET',
            });

            counter.send('INCREMENT');
            counter.send('INCREMENT');
            expect(counter.context.count).to.equal(2);

            auth.send('LOGIN', { user: 'admin' });
            auth.send('LOGOUT');

            expect(counter.context.count).to.equal(0);
        });

        it('connect returns a cleanup function', () => {

            interface SimpleEvents { GO: void }

            const a = new StateMachine<{}, SimpleEvents>({
                initial: 'off',
                context: {},
                transitions: {
                    off: { on: { GO: 'on' } },
                    on: { on: { GO: 'off' } },
                },
            });

            const b = makeCounterMachine();
            const hub = new StateHub({ a, b });

            const cleanup = hub.connect({
                from: 'a',
                enters: 'on',
                to: 'b',
                send: 'INCREMENT',
            });

            a.send('GO');
            expect(b.context.count).to.equal(1);

            cleanup();

            a.send('GO');
            a.send('GO');
            expect(b.context.count).to.equal(1);
        });

        it('connect passes mapped data', () => {

            interface SrcContext { items: string[] }
            interface SrcEvents { ADD: { item: string } }

            const src = new StateMachine<SrcContext, SrcEvents>({
                initial: 'idle',
                context: { items: [] },
                transitions: {
                    idle: {
                        on: {
                            ADD: {
                                target: 'updated',
                                action: (ctx, data) => ({
                                    items: [...ctx.items, data.item],
                                }),
                            },
                        },
                    },
                    updated: {
                        on: {
                            ADD: {
                                target: 'updated',
                                action: (ctx, data) => ({
                                    items: [...ctx.items, data.item],
                                }),
                            },
                        },
                    },
                },
            });

            const counter = makeCounterMachine();
            const hub = new StateHub({ src, counter });

            hub.connect({
                from: 'src',
                enters: 'updated',
                to: 'counter',
                send: 'SET',
                data: (ctx: SrcContext) => ({ value: ctx.items.length }),
            });

            src.send('ADD', { item: 'a' });
            expect(counter.context.count).to.equal(1);

            src.send('ADD', { item: 'b' });
            expect(counter.context.count).to.equal(2);
        });
    });


    describe('StateMachine: debug mode', () => {

        it('logs transitions when debug is true', () => {

            const logSpy = vi.spyOn(console, 'log');

            const machine = new StateMachine<{ count: number }, { INCREMENT: void }>({
                initial: 'idle',
                context: { count: 0 },
                debug: true,
                transitions: {
                    idle: {
                        on: {
                            INCREMENT: {
                                target: 'idle',
                                action: (ctx) => ({ count: ctx.count + 1 }),
                            },
                        },
                    },
                },
            });

            machine.send('INCREMENT');

            expect(logSpy).toHaveBeenCalled();
        });
    });


    describe('StateMachine: edge cases', () => {

        it('handles void events without data argument', () => {

            const machine = makeCounterMachine();

            machine.send('INCREMENT');
            machine.send('DECREMENT');

            expect(machine.context.count).to.equal(0);
        });

        it('self-transitions fire listeners', () => {

            const machine = makeCounterMachine();
            const listener = vi.fn();

            machine.on('idle', listener);
            machine.send('INCREMENT');

            expect(listener).toHaveBeenCalledOnce();
        });

        it('final state accepts no events', () => {

            const machine = new StateMachine<{}, { DONE: void }>({
                initial: 'active',
                context: {},
                transitions: {
                    active: { on: { DONE: 'complete' } },
                    complete: { final: true },
                },
            });

            machine.send('DONE');
            expect(machine.state).to.equal('complete');

            const rejected = vi.fn();

            machine.on('$rejected', rejected);
            machine.send('DONE');

            expect(rejected).toHaveBeenCalledOnce();
        });

        it('context is immutable across invoke transitions', async () => {

            const machine = new StateMachine<
                { items: string[] },
                { FETCH: void }
            >({
                initial: 'idle',
                context: { items: ['a'] },
                transitions: {
                    idle: {
                        on: { FETCH: 'loading' },
                    },
                    loading: {
                        invoke: {
                            src: async () => ['b', 'c'],
                            onDone: {
                                target: 'idle',
                                action: (ctx, result) => ({ items: result }),
                            },
                            onError: { target: 'idle' },
                        },
                    },
                },
            });

            const ctxBefore = machine.context;

            machine.send('FETCH');

            await vi.waitFor(() => {

                expect(machine.state).to.equal('idle');
            });

            const ctxAfter = machine.context;

            ctxAfter.items.push('mutated');

            expect(machine.context.items).to.deep.equal(['b', 'c']);
            expect(ctxBefore.items).to.deep.equal(['a']);
        });

        it('multiple listeners on the same state all fire', () => {

            const machine = makeCounterMachine();
            const listener1 = vi.fn();
            const listener2 = vi.fn();
            const listener3 = vi.fn();

            machine.on('idle', listener1);
            machine.on('idle', listener2);
            machine.on('idle', listener3);

            machine.send('INCREMENT');

            expect(listener1).toHaveBeenCalledOnce();
            expect(listener2).toHaveBeenCalledOnce();
            expect(listener3).toHaveBeenCalledOnce();
        });

        it('send with unknown event is a no-op', () => {

            const machine = makeCounterMachine();
            const rejected = vi.fn();

            machine.on('$rejected', rejected);
            (machine as any).send('NONEXISTENT');

            expect(machine.state).to.equal('idle');
            expect(rejected).toHaveBeenCalledOnce();
        });
    });


    describe('StateMachine: invoke advanced', () => {

        it('invoke chains — onDone lands in another invoke state', async () => {

            const machine = new StateMachine<
                { step1: string | null, step2: string | null },
                { START: void }
            >({
                initial: 'idle',
                context: { step1: null, step2: null },
                transitions: {
                    idle: {
                        on: { START: 'loadingStep1' },
                    },
                    loadingStep1: {
                        invoke: {
                            src: async () => 'result1',
                            onDone: {
                                target: 'loadingStep2',
                                action: (ctx, result) => ({ ...ctx, step1: result }),
                            },
                            onError: { target: 'idle' },
                        },
                    },
                    loadingStep2: {
                        invoke: {
                            src: async () => 'result2',
                            onDone: {
                                target: 'done',
                                action: (ctx, result) => ({ ...ctx, step2: result }),
                            },
                            onError: { target: 'idle' },
                        },
                    },
                    done: { final: true },
                },
            });

            machine.send('START');

            await vi.waitFor(() => {

                expect(machine.state).to.equal('done');
            });

            expect(machine.context).to.deep.equal({
                step1: 'result1',
                step2: 'result2',
            });
        });

        it('$invoke.done event is observable', async () => {

            const machine = new StateMachine<{}, { GO: void }>({
                initial: 'idle',
                context: {},
                transitions: {
                    idle: { on: { GO: 'loading' } },
                    loading: {
                        invoke: {
                            src: async () => 42,
                            onDone: { target: 'idle' },
                            onError: { target: 'idle' },
                        },
                    },
                },
            });

            const doneFn = vi.fn();

            machine.on('$invoke.done', doneFn);
            machine.send('GO');

            await vi.waitFor(() => {

                expect(doneFn).toHaveBeenCalledOnce();
            });

            expect(doneFn.mock.calls[0][0]).to.deep.include({
                state: 'loading',
                result: 42,
            });
        });

        it('$invoke.error event is observable', async () => {

            const machine = new StateMachine<{}, { GO: void }>({
                initial: 'idle',
                context: {},
                transitions: {
                    idle: { on: { GO: 'loading' } },
                    loading: {
                        invoke: {
                            src: async () => { throw new Error('fail'); },
                            onDone: { target: 'idle' },
                            onError: { target: 'error' },
                        },
                    },
                    error: {},
                },
            });

            const errorFn = vi.fn();

            machine.on('$invoke.error', errorFn);
            machine.send('GO');

            await vi.waitFor(() => {

                expect(errorFn).toHaveBeenCalledOnce();
            });

            expect(errorFn.mock.calls[0][0].state).to.equal('loading');
            expect(errorFn.mock.calls[0][0].error).to.be.instanceOf(Error);
        });

        it('state with both invoke and manual on transitions', async () => {

            let resolvePromise: (val: string) => void;

            const machine = new StateMachine<
                { data: string | null },
                { GO: void, SKIP: void }
            >({
                initial: 'idle',
                context: { data: null },
                transitions: {
                    idle: { on: { GO: 'loading' } },
                    loading: {
                        on: { SKIP: 'skipped' },
                        invoke: {
                            src: () => new Promise((r) => { resolvePromise = r; }),
                            onDone: {
                                target: 'done',
                                action: (ctx, result) => ({ ...ctx, data: result }),
                            },
                            onError: { target: 'error' },
                        },
                    },
                    skipped: { final: true },
                    done: { final: true },
                    error: {},
                },
            });

            machine.send('GO');
            expect(machine.state).to.equal('loading');

            machine.send('SKIP');
            expect(machine.state).to.equal('skipped');

            resolvePromise!('late result');

            await vi.waitFor(() => {

                expect(machine.context.data).to.equal(null);
            });
        });
    });


    describe('StateMachine: validation advanced', () => {

        it('throws when invoke onDone target does not exist', () => {

            expect(() => new StateMachine({
                initial: 'idle',
                context: {},
                transitions: {
                    idle: {
                        invoke: {
                            src: async () => {},
                            onDone: { target: 'nowhere' },
                            onError: { target: 'idle' },
                        },
                    },
                },
            } as any)).to.throw(/does not exist/);
        });

        it('throws when invoke onError target does not exist', () => {

            expect(() => new StateMachine({
                initial: 'idle',
                context: {},
                transitions: {
                    idle: {
                        invoke: {
                            src: async () => {},
                            onDone: { target: 'idle' },
                            onError: { target: 'nowhere' },
                        },
                    },
                },
            } as any)).to.throw(/does not exist/);
        });

        it('throws when initial is not a string', () => {

            expect(() => new StateMachine({
                initial: 123,
                context: {},
                transitions: {},
            } as any)).to.throw();
        });

        it('throws when transitions is not an object', () => {

            expect(() => new StateMachine({
                initial: 'idle',
                context: {},
                transitions: 'not an object',
            } as any)).to.throw();
        });

        it('validates invoke string shorthand targets', () => {

            expect(() => new StateMachine({
                initial: 'idle',
                context: {},
                transitions: {
                    idle: {
                        invoke: {
                            src: async () => {},
                            onDone: 'nowhere',
                            onError: 'idle',
                        },
                    },
                },
            } as any)).to.throw(/does not exist/);
        });
    });


    describe('StateMachine: persistence advanced', () => {

        it('hydrated machine accepts subsequent transitions', async () => {

            const adapter: StorageAdapter = {
                load: async () => ({
                    state: 'error',
                    context: { count: 10, error: 'old error' },
                }),
                save: vi.fn(async () => {}),
            };

            const machine = new StateMachine<CounterContext, CounterEvents>(
                {
                    initial: 'idle',
                    context: { count: 0, error: null },
                    transitions: {
                        idle: {
                            on: {
                                INCREMENT: {
                                    target: 'idle',
                                    action: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
                                },
                            },
                        },
                        loading: {},
                        error: {
                            on: {
                                RESET: {
                                    target: 'idle',
                                    action: () => ({ count: 0, error: null }),
                                },
                            },
                        },
                    },
                },
                { persistence: { key: 'test', adapter } },
            );

            await machine.ready();

            expect(machine.state).to.equal('error');
            expect(machine.context.count).to.equal(10);

            machine.send('RESET');

            expect(machine.state).to.equal('idle');
            expect(machine.context.count).to.equal(0);

            machine.send('INCREMENT');

            expect(machine.context.count).to.equal(1);
        });

        it('persistence save is called for each transition after hydration', async () => {

            const saveFn = vi.fn(async () => {});

            const adapter: StorageAdapter = {
                load: async () => null,
                save: saveFn,
            };

            const machine = new StateMachine<CounterContext, CounterEvents>(
                {
                    initial: 'idle',
                    context: { count: 0, error: null },
                    transitions: {
                        idle: {
                            on: {
                                INCREMENT: {
                                    target: 'idle',
                                    action: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
                                },
                                FETCH: 'loading',
                            },
                        },
                        loading: {
                            on: {
                                SUCCESS: {
                                    target: 'idle',
                                    action: (ctx, data) => ({ ...ctx, count: data.value }),
                                },
                            },
                        },
                        error: {},
                    },
                },
                { persistence: { key: 'multi', adapter } },
            );

            await machine.ready();

            machine.send('INCREMENT');
            machine.send('INCREMENT');
            machine.send('FETCH');

            expect(saveFn).toHaveBeenCalledTimes(3);

            expect(saveFn.mock.calls[0][1]).to.deep.equal({
                state: 'idle',
                context: { count: 1, error: null },
            });

            expect(saveFn.mock.calls[2][1]).to.deep.equal({
                state: 'loading',
                context: { count: 2, error: null },
            });
        });
    });


    describe('StateMachine: robustness', () => {

        it('action that throws leaves machine in previous state', () => {

            const machine = new StateMachine<{ count: number }, { BOOM: void }>({
                initial: 'idle',
                context: { count: 0 },
                transitions: {
                    idle: {
                        on: {
                            BOOM: {
                                target: 'idle',
                                action: () => { throw new Error('action exploded'); },
                            },
                        },
                    },
                },
            });

            expect(() => machine.send('BOOM')).to.throw('action exploded');
            expect(machine.state).to.equal('idle');
            expect(machine.context.count).to.equal(0);
        });

        it('guard that throws leaves machine in previous state', () => {

            const machine = new StateMachine<{ count: number }, { GO: void }>({
                initial: 'idle',
                context: { count: 0 },
                transitions: {
                    idle: {
                        on: {
                            GO: {
                                target: 'idle',
                                guard: () => { throw new Error('guard exploded'); },
                            },
                        },
                    },
                },
            });

            expect(() => machine.send('GO')).to.throw('guard exploded');
            expect(machine.state).to.equal('idle');
            expect(machine.context.count).to.equal(0);
        });

        it('listener calling send() during transition (re-entrancy)', () => {

            const machine = new StateMachine<{ count: number }, { INCREMENT: void }>({
                initial: 'idle',
                context: { count: 0 },
                transitions: {
                    idle: {
                        on: {
                            INCREMENT: {
                                target: 'idle',
                                action: (ctx) => ({ count: ctx.count + 1 }),
                            },
                        },
                    },
                },
            });

            machine.on('idle', (payload) => {

                if (payload.context.count < 3) {

                    machine.send('INCREMENT');
                }
            });

            machine.send('INCREMENT');

            expect(machine.context.count).to.equal(3);
        });

        it('hydration with null context does not break', async () => {

            const adapter: StorageAdapter = {
                load: async () => ({
                    state: 'idle',
                    context: null as any,
                }),
                save: vi.fn(async () => {}),
            };

            const machine = new StateMachine<{ count: number }, { GO: void }>(
                {
                    initial: 'idle',
                    context: { count: 0 },
                    transitions: {
                        idle: { on: { GO: 'idle' } },
                    },
                },
                { persistence: { key: 'test', adapter } },
            );

            await machine.ready();

            expect(machine.state).to.equal('idle');
            expect(machine.context).to.equal(null);
        });

        it('send on final state does not mutate context', () => {

            const machine = new StateMachine<{ count: number }, { DONE: void, INCREMENT: void }>({
                initial: 'active',
                context: { count: 5 },
                transitions: {
                    active: { on: { DONE: 'complete' } },
                    complete: { final: true },
                },
            });

            machine.send('DONE');

            const ctxBefore = machine.context;

            (machine as any).send('INCREMENT');

            expect(machine.context).to.deep.equal(ctxBefore);
        });
    });


    describe('StateHub: advanced', () => {

        it('multiple connects from the same source state', () => {

            interface SimpleEvents { TOGGLE: void }

            const source = new StateMachine<{}, SimpleEvents>({
                initial: 'off',
                context: {},
                transitions: {
                    off: { on: { TOGGLE: 'on' } },
                    on: { on: { TOGGLE: 'off' } },
                },
            });

            const counterA = makeCounterMachine();
            const counterB = makeCounterMachine();

            const hub = new StateHub({ source, counterA, counterB });

            hub.connect({
                from: 'source',
                enters: 'on',
                to: 'counterA',
                send: 'INCREMENT',
            });

            hub.connect({
                from: 'source',
                enters: 'on',
                to: 'counterB',
                send: 'INCREMENT',
            });

            source.send('TOGGLE');

            expect(counterA.context.count).to.equal(1);
            expect(counterB.context.count).to.equal(1);
        });

        it('connect cleanup only removes its own connection', () => {

            interface SimpleEvents { TOGGLE: void }

            const source = new StateMachine<{}, SimpleEvents>({
                initial: 'off',
                context: {},
                transitions: {
                    off: { on: { TOGGLE: 'on' } },
                    on: { on: { TOGGLE: 'off' } },
                },
            });

            const counter = makeCounterMachine();
            const hub = new StateHub({ source, counter });

            const cleanup1 = hub.connect({
                from: 'source',
                enters: 'on',
                to: 'counter',
                send: 'INCREMENT',
            });

            hub.connect({
                from: 'source',
                enters: 'on',
                to: 'counter',
                send: 'INCREMENT',
            });

            source.send('TOGGLE');
            expect(counter.context.count).to.equal(2);

            cleanup1();

            source.send('TOGGLE');
            source.send('TOGGLE');

            expect(counter.context.count).to.equal(3);
        });
    });
});
