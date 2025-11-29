/**
 * Scenario C: Circuit Breaker
 *
 * Goal: Detect leaks from circuit breaker state stores and callback retention.
 *
 * What it does:
 * - Creates/destroys many circuit breakers to test store GC
 * - Tests state cycling (trip/reset) memory behavior
 * - Tests callback retention (onTripped, onReset, etc.)
 * - Tests CircuitBreakerError object accumulation
 *
 * Pass criteria:
 * - Heap returns to baseline after GC
 * - CircuitBreakerStore instances are garbage collected
 * - Callbacks don't retain references after function is unreferenced
 * - Error objects don't accumulate
 */

import {
    circuitBreaker,
    circuitBreakerSync,
    CircuitBreakerError,
    isCircuitBreakerError
} from '../../../../../../packages/utils/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import { createLargeObject } from './_helpers.ts';

interface CircuitBreakerContext {

    /** Track created breakers */
    breakerCount: number;

    /** Track errors thrown */
    errorCount: number;
}

export const circuitBreakerScenario: Scenario<CircuitBreakerContext> = {

    name: 'circuit-breaker',
    description: 'State store GC, callback retention, and error accumulation in circuit breaker',

    setup() {

        return {
            breakerCount: 0,
            errorCount: 0
        };
    },

    async run(iteration: number, context: ScenarioContext<CircuitBreakerContext>) {

        let breakersCreated = 0;
        let tripsTriggered = 0;
        let resetsTriggered = 0;
        let errorsThrown = 0;

        // === Test 1: Create/destroy many circuit breakers ===
        // Each breaker creates a CircuitBreakerStore - verify it's GC'd
        for (let i = 0; i < 100; i++) {

            let callCount = 0;
            const breaker = circuitBreakerSync(
                () => {

                    callCount++;

                    if (callCount % 2 === 0) {

                        throw new Error('Simulated failure');
                    }

                    return 'success';
                },
                {
                    maxFailures: 3,
                    resetAfter: 10
                }
            );

            // Use the breaker a few times
            for (let j = 0; j < 5; j++) {

                try {

                    breaker();
                }
                catch {

                    errorsThrown++;
                }
            }

            breakersCreated++;
        }

        // Breakers go out of scope here - stores should be eligible for GC

        // === Test 2: State cycling memory (trip/reset many times) ===
        let tripCount = 0;
        let failureCount = 0;

        const cyclingBreaker = circuitBreakerSync(
            () => {

                failureCount++;

                if (failureCount <= 3) {

                    throw new Error('Trip me');
                }

                return 'recovered';
            },
            {
                maxFailures: 3,
                resetAfter: 1, // Very short reset time
                onTripped: () => tripCount++,
                onReset: () => resetsTriggered++
            }
        );

        // Cycle through trip/reset 100 times
        for (let cycle = 0; cycle < 100; cycle++) {

            failureCount = 0;

            // Trip the breaker
            for (let i = 0; i < 4; i++) {

                try {

                    cyclingBreaker();
                }
                catch (err) {

                    if (isCircuitBreakerError(err)) {

                        tripsTriggered++;
                    }

                    errorsThrown++;
                }
            }

            // Wait for reset
            await new Promise(resolve => setTimeout(resolve, 2));

            // Reset by successful call (after resetAfter time passes)
            failureCount = 10; // Skip failures

            try {

                cyclingBreaker();
            }
            catch {

                errorsThrown++;
            }
        }

        breakersCreated++;

        // === Test 3: Callback with large object capture ===
        // Test that callbacks capturing large objects are released
        const largeCapture = createLargeObject(100); // 100KB object

        const captureBreaker = circuitBreakerSync(
            () => {

                throw new Error('Always fail');
            },
            {
                maxFailures: 1,
                resetAfter: 1000,
                onTripped: () => {

                    // Capture large object in callback
                    const _ = largeCapture.key_0;
                },
                onError: () => {

                    // Capture large object
                    const _ = largeCapture.key_1;
                }
            }
        );

        // Trip the breaker
        try {

            captureBreaker();
        }
        catch {

            errorsThrown++;
        }

        breakersCreated++;

        // === Test 4: Async circuit breaker ===
        let asyncFailures = 0;
        const asyncBreaker = circuitBreaker(
            async () => {

                asyncFailures++;

                if (asyncFailures <= 2) {

                    throw new Error('Async failure');
                }

                return 'async success';
            },
            {
                maxFailures: 2,
                resetAfter: 10
            }
        );

        // Trip and reset
        for (let i = 0; i < 5; i++) {

            try {

                await asyncBreaker();
            }
            catch {

                errorsThrown++;
            }
        }

        breakersCreated++;

        // === Test 5: CircuitBreakerError accumulation ===
        // Create many errors, verify they don't leak
        const errorBreaker = circuitBreakerSync(
            () => {

                throw new Error('Fail');
            },
            { maxFailures: 1, resetAfter: 1 }
        );

        const errors: CircuitBreakerError[] = [];

        // Trip once
        try {

            errorBreaker();
        }
        catch {

            errorsThrown++;
        }

        // Generate many CircuitBreakerErrors
        for (let i = 0; i < 1000; i++) {

            try {

                errorBreaker();
            }
            catch (err) {

                if (isCircuitBreakerError(err)) {

                    errors.push(err);
                }

                errorsThrown++;
            }
        }

        // Release error references
        errors.length = 0;

        breakersCreated++;

        // Allow microtasks to settle
        await new Promise<void>(resolve => queueMicrotask(resolve));

        context.data.breakerCount += breakersCreated;
        context.data.errorCount += errorsThrown;

        return {
            breakersCreated,
            tripsTriggered,
            resetsTriggered,
            errorsThrown
        };
    },

    teardown(context: ScenarioContext<CircuitBreakerContext>) {

        // Nothing to explicitly clean up - breakers are GC'd when out of scope
    }
};
