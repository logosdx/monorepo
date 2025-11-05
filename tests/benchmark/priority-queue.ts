import { test, describe } from 'node:test'
import { performance } from 'perf_hooks';

import { expect } from 'chai';

import { PriorityQueue } from '../../packages/utils/src/index.ts';

describe('PriorityQueue Benchmarks', () => {

    const opsPerSecond = (time: number, n: number): number => Number((n / time * 1000).toFixed(0));

    test('stress test - enqueue/dequeue performance', async () => {
        const sizes = [10_000, 100_000, 500_000, 2_000_000];

        class Results {
            push: number[] = [];
            pop: number[] = [];
            peekMany: number[] = [];
            heapify: number[] = [];
            toSortedArray: number[] = [];
            iterator: number[] = [];
        }

        const allResults = {} as Record<string, Results>

        for (const n of sizes) {
            const pq = new PriorityQueue<number>();
            const results = new Results();

            const startEnq = performance.now();
            for (let i = 0; i < n; i++) {
                pq.push(i, 0);
            }
            const endEnq = performance.now();
            const enqTime = endEnq - startEnq;
            results.push.push(enqTime);

            const startPeekMany = performance.now();
            const data = pq.peekMany(n);
            const endPeekMany = performance.now();
            const peekManyTime = endPeekMany - startPeekMany;
            results.peekMany.push(peekManyTime);

            const startDeq = performance.now();
            while (!pq.isEmpty()) {
                pq.pop();
            }
            const endDeq = performance.now();
            const deqTime = endDeq - startDeq;
            results.pop.push(deqTime);

            const startHeapify = performance.now();
            pq.heapify(data.map((v, i) => ({ value: v, priority: 0, order: i })));
            const endHeapify = performance.now();
            const heapifyTime = endHeapify - startHeapify;
            results.heapify.push(heapifyTime);

            const startToSortedArray = performance.now();
            pq.toSortedArray();
            const endToSortedArray = performance.now();
            const toSortedArrayTime = endToSortedArray - startToSortedArray;
            results.toSortedArray.push(toSortedArrayTime);

            const startIterator = performance.now();
            for (const _ of pq) {
                // noop
            }
            const endIterator = performance.now();
            const iteratorTime = endIterator - startIterator;
            results.iterator.push(iteratorTime);

            allResults[n] = results;
        }

        const avg: Record<string, number> = {};

        for (const n in allResults) {
            const results = allResults[n]!;
            const _avg: Record<string, number> = {
                push: opsPerSecond(results.push.reduce((a, b) => a + b, 0) / results.push.length, Number(n)),
                pop: opsPerSecond(results.pop.reduce((a, b) => a + b, 0) / results.pop.length, Number(n)),
                peekMany: opsPerSecond(results.peekMany.reduce((a, b) => a + b, 0) / results.peekMany.length, Number(n)),
                heapify: opsPerSecond(results.heapify.reduce((a, b) => a + b, 0) / results.heapify.length, Number(n)),
                toSortedArray: opsPerSecond(results.toSortedArray.reduce((a, b) => a + b, 0) / results.toSortedArray.length, Number(n)),
                iterator: opsPerSecond(results.iterator.reduce((a, b) => a + b, 0) / results.iterator.length, Number(n)),
            };

            for (const key in _avg) {
                if (avg[key] === undefined) {
                    avg[key] = _avg[key]!;
                }
                else {
                    avg[key] = Math.floor((avg[key]! + _avg[key]!) / 2);
                }
            }
        }

        console.table(avg);
    });

    test('fuzz test - random operations correctness', async () => {
        const pq = new PriorityQueue<number>();
        type Node = { value: number; priority: number; order: number };
        const ref: Node[] = [];
        let order = 0;

        for (let i = 0; i < 1000; i++) {
            if (Math.random() < 0.7) {
                const value = Math.random();
                const priority = Math.floor(Math.random() * 5);
                pq.push(value, priority);
                ref.push({ value, priority, order: order++ });
            } else {
                const deq = pq.pop();
                ref.sort((a, b) => a.priority - b.priority || a.order - b.order);
                const expected = ref.length ? ref.shift()!.value : null;
                if (deq !== expected) {
                    throw new Error(`Mismatch: got ${deq}, expected ${expected}`);
                }
            }
        }
    });

    test('resource test - memory usage under load', async () => {
        if (typeof global.gc !== 'function') {
            console.warn('Run node with --expose-gc to enable forced GC for accurate measurements');
        }
        const pq = new PriorityQueue<number>();
        global.gc?.();
        const before = process.memoryUsage().heapUsed;

        const N = 1_000_000;
        for (let i = 0; i < N; i++) {
            pq.push(i, i);
        }

        global.gc?.();
        const after = process.memoryUsage().heapUsed;
        const usedMB = (after - before) / (1024 * 1024);
        console.log(`Heap delta after ${N} enqueues: ${usedMB.toFixed(2)} MB`);
    });

    test('tie-breaking under load preserves order', async () => {
        const count = 100_000;

        // FIFO test
        const pqFifo = new PriorityQueue<number>();
        for (let i = 0; i < count; i++) {
            pqFifo.push(i, 0);
        }
        for (let i = 0; i < count; i++) {
            const v = pqFifo.pop();
            expect(v).to.equal(i, `FIFO: at index ${i}, expected ${i}, got ${v}`);
        }

        // LIFO test
        const pqLifo = new PriorityQueue<number>({ lifo: true });
        for (let i = 0; i < count; i++) {
            pqLifo.push(i, 0);
        }
        for (let i = count - 1; i >= 0; i--) {
            const v = pqLifo.pop();
            expect(v).to.equal(i, `LIFO: expected ${i}, got ${v}`);
        }
    });
});