/**
 * Scenario D: Abort and Timeout Cleanup
 *
 * Goal: Detect memory leaks from AbortController and timeout handling.
 *
 * What it does:
 * - Tests that aborted requests clean up properly
 * - Tests that timeouts are cleared in all code paths
 * - Tests AbortController lifecycle
 * - Tests error handling doesn't leak memory
 *
 * Pass criteria:
 * - Heap returns to baseline after GC
 * - No lingering timeout handles
 * - AbortController references are released
 */

import { FetchEngine } from '../../../../../../packages/fetch/src/index.ts';
import { attempt } from '../../../../../../packages/utils/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import {
    TestServer,
    BASE_URL,
    createLargePayload
} from './_helpers.ts';

interface AbortTimeoutContext {

    /** Test server instance */
    server: TestServer;
}

export const abortTimeout: Scenario<AbortTimeoutContext> = {

    name: 'abort-timeout',
    description: 'AbortController, timeout, and error handling memory cleanup verification',

    async setup() {

        const server = new TestServer();

        await server.start();

        return { server };
    },

    async run(iteration: number, context: ScenarioContext<AbortTimeoutContext>) {

        let aborted = 0;
        let timedOut = 0;
        let successful = 0;
        let errors = 0;

        // === Test 1: Manual abort using request.abort() ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL
            });

            for (let i = 0; i < 20; i++) {

                const request = engine.get('/delay/100');
                request.abort('User cancelled');

                const [, err] = await attempt(() => request);

                if (err) aborted++;
            }

            engine.destroy();
        }

        context.gc(); // Force GC to check for leaks

        // === Test 2: Timeout handling ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL,
                timeout: 5
            });

            for (let i = 0; i < 10; i++) {

                const [, err] = await attempt(() => engine.get('/delay/100'));

                if (err) timedOut++;
            }

            engine.destroy();
        }

        context.gc(); // Force GC to check for leaks

        // === Test 3: Successful requests with timeout configured ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL,
                timeout: 5000
            });

            for (let i = 0; i < 30; i++) {

                const [res, err] = await attempt(() => engine.get('/success'));

                if (!err && res) successful++;
            }

            engine.destroy();
        }

        context.gc(); // Force GC to check for leaks

        // === Test 4: AbortController churn ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL
            });

            for (let i = 0; i < 50; i++) {

                const controller = new AbortController();
                const [res, err] = await attempt(() =>
                    engine.get('/success', { abortController: controller })
                );

                if (!err && res) successful++;
            }

            engine.destroy();
        }

        context.gc(); // Force GC to check for leaks

        // === Test 5: Error scenarios ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL
            });

            for (let i = 0; i < 30; i++) {

                const [, err] = await attempt(() => engine.get('/error/500'));

                if (err) errors++;
            }

            engine.destroy();
        }

        context.gc(); // Force GC to check for leaks

        // === Test 6: Mixed abort patterns ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL
            });

            // Start concurrent requests, abort half
            const promises: Array<Promise<void>> = [];

            for (let i = 0; i < 10; i++) {

                const request = engine.get('/delay/50');

                if (i < 5) {
                    request.abort('Batch abort');
                }

                promises.push(
                    attempt(() => request).then(([res, err]) => {

                        if (err) aborted++;
                        else if (res) successful++;
                    })
                );
            }

            await Promise.all(promises);

            engine.destroy();
        }

        context.gc(); // Force GC to check for leaks

        // === Test 7: Request with lifecycle callbacks ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL
            });

            for (let i = 0; i < 20; i++) {

                const largeData = createLargePayload(20);

                const [res, err] = await attempt(() =>
                    engine.get('/success', {
                        onBeforeReq: () => {

                            // Reference largeData to test closure cleanup
                            void largeData;
                        },
                        onAfterReq: () => {

                            void largeData;
                        },
                        onError: () => {

                            void largeData;
                        }
                    })
                );

                if (!err && res) successful++;
            }

            engine.destroy();
        }

        context.gc(); // Force GC to check for leaks

        // === Test 8: Retry with server errors ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL,
                retry: {
                    maxAttempts: 3,
                    baseDelay: 10,
                    shouldRetry: (error) => error.status === 500
                }
            });

            for (let i = 0; i < 5; i++) {

                const [res, err] = await attempt(() => engine.get('/error/500'));

                if (!err && res) successful++;
                else if (err) errors++;
            }

            engine.destroy();
        }

        context.gc(); // Force GC to check for leaks

        // === Test 9: Large response handling ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL
            });

            for (let i = 0; i < 10; i++) {

                const [res, err] = await attempt(() => engine.get('/large/50'));

                if (!err && res) successful++;
            }

            engine.destroy();
        }

        // Allow microtasks to settle
        await new Promise<void>(resolve => queueMicrotask(resolve));

        context.gc(); // Force GC to check for leaks

        return {
            abortedRequests: aborted,
            timedOutRequests: timedOut,
            successfulRequests: successful,
            errors
        };
    },

    async teardown(context: ScenarioContext<AbortTimeoutContext>) {

        await context.data.server.stop();
    }
};
