/**
 * Scenario D: Rate Limit
 *
 * Goal: Detect leaks from rate limiter statistics and waiting promise cleanup.
 *
 * What it does:
 * - Creates/destroys many RateLimitTokenBucket instances
 * - Tests statistics counter stability over millions of requests
 * - Tests waitAndConsume promise cleanup
 * - Tests abort cleanup during wait
 *
 * Pass criteria:
 * - Heap returns to baseline after GC
 * - Statistics counters don't cause unbounded growth
 * - Waiting promises are cleaned up
 * - AbortController abort properly releases wait promises
 */

import {
    rateLimit,
    RateLimitTokenBucket,
    RateLimitError
} from '../../../../../../packages/utils/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';

interface RateLimitContext {

    /** Track buckets created */
    bucketCount: number;

    /** Track total requests made */
    totalRequests: number;
}

export const rateLimitScenario: Scenario<RateLimitContext> = {

    name: 'rate-limit',
    description: 'Statistics stability, bucket cleanup, and wait promise cleanup in rate limiting',

    setup() {

        return {
            bucketCount: 0,
            totalRequests: 0
        };
    },

    async run(_iteration: number, context: ScenarioContext<RateLimitContext>) {

        let bucketsCreated = 0;
        let requestsMade = 0;
        let rejections = 0;
        let waitsAborted = 0;

        // === Test 1: Create/destroy many token buckets ===
        for (let i = 0; i < 100; i++) {

            const bucket = new RateLimitTokenBucket(10, 100);

            // Consume some tokens
            for (let j = 0; j < 15; j++) {

                if (bucket.consume()) {

                    requestsMade++;
                }
                else {

                    rejections++;
                }
            }

            // Get snapshot (triggers refill calculation)
            const _snapshot = bucket.snapshot;

            bucketsCreated++;
        }

        // Buckets go out of scope - should be GC'd

        // === Test 2: Statistics counter stability ===
        // Single bucket with many requests - verify stats don't cause memory issues
        const statsBucket = new RateLimitTokenBucket(1000, 1); // High capacity

        for (let i = 0; i < 10000; i++) {

            statsBucket.consume();
            requestsMade++;
        }

        const stats = statsBucket.snapshot;
        bucketsCreated++;

        // Verify stats are tracking correctly
        const _totalTracked = stats.totalRequests;
        const _rejectedTracked = stats.rejectedRequests;

        // === Test 3: waitAndConsume promise cleanup ===
        const waitBucket = new RateLimitTokenBucket(5, 10); // 5 tokens, 10ms per token

        // Exhaust tokens
        for (let i = 0; i < 5; i++) {

            waitBucket.consume();
            requestsMade++;
        }

        // Create multiple waiting promises
        const waitPromises: Promise<boolean>[] = [];

        for (let i = 0; i < 10; i++) {

            waitPromises.push(waitBucket.waitAndConsume());
        }

        // Wait for all to complete
        await Promise.all(waitPromises);
        requestsMade += 10;

        bucketsCreated++;

        // === Test 4: Abort cleanup during wait ===
        const abortBucket = new RateLimitTokenBucket(1, 1000); // 1 token, 1s per token

        // Exhaust token
        abortBucket.consume();
        requestsMade++;

        // Start multiple waits with abort controllers
        const abortPromises: Promise<boolean>[] = [];
        const controllers: AbortController[] = [];

        for (let i = 0; i < 20; i++) {

            const controller = new AbortController();
            controllers.push(controller);

            abortPromises.push(
                abortBucket.waitAndConsume(1, { abortController: controller })
            );
        }

        // Abort all immediately
        controllers.forEach(c => c.abort());
        waitsAborted += controllers.length;

        // Wait for all aborted promises to settle
        const abortResults = await Promise.all(abortPromises);
        const actualAborts = abortResults.filter(r => r === false).length;

        bucketsCreated++;

        // === Test 5: rateLimit wrapper function ===
        let fnCallCount = 0;
        const rateLimitedFn = rateLimit(
            async (x: number) => {

                fnCallCount++;
                return x * 2;
            },
            {
                maxCalls: 10,
                windowMs: 100,
                throws: false
            }
        );

        // Call rapidly
        const fnPromises: Promise<number>[] = [];

        for (let i = 0; i < 50; i++) {

            fnPromises.push(rateLimitedFn(i));
        }

        await Promise.all(fnPromises);
        requestsMade += 50;

        // === Test 6: rateLimit with onLimitReached callback ===
        let limitReachedCount = 0;
        const callbackRateLimited = rateLimit(
            async (x: number) => x,
            {
                maxCalls: 5,
                windowMs: 100,
                throws: false,
                onLimitReached: () => limitReachedCount++
            }
        );

        const cbPromises: Promise<number>[] = [];

        for (let i = 0; i < 20; i++) {

            cbPromises.push(callbackRateLimited(i));
        }

        await Promise.all(cbPromises);
        requestsMade += 20;

        // === Test 7: Long-running bucket stability ===
        // Simulate continuous usage pattern
        const longRunningBucket = new RateLimitTokenBucket(100, 1);

        for (let cycle = 0; cycle < 100; cycle++) {

            // Burst consume
            for (let i = 0; i < 50; i++) {

                longRunningBucket.consume();
                requestsMade++;
            }

            // Reset bucket
            longRunningBucket.reset();
        }

        bucketsCreated++;

        // Allow microtasks to settle
        await new Promise<void>(resolve => queueMicrotask(resolve));

        context.data.bucketCount += bucketsCreated;
        context.data.totalRequests += requestsMade;

        return {
            bucketsCreated,
            requestsMade,
            rejections,
            waitsAborted,
            actualAbortsReceived: actualAborts,
            limitReachedCallbacks: limitReachedCount,
            fnCallsExecuted: fnCallCount
        };
    },

    teardown(_context: ScenarioContext<RateLimitContext>) {

        // Nothing to explicitly clean up - buckets are GC'd when out of scope
    }
};
