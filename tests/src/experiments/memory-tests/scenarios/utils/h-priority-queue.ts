/**
 * Scenario H: Priority Queue
 *
 * Goal: Detect leaks from heap array management and node object retention.
 *
 * What it does:
 * - Tests heap growth/shrink cycles
 * - Tests backing array compaction after pop operations
 * - Tests Node object cleanup after pop
 * - Tests iterator memory behavior
 * - Tests clear() operation cleanup
 *
 * Pass criteria:
 * - Heap returns to baseline after GC
 * - Node wrappers are GC'd after pop
 * - clear() releases all memory immediately
 * - Backing array buffer shrinks after mass pop (implementation dependent)
 */

import { PriorityQueue } from '../../../../../../packages/utils/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import { createLargeObject } from './_helpers.ts';

interface PriorityQueueContext {

    /** Track queues created */
    queueCount: number;

    /** Track total items processed */
    itemsProcessed: number;
}

export const priorityQueueScenario: Scenario<PriorityQueueContext> = {

    name: 'priority-queue',
    description: 'Heap growth/shrink, backing array compaction, and Node object cleanup',

    setup() {

        return {
            queueCount: 0,
            itemsProcessed: 0
        };
    },

    async run(_iteration: number, context: ScenarioContext<PriorityQueueContext>) {

        let queuesCreated = 0;
        let itemsPushed = 0;
        let itemsPopped = 0;
        let queuesCleared = 0;

        // === Test 1: Basic push/pop cycle ===
        const queue1 = new PriorityQueue<number>();

        for (let i = 0; i < 10000; i++) {

            queue1.push(i, Math.random() * 100);
            itemsPushed++;
        }

        while (!queue1.isEmpty()) {

            queue1.pop();
            itemsPopped++;
        }

        queuesCreated++;

        // === Test 2: Large object storage ===
        // Queue stores objects - verify they're released after pop
        const queue2 = new PriorityQueue<Record<string, unknown>>();

        for (let i = 0; i < 100; i++) {

            queue2.push(createLargeObject(10), i); // 10KB per item
            itemsPushed++;
        }

        // Pop all - objects should be eligible for GC
        while (!queue2.isEmpty()) {

            const _item = queue2.pop();
            // Don't hold reference to popped item
            itemsPopped++;
        }

        queuesCreated++;

        // === Test 3: Backing array compaction test ===
        // Push many items, pop all, verify memory is released
        const queue3 = new PriorityQueue<number>();
        const largeCount = 100000;

        // Push many items
        for (let i = 0; i < largeCount; i++) {

            queue3.push(i, i % 100);
            itemsPushed++;
        }

        const sizeAfterPush = queue3.size();

        // Pop all items
        for (let i = 0; i < largeCount; i++) {

            queue3.pop();
            itemsPopped++;
        }

        const sizeAfterPop = queue3.size();

        // Force GC to check if backing array is compacted
        if (global.gc) {

            global.gc();
        }

        queuesCreated++;

        // === Test 4: clear() operation ===
        const queue4 = new PriorityQueue<Record<string, unknown>>();

        for (let i = 0; i < 1000; i++) {

            queue4.push(createLargeObject(5), i);
            itemsPushed++;
        }

        // Clear should release all at once
        queue4.clear();
        queuesCleared++;

        queuesCreated++;

        // === Test 5: Iterator memory ===
        // Iterator creates a clone - verify clone is GC'd
        const queue5 = new PriorityQueue<number>();

        for (let i = 0; i < 1000; i++) {

            queue5.push(i, i);
            itemsPushed++;
        }

        // Iterate (creates clone internally)
        let iterCount = 0;

        for (const _item of queue5) {

            iterCount++;
        }

        // Original queue should be unchanged
        const sizeAfterIter = queue5.size();

        // Clear original
        queue5.clear();
        queuesCleared++;

        queuesCreated++;

        // === Test 6: toSortedArray() memory ===
        const queue6 = new PriorityQueue<number>();

        for (let i = 0; i < 500; i++) {

            queue6.push(i, Math.random() * 100);
            itemsPushed++;
        }

        // Create sorted array (clones queue)
        const _sorted = queue6.toSortedArray();

        // Original unchanged
        const sizeAfterSort = queue6.size();

        queue6.clear();
        queuesCleared++;

        queuesCreated++;

        // === Test 7: popMany() ===
        const queue7 = new PriorityQueue<number>();

        for (let i = 0; i < 1000; i++) {

            queue7.push(i, i);
            itemsPushed++;
        }

        // Pop in chunks
        while (!queue7.isEmpty()) {

            const popped = queue7.popMany(100);
            itemsPopped += popped.length;
        }

        queuesCreated++;

        // === Test 8: peek() and peekMany() ===
        const queue8 = new PriorityQueue<number>();

        for (let i = 0; i < 100; i++) {

            queue8.push(i, i);
            itemsPushed++;
        }

        // Peek operations shouldn't affect memory
        for (let i = 0; i < 1000; i++) {

            queue8.peek();
            queue8.peekMany(10);
        }

        queue8.clear();
        queuesCleared++;

        queuesCreated++;

        // === Test 9: LIFO vs FIFO modes ===
        const lifoQueue = new PriorityQueue<number>({ lifo: true });
        const fifoQueue = new PriorityQueue<number>({ lifo: false });

        for (let i = 0; i < 100; i++) {

            lifoQueue.push(i, 0); // Same priority
            fifoQueue.push(i, 0); // Same priority
            itemsPushed += 2;
        }

        while (!lifoQueue.isEmpty()) {

            lifoQueue.pop();
            itemsPopped++;
        }

        while (!fifoQueue.isEmpty()) {

            fifoQueue.pop();
            itemsPopped++;
        }

        queuesCreated += 2;

        // === Test 10: maxHeap mode ===
        const maxHeap = new PriorityQueue<number>({ maxHeap: true });

        for (let i = 0; i < 100; i++) {

            maxHeap.push(i, i);
            itemsPushed++;
        }

        while (!maxHeap.isEmpty()) {

            maxHeap.pop();
            itemsPopped++;
        }

        queuesCreated++;

        // === Test 11: clone() memory ===
        const originalQueue = new PriorityQueue<number>();

        for (let i = 0; i < 500; i++) {

            originalQueue.push(i, i);
            itemsPushed++;
        }

        // Clone creates new queue with copied heap
        const clonedQueue = originalQueue.clone();

        // Clear clone
        clonedQueue.clear();
        queuesCleared++;

        // Clear original
        originalQueue.clear();
        queuesCleared++;

        queuesCreated += 2;

        // === Test 12: find() operation ===
        const queue12 = new PriorityQueue<{ id: number; data: string }>();

        for (let i = 0; i < 100; i++) {

            queue12.push({ id: i, data: `item-${i}` }, i);
            itemsPushed++;
        }

        // Find shouldn't affect memory
        for (let i = 0; i < 100; i++) {

            queue12.find(item => item.id === i);
        }

        queue12.clear();
        queuesCleared++;

        queuesCreated++;

        // Allow microtasks to settle
        await new Promise<void>(resolve => queueMicrotask(resolve));

        context.data.queueCount += queuesCreated;
        context.data.itemsProcessed += itemsPushed + itemsPopped;

        return {
            queuesCreated,
            itemsPushed,
            itemsPopped,
            queuesCleared,
            sizeAfterPush,
            sizeAfterPop,
            sizeAfterIter,
            sizeAfterSort,
            iterCount
        };
    },

    teardown(_context: ScenarioContext<PriorityQueueContext>) {

        // Nothing to explicitly clean up
    }
};
