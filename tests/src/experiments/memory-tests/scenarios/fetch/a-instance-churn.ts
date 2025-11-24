/**
 * Scenario A: Instance Churn
 *
 * Goal: Detect memory leaks from FetchEngine instance creation and destruction.
 *
 * What it does:
 * - Creates and destroys many FetchEngine instances
 * - Tests that internal state is properly cleared on destroy()
 * - Tests closure cleanup in modifyOptions/validate
 *
 * Pass criteria:
 * - Heap returns to baseline after GC
 * - No lingering references to destroyed instances
 *
 * ## Note on GC Recovery Rate
 *
 * This test may show <90% GC recovery due to Node.js undici's HTTP
 * connection pooling, NOT a FetchEngine leak. Each HTTP request adds
 * ~2-3 KB to undici's internal connection pool and request metadata.
 * This is expected behavior for HTTP client performance optimization.
 *
 * The diagnostic scenario (z-diagnostic.ts) confirms that EventTarget,
 * FetchEvent, and FetchEngine's internal state ARE properly garbage
 * collected. The retained memory is from undici, not our code.
 */

import { FetchEngine } from '../../../../../../packages/fetch/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import {
    TestServer,
    BASE_URL,
    createLargePayload,
    createHeaders,
    createParams
} from './_helpers.ts';

interface InstanceChurnContext {

    /** Test server instance */
    server: TestServer;
}

export const instanceChurn: Scenario<InstanceChurnContext> = {

    name: 'instance-churn',
    description: 'FetchEngine instance creation, configuration, and destruction lifecycle',

    async setup() {

        const server = new TestServer();

        await server.start();

        return { server };
    },

    async run(iteration: number, context: ScenarioContext<InstanceChurnContext>) {

        let instancesCreated = 0;
        let instancesDestroyed = 0;
        let requestsMade = 0;

        // === Test 1: Basic instance with requests ===
        {
            for (let i = 0; i < 50; i++) {

                const engine = new FetchEngine({
                    baseUrl: BASE_URL,
                    defaultType: 'json',
                    headers: createHeaders(10),
                    params: createParams(5),
                    timeout: 5000
                });

                instancesCreated++;

                await engine.get('/success');
                requestsMade++;

                engine.destroy();
                instancesDestroyed++;
            }
        }

        context.gc(); // Force GC to check for leaks

        // === Test 2: Instance with large state ===
        {
            for (let i = 0; i < 30; i++) {

                const engine = new FetchEngine({
                    baseUrl: BASE_URL
                });

                engine.setState({
                    token: `token-${i}-${Date.now()}`,
                    user: { id: i, data: createLargePayload(5) },
                    session: { created: Date.now(), expires: Date.now() + 3600000 }
                } as any);

                instancesCreated++;

                engine.resetState();
                engine.destroy();
                instancesDestroyed++;
            }
        }

        context.gc(); // Force GC to check for leaks

        // === Test 3: Instance with modifyOptions (closures with large data) ===
        // This tests whether destroy() properly clears #modifyOptions references
        {
            for (let i = 0; i < 20; i++) {

                const largeData = createLargePayload(20);

                const engine = new FetchEngine({
                    baseUrl: BASE_URL,
                    modifyOptions: (opts) => {

                        // Closure captures largeData - if destroy() doesn't clear
                        // #modifyOptions, this 20KB object stays in memory
                        if (largeData) {
                            opts.headers = { ...opts.headers, 'X-Custom': 'value' };
                        }

                        return opts;
                    }
                });

                instancesCreated++;

                await engine.get('/echo');
                requestsMade++;

                engine.destroy();
                instancesDestroyed++;
            }
        }

        context.gc(); // Force GC to check for leaks

        // === Test 4: Instance with validate functions (closures) ===
        // This tests whether destroy() properly clears #validate references
        {
            for (let i = 0; i < 20; i++) {

                const capturedSet = new Set(Array.from({ length: 1000 }, (_, j) => `header-${j}`));

                const engine = new FetchEngine({
                    baseUrl: BASE_URL,
                    validate: {
                        headers: (headers) => {

                            // Closure captures capturedSet
                            for (const key of Object.keys(headers)) {
                                capturedSet.has(key);
                            }
                        }
                    }
                });

                instancesCreated++;

                engine.addHeader('Authorization', 'Bearer token');

                engine.destroy();
                instancesDestroyed++;
            }
        }

        context.gc(); // Force GC to check for leaks

        // === Test 5: Rapid create/destroy (no closures) ===
        {
            for (let i = 0; i < 100; i++) {

                const engine = new FetchEngine({
                    baseUrl: BASE_URL,
                    headers: { 'X-Iteration': String(i) }
                });

                instancesCreated++;

                engine.destroy();
                instancesDestroyed++;
            }
        }

        // Allow microtasks to settle
        await new Promise<void>(resolve => queueMicrotask(resolve));

        context.gc(); // Force GC to check for leaks

        return {
            instancesCreated,
            instancesDestroyed,
            requestsMade
        };
    },

    async teardown(context: ScenarioContext<InstanceChurnContext>) {

        await context.data.server.stop();
    }
};
