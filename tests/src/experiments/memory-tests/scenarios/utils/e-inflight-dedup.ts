/**
 * Scenario E: In-Flight Deduplication
 *
 * Goal: Detect leaks from promise map retention and zombie promise accumulation.
 *
 * What it does:
 * - Tests promise map cleanup on resolution/rejection
 * - Tests rapid create/destroy cycles
 * - Tests zombie promise retention (known limitation)
 * - Tests callback hook retention
 *
 * Pass criteria:
 * - Heap returns to baseline after GC (for resolved/rejected promises)
 * - Promise map empties after all promises settle
 * - Zombie promises accumulate (documents known limitation)
 */

import { withInflightDedup } from '../../../../../../packages/utils/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import { createLargeObject, delay } from './_helpers.ts';

interface InflightDedupContext {

    /** Track created deduped functions */
    dedupedFnCount: number;

    /** Track zombie promises (never resolved) */
    zombieCount: number;
}

export const inflightDedupScenario: Scenario<InflightDedupContext> = {

    name: 'inflight-dedup',
    description: 'Promise map cleanup, rejection handling, and zombie promise detection',

    setup() {

        return {
            dedupedFnCount: 0,
            zombieCount: 0
        };
    },

    async run(_iteration: number, context: ScenarioContext<InflightDedupContext>) {

        let dedupedFnsCreated = 0;
        let promisesResolved = 0;
        let promisesRejected = 0;
        let deduplicatedCalls = 0;

        // === Test 1: Promise map cleanup on resolution ===
        const resolveDedup = withInflightDedup(
            async (id: string) => {

                await delay(5);
                return { id, data: createLargeObject(10) };
            }
        );

        // Fire many concurrent calls with same key
        const resolvePromises: Promise<any>[] = [];

        for (let i = 0; i < 100; i++) {

            resolvePromises.push(resolveDedup('same-key'));
        }

        // All should share one promise
        await Promise.all(resolvePromises);
        promisesResolved += 100;
        deduplicatedCalls += 99; // 99 joined existing

        // Fire with different keys
        for (let i = 0; i < 50; i++) {

            resolvePromises.push(resolveDedup(`key-${i}`));
        }

        await Promise.all(resolvePromises);
        promisesResolved += 50;

        dedupedFnsCreated++;

        // === Test 2: Promise map cleanup on rejection ===
        let rejectCount = 0;
        const rejectDedup = withInflightDedup(
            async (id: string) => {

                rejectCount++;
                await delay(5);
                throw new Error(`Rejection for ${id}: ${'x'.repeat(1000)}`);
            }
        );

        // Fire concurrent calls that will reject
        const rejectPromises: Promise<any>[] = [];

        for (let i = 0; i < 50; i++) {

            rejectPromises.push(
                rejectDedup('reject-key').catch(() => {

                    promisesRejected++;
                })
            );
        }

        await Promise.all(rejectPromises);
        deduplicatedCalls += 49; // 49 joined existing

        dedupedFnsCreated++;

        // === Test 3: Rapid create/destroy cycles ===
        for (let i = 0; i < 100; i++) {

            const tempDedup = withInflightDedup(
                async (x: number) => {

                    await delay(1);
                    return x * 2;
                }
            );

            // Use it briefly
            await tempDedup(i);
            promisesResolved++;

            dedupedFnsCreated++;
        }

        // Functions go out of scope - internal maps should be GC'd

        // === Test 4: Hook retention test ===
        let hookStartCalls = 0;
        let hookJoinCalls = 0;
        let hookResolveCalls = 0;
        const largeHookContext = createLargeObject(50);

        const hookDedup = withInflightDedup(
            async (id: string) => {

                await delay(5);
                return id;
            },
            {
                hooks: {
                    onStart: () => {

                        hookStartCalls++;
                        // Capture large context (shouldn't leak)
                        const _ = largeHookContext.key_0;
                    },
                    onJoin: () => hookJoinCalls++,
                    onResolve: () => hookResolveCalls++
                }
            }
        );

        // Fire concurrent calls
        const hookPromises: Promise<any>[] = [];

        for (let i = 0; i < 30; i++) {

            hookPromises.push(hookDedup('hook-key'));
        }

        await Promise.all(hookPromises);
        promisesResolved += 30;
        deduplicatedCalls += 29;

        dedupedFnsCreated++;

        // === Test 5: Key collision test ===
        // Using default serializer with objects that produce same key
        const collisionDedup = withInflightDedup(
            async (obj: { id: number }) => {

                await delay(5);
                return obj.id * 2;
            }
        );

        const collisionPromises: Promise<any>[] = [];

        // Same object structure = same key
        for (let i = 0; i < 20; i++) {

            collisionPromises.push(collisionDedup({ id: 42 }));
        }

        await Promise.all(collisionPromises);
        promisesResolved += 20;
        deduplicatedCalls += 19;

        dedupedFnsCreated++;

        // === Test 6: Custom key function ===
        const customKeyDedup = withInflightDedup(
            async (obj: { id: number; timestamp: number }) => {

                await delay(5);
                return obj.id;
            },
            {
                keyFn: (obj) => `id-${obj.id}` // Ignore timestamp
            }
        );

        const customKeyPromises: Promise<any>[] = [];

        // Different timestamps but same id = same key
        for (let i = 0; i < 20; i++) {

            customKeyPromises.push(
                customKeyDedup({ id: 1, timestamp: Date.now() + i })
            );
        }

        await Promise.all(customKeyPromises);
        promisesResolved += 20;
        deduplicatedCalls += 19;

        dedupedFnsCreated++;

        // === Test 7: Zombie promise detection (known limitation) ===
        // This documents the behavior - zombie promises stay in map forever
        // We create a few but don't await them
        let zombiesCreated = 0;

        // Note: We intentionally limit this test because zombies WILL leak
        // This is to document the limitation, not to stress it
        if (_iteration === 1) {

            // Only on first iteration, create a few zombies to document behavior
            const zombieDedup = withInflightDedup(
                async (_id: string) => {

                    // Promise that never resolves
                    await new Promise(() => {});
                    return 'never';
                }
            );

            // Fire a zombie - intentionally not awaited
            zombieDedup('zombie-1');
            zombiesCreated++;
            context.data.zombieCount++;

            // Note: This promise will stay in the internal map forever
            // because it never resolves. This is a known limitation.
        }

        // Allow microtasks to settle
        await new Promise<void>(resolve => queueMicrotask(resolve));

        context.data.dedupedFnCount += dedupedFnsCreated;

        return {
            dedupedFnsCreated,
            promisesResolved,
            promisesRejected,
            deduplicatedCalls,
            hookStartCalls,
            hookJoinCalls,
            hookResolveCalls,
            zombiesCreated
        };
    },

    teardown(_context: ScenarioContext<InflightDedupContext>) {

        // Nothing to explicitly clean up
        // Note: Any zombie promises created will have leaked - this is documented
    }
};
