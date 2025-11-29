/**
 * Scenario C: State, Headers, and Params Churn
 *
 * Goal: Detect memory leaks from repeated state, header, and param operations.
 *
 * What it does:
 * - Repeatedly adds/removes headers and params
 * - Tests setState/resetState cycles
 * - Tests method-specific headers and params
 * - Tests that internal maps don't grow unbounded
 *
 * Pass criteria:
 * - Heap returns to baseline after GC
 * - Internal header/param maps maintain expected size
 * - State objects are properly replaced, not accumulated
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

interface StateHeadersParamsContext {

    /** Test server instance */
    server: TestServer;

    /** Track state operations */
    stateOperations: number;

    /** Track header operations */
    headerOperations: number;

    /** Track param operations */
    paramOperations: number;
}

export const stateHeadersParams: Scenario<StateHeadersParamsContext> = {

    name: 'state-headers-params',
    description: 'Header, param, and state management churn for memory accumulation detection',

    async setup() {

        const server = new TestServer();

        await server.start();

        return {
            server,
            stateOperations: 0,
            headerOperations: 0,
            paramOperations: 0
        };
    },

    async run(iteration: number, context: ScenarioContext<StateHeadersParamsContext>) {

        let stateOps = 0;
        let headerOps = 0;
        let paramOps = 0;

        // === Test 1: Header add/remove cycles ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL
            });

            // Add many headers
            for (let i = 0; i < 100; i++) {

                engine.addHeader(`X-Header-${i}`, `value-${i}`);
                headerOps++;
            }

            // Remove all headers
            for (let i = 0; i < 100; i++) {

                engine.removeHeader(`X-Header-${i}`);
                headerOps++;
            }

            // Add headers as object
            engine.addHeader(createHeaders(50));
            headerOps++;

            // Remove headers as array
            const headerNames = Array.from({ length: 50 }, (_, i) => `X-Custom-Header-${i}`);
            engine.removeHeader(headerNames);
            headerOps++;

            engine.destroy();
        }

        // === Test 2: Method-specific headers ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL
            });

            const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

            for (const method of methods) {

                // Add method-specific headers
                for (let i = 0; i < 20; i++) {

                    engine.addHeader(`X-${method}-Header-${i}`, `value-${i}`, method);
                    headerOps++;
                }

                // Remove method-specific headers
                for (let i = 0; i < 20; i++) {

                    engine.removeHeader(`X-${method}-Header-${i}`, method);
                    headerOps++;
                }
            }

            engine.destroy();
        }

        // === Test 3: Param add/remove cycles ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL
            });

            // Add many params
            for (let i = 0; i < 100; i++) {

                engine.addParam(`param_${i}`, `value-${i}`);
                paramOps++;
            }

            // Remove all params
            for (let i = 0; i < 100; i++) {

                engine.removeParam(`param_${i}`);
                paramOps++;
            }

            // Add params as object
            engine.addParam(createParams(50));
            paramOps++;

            // Remove params as array
            const paramNames = Array.from({ length: 50 }, (_, i) => `param_${i}`);
            engine.removeParam(paramNames);
            paramOps++;

            engine.destroy();
        }

        // === Test 4: Method-specific params ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL
            });

            const methods = ['GET', 'POST', 'PUT', 'DELETE'] as const;

            for (const method of methods) {

                // Add method-specific params
                for (let i = 0; i < 20; i++) {

                    engine.addParam(`${method.toLowerCase()}_param_${i}`, `value-${i}`, method);
                    paramOps++;
                }

                // Remove method-specific params
                for (let i = 0; i < 20; i++) {

                    engine.removeParam(`${method.toLowerCase()}_param_${i}`, method);
                    paramOps++;
                }
            }

            engine.destroy();
        }

        // === Test 5: State set/reset cycles ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL
            });

            for (let cycle = 0; cycle < 50; cycle++) {

                // Set state with large data
                engine.setState({
                    token: `token-${cycle}-${Date.now()}`,
                    user: createLargePayload(10),
                    session: {
                        id: `session-${cycle}`,
                        data: createLargePayload(5)
                    }
                } as any);

                stateOps++;

                // Reset state
                engine.resetState();
                stateOps++;
            }

            engine.destroy();
        }

        // === Test 6: State property updates ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL
            });

            // Set individual properties
            for (let i = 0; i < 100; i++) {

                engine.setState(`property_${i}` as any, {
                    value: i,
                    data: createLargePayload(2)
                });

                stateOps++;
            }

            // Get state to verify
            const state = engine.getState();
            stateOps++;

            // Reset and destroy
            engine.resetState();
            stateOps++;

            engine.destroy();
        }

        // === Test 7: hasHeader/hasParam checks ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL,
                headers: createHeaders(20),
                params: createParams(20)
            });

            // Check headers existence repeatedly
            for (let i = 0; i < 100; i++) {

                engine.hasHeader(`X-Custom-Header-${i % 20}`);
                engine.hasParam(`param_${i % 20}`);
            }

            engine.destroy();
        }

        // === Test 8: URL and modifyOptions changes ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL
            });

            for (let i = 0; i < 50; i++) {

                // Change base URL
                engine.changeBaseUrl(`http://localhost:${4123 + (i % 10)}`);

                // Change modifyOptions
                const capturedI = i;
                engine.changeModifyOptions((opts, state) => {

                    if (capturedI >= 0) {
                        opts.headers = { ...opts.headers, 'X-Iteration': String(capturedI) };
                    }

                    return opts;
                });

                // Clear modifyOptions
                engine.changeModifyOptions(undefined);
            }

            engine.destroy();
        }

        // === Test 9: Method-specific modifyOptions changes ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL
            });

            const methods = ['GET', 'POST', 'PUT', 'DELETE'] as const;

            for (let i = 0; i < 20; i++) {

                for (const method of methods) {

                    const capturedI = i;

                    engine.changeModifyMethodOptions(method, (opts, state) => {

                        if (capturedI >= 0) {
                            opts.headers = { ...opts.headers, 'X-Method-Iteration': String(capturedI) };
                        }

                        return opts;
                    });
                }
            }

            // Clear all method options
            for (const method of methods) {

                engine.changeModifyMethodOptions(method, undefined);
            }

            engine.destroy();
        }

        // Allow microtasks to settle
        await new Promise<void>(resolve => queueMicrotask(resolve));

        context.data.stateOperations += stateOps;
        context.data.headerOperations += headerOps;
        context.data.paramOperations += paramOps;

        return {
            stateOperations: stateOps,
            headerOperations: headerOps,
            paramOperations: paramOps
        };
    },

    async teardown(context: ScenarioContext<StateHeadersParamsContext>) {

        await context.data.server.stop();
    }
};
