/**
 * Utils Memory Test Helpers
 *
 * Shared utilities for @logosdx/utils memory testing scenarios.
 */

/**
 * Creates a large object for testing memory retention.
 * Uses nested structure to increase memory footprint.
 */
export function createLargeObject(sizeKb: number = 100): Record<string, unknown> {

    const obj: Record<string, unknown> = {};
    const charsPerKey = 100;
    const keysNeeded = Math.ceil((sizeKb * 1024) / charsPerKey);

    for (let i = 0; i < keysNeeded; i++) {

        obj[`key_${i}`] = 'x'.repeat(charsPerKey);
    }

    return obj;
}

/**
 * Creates a large array for testing memory retention.
 */
export function createLargeArray(length: number = 10000): number[] {

    return Array.from({ length }, (_, i) => i);
}

/**
 * Creates a deeply nested object for testing clone/merge operations.
 */
export function createDeepObject(depth: number = 10, breadth: number = 5): Record<string, unknown> {

    if (depth === 0) {

        return { value: Math.random() };
    }

    const obj: Record<string, unknown> = {};

    for (let i = 0; i < breadth; i++) {

        obj[`child_${i}`] = createDeepObject(depth - 1, breadth);
    }

    return obj;
}

/**
 * Creates an object with circular references for testing clone safety.
 */
export function createCircularObject(): Record<string, unknown> {

    const obj: Record<string, unknown> = {
        name: 'root',
        children: []
    };

    const child1 = { name: 'child1', parent: obj };
    const child2 = { name: 'child2', parent: obj, sibling: child1 };

    (child1 as any).sibling = child2;
    (obj.children as any[]).push(child1, child2);
    obj.self = obj;

    return obj;
}

/**
 * Waits for a specified number of milliseconds.
 */
export function delay(ms: number): Promise<void> {

    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generates unique keys for cache testing.
 */
export function generateUniqueKey(prefix: string, index: number): string {

    return `${prefix}_${index}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Stats interface for utils scenarios (generic placeholder).
 */
export interface UtilsStats {

    /** Custom metric count */
    customCount?: number;

    /** Cache size if applicable */
    cacheSize?: number;

    /** Timer count if applicable */
    timerCount?: number;

    /** Promise count if applicable */
    promiseCount?: number;
}

/**
 * Returns empty stats (utils don't have a shared stats interface like observer).
 */
export function getUtilsStats(): UtilsStats {

    return {};
}
