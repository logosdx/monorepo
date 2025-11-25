import {
    describe,
    it,
    mock,
} from 'node:test'

import { expect } from 'chai';

import { mockHelpers } from '../../_helpers';

import {
    wait,
    withInflightDedup,
} from '../../../../packages/utils/src/index.ts';

describe('@logosdx/utils', () => {

    const { calledExactly } = mockHelpers(expect);

    describe('flow-control: inflight deduplication', () => {

        describe('single flight per key', () => {

            it('should execute producer once for concurrent calls with same args', async () => {

                const producer = mock.fn(async (id: string) => {

                    await wait(10);
                    return `result-${id}`;
                });

                const deduped = withInflightDedup(producer);

                // Three concurrent calls with same argument
                const [result1, result2, result3] = await Promise.all([
                    deduped('42'),
                    deduped('42'),
                    deduped('42')
                ]);

                expect(result1).to.equal('result-42');
                expect(result2).to.equal('result-42');
                expect(result3).to.equal('result-42');

                // Producer should only be called once
                calledExactly(producer, 1, 'producer called once for concurrent requests');
            });

            it('should fire onStart once and onJoin for subsequent callers', async () => {

                const producer = mock.fn(async (id: string) => {

                    await wait(10);
                    return `result-${id}`;
                });

                const onStart = mock.fn();
                const onJoin = mock.fn();

                const deduped = withInflightDedup(producer, {
                    onStart, onJoin
                });

                // Three concurrent calls
                await Promise.all([
                    deduped('42'),
                    deduped('42'),
                    deduped('42')
                ]);

                calledExactly(onStart, 1, 'onStart fired once');
                calledExactly(onJoin, 2, 'onJoin fired twice for joiners');
            });

            it('should execute independently for different keys', async () => {

                const producer = mock.fn(async (id: string) => {

                    await wait(10);
                    return `result-${id}`;
                });

                const deduped = withInflightDedup(producer);

                // Two different keys
                const [result1, result2] = await Promise.all([
                    deduped('42'),
                    deduped('43')
                ]);

                expect(result1).to.equal('result-42');
                expect(result2).to.equal('result-43');

                calledExactly(producer, 2, 'producer called twice for different keys');
            });
        });

        describe('resolution lifecycle', () => {

            it('should fire onResolve once per key', async () => {

                const producer = mock.fn(async (id: string) => {

                    await wait(10);
                    return `result-${id}`;
                });

                const onResolve = mock.fn();

                const deduped = withInflightDedup(producer, {
                    onResolve
                });

                await Promise.all([
                    deduped('42'),
                    deduped('42'),
                    deduped('42')
                ]);

                calledExactly(onResolve, 1, 'onResolve fired once');

                const resolveCall = onResolve.mock.calls[0];
                expect(resolveCall?.arguments[0]).to.match(/42/); // key contains '42'
                expect(resolveCall?.arguments[1]).to.equal('result-42'); // value
            });

            it('should remove entry after resolution', async () => {

                let callCount = 0;

                const producer = mock.fn(async (id: string) => {

                    callCount++;
                    await wait(10);
                    return `result-${id}-call-${callCount}`;
                });

                const deduped = withInflightDedup(producer);

                // First batch
                const [r1, r2] = await Promise.all([
                    deduped('42'),
                    deduped('42')
                ]);

                expect(r1).to.equal('result-42-call-1');
                expect(r2).to.equal('result-42-call-1');
                calledExactly(producer, 1, 'first batch: one call');

                // Wait a bit to ensure entry is cleared
                await wait(20);

                // Second batch - should start new flight
                const [r3, r4] = await Promise.all([
                    deduped('42'),
                    deduped('42')
                ]);

                expect(r3).to.equal('result-42-call-2');
                expect(r4).to.equal('result-42-call-2');
                calledExactly(producer, 2, 'second batch: new call after settlement');
            });

            it('should propagate resolved value to all joiners', async () => {

                const complexValue = { id: 42, data: [1, 2, 3], nested: { value: 'test' } };

                const producer = mock.fn(async () => {

                    await wait(10);
                    return complexValue;
                });

                const deduped = withInflightDedup(producer);

                const results = await Promise.all([
                    deduped(),
                    deduped(),
                    deduped()
                ]);

                // All should receive the same object reference
                expect(results[0]).to.equal(complexValue);
                expect(results[1]).to.equal(complexValue);
                expect(results[2]).to.equal(complexValue);
                expect(results[0]).to.equal(results[1]);
            });
        });

        describe('rejection lifecycle', () => {

            it('should fire onReject once per key', async () => {

                const producer = mock.fn(async (id: string) => {

                    await wait(10);
                    throw new Error(`error-${id}`);
                });

                const onReject = mock.fn();

                const deduped = withInflightDedup(producer, {
                    onReject
                });

                // All should reject with same error
                const results = await Promise.allSettled([
                    deduped('42'),
                    deduped('42'),
                    deduped('42')
                ]);

                expect(results[0].status).to.equal('rejected');
                expect(results[1].status).to.equal('rejected');
                expect(results[2].status).to.equal('rejected');

                if (results[0].status === 'rejected') {

                    expect(results[0].reason).to.be.instanceOf(Error);
                    expect(results[0].reason.message).to.equal('error-42');
                }

                calledExactly(onReject, 1, 'onReject fired once');

                const rejectCall = onReject.mock.calls[0];
                expect(rejectCall?.arguments[0]).to.match(/42/); // key
                expect(rejectCall?.arguments[1]).to.be.instanceOf(Error); // error
            });

            it('should remove entry after rejection', async () => {

                let callCount = 0;

                const producer = mock.fn(async (id: string) => {

                    callCount++;
                    await wait(10);

                    if (callCount === 1) {

                        throw new Error(`error-${id}`);
                    }

                    return `success-${id}`;
                });

                const deduped = withInflightDedup(producer);

                // First batch - should reject
                const results1 = await Promise.allSettled([
                    deduped('42'),
                    deduped('42')
                ]);

                expect(results1[0].status).to.equal('rejected');
                expect(results1[1].status).to.equal('rejected');
                calledExactly(producer, 1, 'first batch: one call');

                // Wait to ensure entry is cleared
                await wait(20);

                // Second batch - should succeed (new flight)
                const results2 = await Promise.allSettled([
                    deduped('42'),
                    deduped('42')
                ]);

                expect(results2[0].status).to.equal('fulfilled');
                expect(results2[1].status).to.equal('fulfilled');
                calledExactly(producer, 2, 'second batch: new call after rejection');
            });

            it('should propagate same error to all joiners', async () => {

                const customError = new Error('custom error');

                const producer = mock.fn(async () => {

                    await wait(10);
                    throw customError;
                });

                const deduped = withInflightDedup(producer);

                const results = await Promise.allSettled([
                    deduped(),
                    deduped(),
                    deduped()
                ]);

                // All should receive the same error instance
                expect(results[0].status).to.equal('rejected');
                expect(results[1].status).to.equal('rejected');
                expect(results[2].status).to.equal('rejected');

                if (results[0].status === 'rejected' &&
                    results[1].status === 'rejected' &&
                    results[2].status === 'rejected') {

                    expect(results[0].reason).to.equal(customError);
                    expect(results[1].reason).to.equal(customError);
                    expect(results[2].reason).to.equal(customError);
                }
            });
        });

        describe('re-entrancy', () => {

            it('should start new flight after previous settlement', async () => {

                let callCount = 0;

                const producer = mock.fn(async (id: string) => {

                    callCount++;
                    await wait(10);
                    return `result-${id}-${callCount}`;
                });

                const deduped = withInflightDedup(producer);

                // First flight
                const result1 = await deduped('42');
                expect(result1).to.equal('result-42-1');

                // Second flight (after settlement)
                const result2 = await deduped('42');
                expect(result2).to.equal('result-42-2');

                // Third flight (concurrent with itself)
                const [r3, r4] = await Promise.all([
                    deduped('42'),
                    deduped('42')
                ]);

                expect(r3).to.equal('result-42-3');
                expect(r4).to.equal('result-42-3');

                calledExactly(producer, 3, 'three separate flights');
            });
        });

        describe('hook error handling', () => {

            it('should not break deduplication when onStart throws', async () => {

                const producer = mock.fn(async (id: string) => {

                    await wait(10);
                    return `result-${id}`;
                });

                const onStart = mock.fn(() => {

                    throw new Error('onStart error');
                });

                const deduped = withInflightDedup(producer, {
                    onStart
                });

                // Should not throw despite hook error
                const [r1, r2] = await Promise.all([
                    deduped('42'),
                    deduped('42')
                ]);

                expect(r1).to.equal('result-42');
                expect(r2).to.equal('result-42');
                calledExactly(producer, 1, 'producer still called once');
            });

            it('should not break deduplication when onJoin throws', async () => {

                const producer = mock.fn(async (id: string) => {

                    await wait(10);
                    return `result-${id}`;
                });

                const onJoin = mock.fn(() => {

                    throw new Error('onJoin error');
                });

                const deduped = withInflightDedup(producer, {
                    onJoin
                });

                const [r1, r2, r3] = await Promise.all([
                    deduped('42'),
                    deduped('42'),
                    deduped('42')
                ]);

                expect(r1).to.equal('result-42');
                expect(r2).to.equal('result-42');
                expect(r3).to.equal('result-42');
                calledExactly(producer, 1, 'producer still called once');
                calledExactly(onJoin, 2, 'onJoin called for joiners despite throwing');
            });

            it('should not break deduplication when onResolve throws', async () => {

                const producer = mock.fn(async (id: string) => {

                    await wait(10);
                    return `result-${id}`;
                });

                const onResolve = mock.fn(() => {

                    throw new Error('onResolve error');
                });

                const deduped = withInflightDedup(producer, {
                    onResolve
                });

                const [r1, r2] = await Promise.all([
                    deduped('42'),
                    deduped('42')
                ]);

                expect(r1).to.equal('result-42');
                expect(r2).to.equal('result-42');

                // Entry should still be cleaned up despite hook error
                await wait(20);
                const r3 = await deduped('42');
                expect(r3).to.equal('result-42');
                calledExactly(producer, 2, 'new flight starts after cleanup');
            });

            it('should not break deduplication when onReject throws', async () => {

                const producer = mock.fn(async (id: string) => {

                    await wait(10);
                    throw new Error(`error-${id}`);
                });

                const onReject = mock.fn(() => {

                    throw new Error('onReject error');
                });

                const deduped = withInflightDedup(producer, {
                    onReject
                });

                const results = await Promise.allSettled([
                    deduped('42'),
                    deduped('42')
                ]);

                expect(results[0].status).to.equal('rejected');
                expect(results[1].status).to.equal('rejected');

                // Entry should still be cleaned up
                await wait(20);
                const result2 = await Promise.allSettled([deduped('42')]);
                expect(result2[0].status).to.equal('rejected');
                calledExactly(producer, 2, 'new flight starts after cleanup');
            });
        });

        describe('custom key function', () => {

            it('should use custom generateKey when provided', async () => {

                const producer = mock.fn(async (id: string, _opts: { timestamp: number }) => {

                    await wait(10);
                    return `result-${id}`;
                });

                // Dedupe only by id, ignore opts
                const deduped = withInflightDedup(producer, {
                    generateKey: (id) => id
                });

                // Different opts but same id - should dedupe
                const [r1, r2] = await Promise.all([
                    deduped('42', { timestamp: 1000 }),
                    deduped('42', { timestamp: 2000 })
                ]);

                expect(r1).to.equal('result-42');
                expect(r2).to.equal('result-42');
                calledExactly(producer, 1, 'deduped despite different opts');
            });

            it('should handle function arguments with custom generateKey', async () => {

                const producer = mock.fn(async (url: string, transform: (x: any) => any) => {

                    await wait(10);
                    return transform(url);
                });

                // Only dedupe by url, ignore transform function
                const deduped = withInflightDedup(producer, {
                    generateKey: (url) => url
                });

                const transform1 = (x: string) => `transformed1-${x}`;
                const transform2 = (x: string) => `transformed2-${x}`;

                // Same URL, different transforms - should dedupe
                const [r1, r2] = await Promise.all([
                    deduped('/api/users', transform1),
                    deduped('/api/users', transform2)
                ]);

                // Both use the first transform (from the producer call)
                expect(r1).to.equal('transformed1-/api/users');
                expect(r2).to.equal('transformed1-/api/users');
                calledExactly(producer, 1, 'deduped despite different function arguments');
            });

            it('should support complex custom keys', async () => {

                interface Request {
                    userId: string;
                    resource: string;
                    meta?: { large: object };
                }

                const producer = mock.fn(async (req: Request) => {

                    await wait(10);
                    return `result-${req.userId}-${req.resource}`;
                });

                // Extract only discriminating fields
                const deduped = withInflightDedup(producer, {
                    generateKey: (req) => `${req.userId}:${req.resource}`
                });

                const [r1, r2] = await Promise.all([
                    deduped({ userId: 'u1', resource: 'profile', meta: { large: {} } }),
                    deduped({ userId: 'u1', resource: 'profile', meta: { large: { different: true } } })
                ]);

                expect(r1).to.equal('result-u1-profile');
                expect(r2).to.equal('result-u1-profile');
                calledExactly(producer, 1, 'deduped using custom key');
            });
        });

        describe('default serializer correctness', () => {

            it('should dedupe identical primitive args', async () => {

                const producer = mock.fn(async (a: number, b: string, c: boolean) => {

                    await wait(10);
                    return `${a}-${b}-${c}`;
                });

                const deduped = withInflightDedup(producer);

                const [r1, r2] = await Promise.all([
                    deduped(42, 'test', true),
                    deduped(42, 'test', true)
                ]);

                expect(r1).to.equal('42-test-true');
                expect(r2).to.equal('42-test-true');
                calledExactly(producer, 1, 'primitives deduped correctly');
            });

            it('should dedupe objects with same structure regardless of key order', async () => {

                const producer = mock.fn(async (obj: any) => {

                    await wait(10);
                    return obj.a + obj.b;
                });

                const deduped = withInflightDedup(producer);

                const [r1, r2] = await Promise.all([
                    deduped({ a: 1, b: 2 }),
                    deduped({ b: 2, a: 1 })  // Different key order
                ]);

                expect(r1).to.equal(3);
                expect(r2).to.equal(3);
                calledExactly(producer, 1, 'objects with different key order deduped');
            });

            it('should dedupe arrays with same values', async () => {

                const producer = mock.fn(async (arr: number[]) => {

                    await wait(10);
                    return arr.reduce((a, b) => a + b, 0);
                });

                const deduped = withInflightDedup(producer);

                const [r1, r2] = await Promise.all([
                    deduped([1, 2, 3]),
                    deduped([1, 2, 3])
                ]);

                expect(r1).to.equal(6);
                expect(r2).to.equal(6);
                calledExactly(producer, 1, 'arrays deduped');
            });

            it('should NOT dedupe arrays with same values but different order', async () => {

                const producer = mock.fn(async (arr: number[]) => {

                    await wait(10);
                    return arr.join(',');
                });

                const deduped = withInflightDedup(producer);

                const [r1, r2] = await Promise.all([
                    deduped([1, 2, 3]),
                    deduped([3, 2, 1])  // Different order
                ]);

                expect(r1).to.equal('1,2,3');
                expect(r2).to.equal('3,2,1');
                calledExactly(producer, 2, 'arrays with different order NOT deduped');
            });

            it('should dedupe Dates with same timestamp', async () => {

                const producer = mock.fn(async (date: Date) => {

                    await wait(10);
                    return date.getTime();
                });

                const deduped = withInflightDedup(producer);

                const [r1, r2] = await Promise.all([
                    deduped(new Date(1000)),
                    deduped(new Date(1000))
                ]);

                expect(r1).to.equal(1000);
                expect(r2).to.equal(1000);
                calledExactly(producer, 1, 'Dates with same timestamp deduped');
            });

            it('should dedupe RegExp with same pattern and flags', async () => {

                const producer = mock.fn(async (regex: RegExp) => {

                    await wait(10);
                    return regex.toString();
                });

                const deduped = withInflightDedup(producer);

                const [r1, r2] = await Promise.all([
                    deduped(/test/gi),
                    deduped(/test/gi)
                ]);

                expect(r1).to.equal('/test/gi');
                expect(r2).to.equal('/test/gi');
                calledExactly(producer, 1, 'RegExp deduped');
            });

            it('should dedupe Maps with same entries regardless of insertion order', async () => {

                const producer = mock.fn(async (map: Map<string, number>) => {

                    await wait(10);
                    return Array.from(map.values()).reduce((a, b) => a + b, 0);
                });

                const deduped = withInflightDedup(producer);

                const map1 = new Map([['a', 1], ['b', 2]]);
                const map2 = new Map([['b', 2], ['a', 1]]);

                const [r1, r2] = await Promise.all([
                    deduped(map1),
                    deduped(map2)
                ]);

                expect(r1).to.equal(3);
                expect(r2).to.equal(3);
                calledExactly(producer, 1, 'Maps with same entries deduped');
            });

            it('should dedupe Sets with same values regardless of insertion order', async () => {

                const producer = mock.fn(async (set: Set<number>) => {

                    await wait(10);
                    return Array.from(set).reduce((a, b) => a + b, 0);
                });

                const deduped = withInflightDedup(producer);

                const set1 = new Set([1, 2, 3]);
                const set2 = new Set([3, 2, 1]);

                const [r1, r2] = await Promise.all([
                    deduped(set1),
                    deduped(set2)
                ]);

                expect(r1).to.equal(6);
                expect(r2).to.equal(6);
                calledExactly(producer, 1, 'Sets with same values deduped');
            });

            it('should handle circular references without throwing', async () => {

                const producer = mock.fn(async (obj: any) => {

                    await wait(10);
                    return obj.value;
                });

                const deduped = withInflightDedup(producer);

                const circular1: any = { value: 42 };
                circular1.self = circular1;

                const circular2: any = { value: 42 };
                circular2.self = circular2;

                // Should not throw
                const [r1, r2] = await Promise.all([
                    deduped(circular1),
                    deduped(circular2)
                ]);

                expect(r1).to.equal(42);
                expect(r2).to.equal(42);
                calledExactly(producer, 1, 'circular references handled');
            });
        });

        describe('edge cases', () => {

            it('should handle null and undefined', async () => {

                const producer = mock.fn(async (val: any) => {

                    await wait(10);
                    return String(val);
                });

                const deduped = withInflightDedup(producer);

                const [r1, r2] = await Promise.all([
                    deduped(null),
                    deduped(null)
                ]);

                const [r3, r4] = await Promise.all([
                    deduped(undefined),
                    deduped(undefined)
                ]);

                expect(r1).to.equal('null');
                expect(r2).to.equal('null');
                expect(r3).to.equal('undefined');
                expect(r4).to.equal('undefined');

                calledExactly(producer, 2, 'null and undefined handled separately');
            });

            it('should distinguish -0 from 0', async () => {

                const producer = mock.fn(async (n: number) => {

                    await wait(10);
                    return Object.is(n, -0) ? 'negative-zero' : 'zero';
                });

                const deduped = withInflightDedup(producer);

                const [r1, r2] = await Promise.all([
                    deduped(0),
                    deduped(0)
                ]);

                await wait(20);

                const [r3, r4] = await Promise.all([
                    deduped(-0),
                    deduped(-0)
                ]);

                expect(r1).to.equal('zero');
                expect(r2).to.equal('zero');
                expect(r3).to.equal('negative-zero');
                expect(r4).to.equal('negative-zero');

                calledExactly(producer, 2, '-0 and 0 treated separately');
            });

            it('should handle nested complex structures', async () => {

                const producer = mock.fn(async (data: any) => {

                    await wait(10);
                    return data.deep.nested.value;
                });

                const deduped = withInflightDedup(producer);

                const complex1 = {
                    deep: {
                        nested: {
                            value: 42,
                            array: [1, 2, { inner: 'test' }],
                            map: new Map([['key', 'value']])
                        }
                    }
                };

                const complex2 = {
                    deep: {
                        nested: {
                            array: [1, 2, { inner: 'test' }],
                            value: 42,
                            map: new Map([['key', 'value']])
                        }
                    }
                };

                const [r1, r2] = await Promise.all([
                    deduped(complex1),
                    deduped(complex2)
                ]);

                expect(r1).to.equal(42);
                expect(r2).to.equal(42);
                calledExactly(producer, 1, 'complex nested structures deduped');
            });

            it('should handle no arguments', async () => {

                const producer = mock.fn(async () => {

                    await wait(10);
                    return 'no-args';
                });

                const deduped = withInflightDedup(producer);

                const [r1, r2, r3] = await Promise.all([
                    deduped(),
                    deduped(),
                    deduped()
                ]);

                expect(r1).to.equal('no-args');
                expect(r2).to.equal('no-args');
                expect(r3).to.equal('no-args');
                calledExactly(producer, 1, 'no-args deduped');
            });
        });

        describe('conditional deduplication (shouldDedupe)', () => {

            it('should bypass deduplication when shouldDedupe returns false', async () => {

                let callCount = 0;

                const producer = mock.fn(async (id: string, _opts?: { bustCache?: boolean }) => {

                    callCount++;
                    await wait(10);
                    return `result-${id}-${callCount}`;
                });

                const deduped = withInflightDedup(producer, {
                    shouldDedupe: (_id, opts) => !opts?.bustCache
                });

                // Normal calls should dedupe
                const [r1, r2] = await Promise.all([
                    deduped('42', undefined),
                    deduped('42', undefined)
                ]);

                expect(r1).to.equal('result-42-1');
                expect(r2).to.equal('result-42-1');
                calledExactly(producer, 1, 'normal calls deduped');

                await wait(20);

                // Cache-busting calls should NOT dedupe (each executes independently)
                const results = await Promise.all([
                    deduped('42', { bustCache: true }),
                    deduped('42', { bustCache: true })
                ]);

                // Both should have executed independently (can't predict exact order)
                expect(results).to.have.lengthOf(2);
                expect(producer.mock.calls.length).to.equal(3);
            });

            it('should not invoke serializer when shouldDedupe returns false', async () => {

                const producer = mock.fn(async (id: string, _opts?: { bustCache?: boolean }) => {

                    await wait(10);
                    return `result-${id}`;
                });

                const generateKey = mock.fn((id: string, _opts?: { bustCache?: boolean }) => id);

                const deduped = withInflightDedup(producer, {
                    generateKey,
                    shouldDedupe: (_id, opts) => !opts?.bustCache
                });

                // Cache-busting call
                await deduped('42', { bustCache: true });

                // generateKey should not have been called
                calledExactly(generateKey, 0, 'generateKey not called when shouldDedupe returns false');
            });

            it('should not fire hooks when bypassing deduplication', async () => {

                const producer = mock.fn(async (id: string, _opts?: { bustCache?: boolean }) => {

                    await wait(10);
                    return `result-${id}`;
                });

                const onStart = mock.fn();
                const onJoin = mock.fn();

                const deduped = withInflightDedup(producer, {
                    shouldDedupe: (_id, opts) => !opts?.bustCache,
                    onStart, onJoin
                });

                // Bypassed call
                await deduped('42', { bustCache: true });

                calledExactly(onStart, 0, 'onStart not called when bypassed');
                calledExactly(onJoin, 0, 'onJoin not called when bypassed');
            });

            it('should allow mixing normal and bypassed calls', async () => {

                let callCount = 0;

                const producer = mock.fn(async (id: string, _opts?: { bustCache?: boolean }) => {

                    callCount++;
                    await wait(10);
                    return `result-${id}-${callCount}`;
                });

                const deduped = withInflightDedup(producer, {
                    shouldDedupe: (_id, opts) => !opts?.bustCache
                });

                // Mix of normal and bypassed concurrent calls
                const results = await Promise.all([
                    deduped('42', undefined),           // Normal: will be deduped
                    deduped('42', undefined),           // Normal: joins first
                    deduped('42', { bustCache: true }), // Bypassed: executes independently
                    deduped('42', { bustCache: true })  // Bypassed: executes independently
                ]);

                // First two should be deduped (same value)
                expect(results[0]).to.equal(results[1]);

                // All four results should be present
                expect(results).to.have.lengthOf(4);

                // Should have made 3 calls total (1 deduped + 2 bypassed)
                expect(producer.mock.calls.length).to.equal(3);
            });

            it('should handle shouldDedupe errors gracefully', async () => {

                const producer = mock.fn(async (id: string) => {

                    await wait(10);
                    return `result-${id}`;
                });

                const shouldDedupe = mock.fn(() => {

                    throw new Error('shouldDedupe error');
                });

                const deduped = withInflightDedup(producer, {
                    shouldDedupe
                });

                // Should proceed with normal deduplication when shouldDedupe throws
                const [r1, r2] = await Promise.all([
                    deduped('42'),
                    deduped('42')
                ]);

                expect(r1).to.equal('result-42');
                expect(r2).to.equal('result-42');
                calledExactly(producer, 1, 'falls back to deduplication on error');
            });

            it('should pass all arguments to shouldDedupe', async () => {

                const producer = mock.fn(async (a: string, b: number, c: boolean) => {

                    await wait(10);
                    return `${a}-${b}-${c}`;
                });

                const shouldDedupe = mock.fn((_a: string, _b: number, _c: boolean) => true);

                const deduped = withInflightDedup(producer, {
                    shouldDedupe
                });

                await deduped('test', 42, true);

                const call = shouldDedupe.mock.calls[0];
                expect(call?.arguments[0]).to.equal('test');
                expect(call?.arguments[1]).to.equal(42);
                expect(call?.arguments[2]).to.equal(true);
            });
        });

        describe('hooks call order and arguments', () => {

            it('should call hooks in correct order for success', async () => {

                const callOrder: string[] = [];

                const producer = mock.fn(async (id: string) => {

                    callOrder.push('producer');
                    await wait(10);
                    return `result-${id}`;
                });

                const deduped = withInflightDedup(producer, {
                    onStart: (key) => {

                        callOrder.push(`onStart:${key}`);
                    },
                    onJoin: (key) => {

                        callOrder.push(`onJoin:${key}`);
                    },
                    onResolve: (key, value) => {

                        callOrder.push(`onResolve:${key}:${value}`);
                    }
                });

                await Promise.all([
                    deduped('42'),
                    deduped('42')
                ]);

                // onStart before producer, onJoin for second call, onResolve after producer
                expect(callOrder[0]).to.match(/onStart/);
                expect(callOrder[1]).to.equal('producer');
                expect(callOrder[2]).to.match(/onJoin/);
                expect(callOrder[3]).to.match(/onResolve.*result-42/);
            });

            it('should call hooks in correct order for failure', async () => {

                const callOrder: string[] = [];

                const producer = mock.fn(async (id: string) => {

                    callOrder.push('producer');
                    await wait(10);
                    throw new Error(`error-${id}`);
                });

                const deduped = withInflightDedup(producer, {
                    onStart: (key) => {

                        callOrder.push(`onStart:${key}`);
                    },
                    onJoin: (key) => {

                        callOrder.push(`onJoin:${key}`);
                    },
                    onReject: (key, error: any) => {

                        callOrder.push(`onReject:${key}:${error.message}`);
                    }
                });

                await Promise.allSettled([
                    deduped('42'),
                    deduped('42')
                ]);

                expect(callOrder[0]).to.match(/onStart/);
                expect(callOrder[1]).to.equal('producer');
                expect(callOrder[2]).to.match(/onJoin/);
                expect(callOrder[3]).to.match(/onReject.*error-42/);
            });
        });
    });
});
