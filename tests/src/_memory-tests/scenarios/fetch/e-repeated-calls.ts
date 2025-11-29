/**
 * Scenario E: Repeated Calls Against Single Instance
 *
 * Goal: Detect memory accumulation from repeated API calls on a single instance.
 *
 * What it does:
 * - Creates ONE FetchEngine instance at setup
 * - Each iteration makes many API calls against that instance
 * - Tests if request/response handling accumulates memory over time
 *
 * This catches leaks in:
 * - Event dispatching (fetch-before, fetch-after, fetch-response events)
 * - Request/response object handling
 * - Internal caching or state accumulation
 * - AbortController/timeout cleanup per request
 *
 * Pass criteria:
 * - Heap returns to baseline after GC between iterations
 * - No upward trend in memory usage across iterations
 *
 * ## Note on Memory Retention
 *
 * Some memory retention (~2-3 KB per request) is expected due to Node.js
 * undici's HTTP connection pooling. This is performance optimization,
 * not a leak. The diagnostic scenario confirms FetchEngine's event system
 * and internal state are properly garbage collected.
 */

import { FetchEngine } from '../../../../../../packages/fetch/src/index.ts';
import { attempt } from '../../../../../../packages/utils/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import {
    TestServer,
    BASE_URL,
    createLargePayload
} from './_helpers.ts';

interface RepeatedCallsContext {

    /** Test server instance */
    server: TestServer;

    /** Single FetchEngine instance used across all iterations */
    engine: FetchEngine;
}

export const repeatedCalls: Scenario<RepeatedCallsContext> = {

    name: 'repeated-calls',
    description: 'Repeated API calls against single instance to detect request handling leaks',

    async setup() {

        const server = new TestServer();

        await server.start();

        // Create ONE instance that persists across all iterations
        const engine = new FetchEngine({
            baseUrl: BASE_URL,
            defaultType: 'json',
            timeout: 5000
        });

        return { server, engine };
    },

    async run(iteration: number, context: ScenarioContext<RepeatedCallsContext>) {

        const { engine } = context.data;

        let successful = 0;
        let errors = 0;

        // === Test 1: Many GET requests ===
        {
            for (let i = 0; i < 50; i++) {

                const [res, err] = await attempt(() => engine.get('/success'));

                if (!err && res) successful++;
                else errors++;
            }
        }

        gc?.(); // Force GC to check for leaks

        // === Test 2: Many POST requests with payloads ===
        {
            for (let i = 0; i < 30; i++) {

                const payload = {
                    id: i,
                    data: `iteration-${iteration}-request-${i}`,
                    timestamp: Date.now()
                };

                const [res, err] = await attempt(() => engine.post('/echo', payload));

                if (!err && res) successful++;
                else errors++;
            }
        }

        context.gc(); // Force GC to check for leaks

        // === Test 3: Requests with large payloads ===
        {
            for (let i = 0; i < 10; i++) {

                const largePayload = createLargePayload(50); // 50KB each

                const [res, err] = await attempt(() => engine.post('/echo', largePayload));

                if (!err && res) successful++;
                else errors++;
            }
        }

        context.gc(); // Force GC to check for leaks

        // === Test 4: Requests fetching large responses ===
        {
            for (let i = 0; i < 10; i++) {

                const [res, err] = await attempt(() => engine.get('/large/100')); // 100KB response

                if (!err && res) successful++;
                else errors++;
            }
        }

        context.gc(); // Force GC to check for leaks

        // === Test 5: Mixed methods ===
        {
            const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;

            for (let i = 0; i < 20; i++) {

                const method = methods[i % methods.length];

                const [res, err] = await attempt(() => {

                    if (method === 'get') {
                        return engine.get('/success');
                    }

                    return engine[method!]('/echo', { index: i });
                });

                if (!err && res) successful++;
                else errors++;
            }
        }

        context.gc(); // Force GC to check for leaks

        // === Test 6: Requests with per-request options ===
        {
            for (let i = 0; i < 20; i++) {

                const [res, err] = await attempt(() =>
                    engine.get('/success', {
                        headers: { 'X-Request-Index': String(i) },
                        params: { iteration: String(iteration), index: String(i) },
                        timeout: 3000
                    })
                );

                if (!err && res) successful++;
                else errors++;
            }
        }

        context.gc(); // Force GC to check for leaks

        // === Test 7: Requests with lifecycle callbacks ===
        {
            for (let i = 0; i < 20; i++) {

                let beforeCalled = false;
                let afterCalled = false;

                const [res, err] = await attempt(() =>
                    engine.get('/success', {
                        onBeforeReq: () => { beforeCalled = true; },
                        onAfterReq: () => { afterCalled = true; }
                    })
                );

                if (!err && res && beforeCalled && afterCalled) successful++;
                else errors++;
            }
        }

        context.gc(); // Force GC to check for leaks

        // === Test 8: Error responses (don't accumulate error objects) ===
        {
            for (let i = 0; i < 10; i++) {

                const [, err] = await attempt(() => engine.get('/error/500'));

                if (err) errors++;
            }
        }

        // Allow microtasks to settle
        await new Promise<void>(resolve => queueMicrotask(resolve));

        context.gc(); // Force GC to check for leaks

        return {
            successful,
            errors,
            totalRequests: successful + errors
        };
    },

    async teardown(context: ScenarioContext<RepeatedCallsContext>) {

        // Destroy the engine at the end
        context.data.engine.destroy();

        await context.data.server.stop();
    },

    getStats(context: ScenarioContext<RepeatedCallsContext>) {

        return {
            serverRequests: context.data.server.requestCount
        };
    }
};
