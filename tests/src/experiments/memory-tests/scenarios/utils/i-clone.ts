/**
 * Scenario I: Clone & Data Structures
 *
 * Goal: Detect leaks from clone WeakMap tracking and temporary allocations.
 *
 * What it does:
 * - Tests WeakMap cleanup after cloning circular references
 * - Tests large object cloning temporary allocations
 * - Tests various data type cloning (Map, Set, Date, RegExp, etc.)
 * - Tests merge and equals operations
 *
 * Pass criteria:
 * - Heap returns to baseline after GC
 * - WeakMap entries for circular reference tracking are GC'd
 * - Temporary allocations during clone are released
 */

import {
    clone,
    merge,
    equals
} from '../../../../../../packages/utils/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import {
    createLargeObject,
    createDeepObject,
    createCircularObject
} from './_helpers.ts';

interface CloneContext {

    /** Track clone operations */
    cloneCount: number;

    /** Track merge operations */
    mergeCount: number;
}

export const cloneScenario: Scenario<CloneContext> = {

    name: 'clone',
    description: 'WeakMap cleanup, temporary allocations, and circular reference handling',

    setup() {

        return {
            cloneCount: 0,
            mergeCount: 0
        };
    },

    async run(_iteration: number, context: ScenarioContext<CloneContext>) {

        let clonesPerformed = 0;
        let mergesPerformed = 0;
        let equalChecks = 0;
        let circularClones = 0;

        // === Test 1: Simple object cloning ===
        for (let i = 0; i < 100; i++) {

            const original = { a: 1, b: 'test', c: [1, 2, 3] };
            const _cloned = clone(original);
            clonesPerformed++;
        }

        // === Test 2: Large object cloning ===
        for (let i = 0; i < 50; i++) {

            const large = createLargeObject(50); // 50KB
            const _cloned = clone(large);
            clonesPerformed++;
        }

        // Large objects go out of scope

        // === Test 3: Deep object cloning ===
        for (let i = 0; i < 20; i++) {

            const deep = createDeepObject(8, 3); // 8 levels deep, 3 children each
            const _cloned = clone(deep);
            clonesPerformed++;
        }

        // === Test 4: Circular reference cloning ===
        // This uses WeakMap internally for tracking visited objects
        for (let i = 0; i < 100; i++) {

            const circular = createCircularObject();
            const _cloned = clone(circular);
            circularClones++;
            clonesPerformed++;
        }

        // Force GC - WeakMap entries should be cleaned
        if (global.gc) {

            global.gc();
        }

        // === Test 5: Array cloning ===
        for (let i = 0; i < 50; i++) {

            const arr = Array.from({ length: 1000 }, (_, j) => ({
                index: j,
                data: `item-${j}`
            }));

            const _cloned = clone(arr);
            clonesPerformed++;
        }

        // === Test 6: Map cloning ===
        for (let i = 0; i < 50; i++) {

            const map = new Map<string, number>();

            for (let j = 0; j < 100; j++) {

                map.set(`key-${j}`, j);
            }

            const _cloned = clone(map);
            clonesPerformed++;
        }

        // === Test 7: Set cloning ===
        for (let i = 0; i < 50; i++) {

            const set = new Set<number>();

            for (let j = 0; j < 100; j++) {

                set.add(j);
            }

            const _cloned = clone(set);
            clonesPerformed++;
        }

        // === Test 8: Date and RegExp cloning ===
        for (let i = 0; i < 100; i++) {

            const date = new Date();
            const regex = /test-pattern-\d+/gi;

            const _clonedDate = clone(date);
            const _clonedRegex = clone(regex);
            clonesPerformed += 2;
        }

        // === Test 9: Error cloning ===
        for (let i = 0; i < 50; i++) {

            const error = new Error(`Test error ${i}`);
            error.stack = 'x'.repeat(1000); // Large stack

            const _cloned = clone(error);
            clonesPerformed++;
        }

        // === Test 10: TypedArray cloning ===
        for (let i = 0; i < 20; i++) {

            const uint8 = new Uint8Array(10000);
            const float64 = new Float64Array(1000);

            const _clonedUint8 = clone(uint8);
            const _clonedFloat64 = clone(float64);
            clonesPerformed += 2;
        }

        // === Test 11: merge operations ===
        for (let i = 0; i < 100; i++) {

            const obj1 = { a: 1, b: { c: 2 } };
            const obj2 = { b: { d: 3 }, e: 4 };

            const _merged = merge(obj1, obj2);
            mergesPerformed++;
        }

        // === Test 12: merge with defaults pattern ===
        for (let i = 0; i < 100; i++) {

            const defaults = { timeout: 1000, retries: 3, debug: false };
            const overrides = { timeout: 5000 };

            const _config = merge(defaults, overrides);
            mergesPerformed++;
        }

        // === Test 13: Deep merge with large objects ===
        for (let i = 0; i < 20; i++) {

            const deep1 = createDeepObject(5, 3);
            const deep2 = createDeepObject(5, 3);

            const _merged = merge(deep1, deep2);
            mergesPerformed++;
        }

        // === Test 14: equals comparisons ===
        for (let i = 0; i < 100; i++) {

            const obj1 = { a: 1, b: [1, 2, 3], c: { d: 4 } };
            const obj2 = clone(obj1);

            const _isEqual = equals(obj1, obj2);
            equalChecks++;
        }

        // === Test 15: equals with large objects ===
        for (let i = 0; i < 20; i++) {

            const large1 = createLargeObject(20);
            const large2 = clone(large1);

            const _isEqual = equals(large1, large2);
            equalChecks++;
        }

        // === Test 16: equals with circular references ===
        for (let i = 0; i < 50; i++) {

            const circ1 = createCircularObject();
            const circ2 = clone(circ1);

            // equals should handle circular refs
            const _isEqual = equals(circ1, circ2);
            equalChecks++;
        }

        // === Test 17: Nested Map and Set cloning ===
        for (let i = 0; i < 20; i++) {

            const nested = {
                map: new Map([
                    ['a', new Set([1, 2, 3])],
                    ['b', new Set([4, 5, 6])]
                ]),
                set: new Set([
                    new Map([['x', 1]]),
                    new Map([['y', 2]])
                ])
            };

            const _cloned = clone(nested);
            clonesPerformed++;
        }

        // === Test 18: Mixed type object cloning ===
        for (let i = 0; i < 50; i++) {

            const mixed = {
                string: 'test',
                number: 42,
                boolean: true,
                null: null,
                undefined: undefined,
                array: [1, 2, 3],
                object: { nested: true },
                date: new Date(),
                regex: /pattern/,
                map: new Map([['a', 1]]),
                set: new Set([1, 2, 3])
            };

            const _cloned = clone(mixed);
            clonesPerformed++;
        }

        // Allow microtasks to settle
        await new Promise<void>(resolve => queueMicrotask(resolve));

        context.data.cloneCount += clonesPerformed;
        context.data.mergeCount += mergesPerformed;

        return {
            clonesPerformed,
            mergesPerformed,
            equalChecks,
            circularClones
        };
    },

    teardown(_context: ScenarioContext<CloneContext>) {

        // Nothing to explicitly clean up
    }
};
