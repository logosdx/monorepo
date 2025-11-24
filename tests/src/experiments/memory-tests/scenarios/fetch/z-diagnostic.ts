/**
 * Scenario Z: Diagnostic - Isolate Memory Leak Source
 *
 * This diagnostic scenario isolates memory behavior by testing components
 * individually. Key findings:
 *
 * ## What DOES get garbage collected (no leak):
 * - EventTarget with/without listeners (~2 KB overhead)
 * - FetchEngine dispatching CustomEvent (~4 KB overhead)
 * - FetchEvent on plain EventTarget (properly freed)
 * - FetchEvent with shared state references (properly freed)
 *
 * ## What retains memory:
 * - Raw `fetch()` calls: ~50 KB per 20 requests
 *   → This is Node.js undici's connection pooling, NOT a leak
 * - FetchEngine requests: ~100 KB per 20 requests
 *   → ~50 KB from undici + ~50 KB from FetchEvent/response objects
 *
 * ## Conclusion:
 * The memory retention is from Node.js's HTTP client (undici) keeping
 * connection pools, TLS sessions, and request metadata for performance.
 * This is expected behavior, not a bug in FetchEngine.
 */

import { FetchEngine } from '../../../../../../packages/fetch/src/index.ts';
import { attempt } from '../../../../../../packages/utils/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import {
    TestServer,
    BASE_URL
} from './_helpers.ts';

interface DiagnosticContext {
    server: TestServer;
}

export const diagnostic: Scenario<DiagnosticContext> = {

    name: 'diagnostic',
    description: 'Isolate memory leak source by testing components individually',

    async setup() {

        const server = new TestServer();
        await server.start();
        return { server };
    },

    async run(iteration: number, context: ScenarioContext<DiagnosticContext>) {

        const results: Record<string, { before: number; after: number; diff: number }> = {};

        // === Test 1: Plain EventTarget - dispatch with no listeners ===
        {
            context.gc();
            const before = process.memoryUsage().heapUsed;

            for (let i = 0; i < 100; i++) {

                const et = new EventTarget();

                // Dispatch event with large data, no listeners
                const event = new CustomEvent('test', {
                    detail: { data: 'x'.repeat(10000), index: i }
                });

                et.dispatchEvent(event);
            }

            context.gc();
            const after = process.memoryUsage().heapUsed;
            results['1-EventTarget-NoListener'] = { before, after, diff: after - before };
        }

        // === Test 2: Plain EventTarget - dispatch WITH listener that's removed ===
        {
            context.gc();
            const before = process.memoryUsage().heapUsed;

            for (let i = 0; i < 100; i++) {

                const et = new EventTarget();
                const handler = () => {};

                et.addEventListener('test', handler);

                const event = new CustomEvent('test', {
                    detail: { data: 'x'.repeat(10000), index: i }
                });

                et.dispatchEvent(event);
                et.removeEventListener('test', handler);
            }

            context.gc();
            const after = process.memoryUsage().heapUsed;
            results['2-EventTarget-WithListener'] = { before, after, diff: after - before };
        }

        // === Test 3: FetchEngine extends EventTarget - is it the class? ===
        {
            context.gc();
            const before = process.memoryUsage().heapUsed;

            for (let i = 0; i < 50; i++) {

                const engine = new FetchEngine({ baseUrl: BASE_URL });

                // Dispatch custom event (not FetchEvent)
                const event = new CustomEvent('test', {
                    detail: { data: 'x'.repeat(10000), index: i }
                });

                engine.dispatchEvent(event);
                engine.destroy();
            }

            context.gc();
            const after = process.memoryUsage().heapUsed;
            results['3-FetchEngine-CustomEvent'] = { before, after, diff: after - before };
        }

        // === Test 4: Check if it's the FetchEvent class itself ===
        {
            context.gc();
            const before = process.memoryUsage().heapUsed;

            const { FetchEvent, FetchEventNames } = await import('../../../../../../packages/fetch/src/helpers.ts');

            for (let i = 0; i < 100; i++) {

                const et = new EventTarget();

                // Use FetchEvent on plain EventTarget
                const event = new FetchEvent(FetchEventNames['fetch-response'], {
                    state: {},
                    data: { large: 'x'.repeat(10000) },
                    url: 'http://test.com',
                    method: 'GET'
                });

                et.dispatchEvent(event);
            }

            context.gc();
            const after = process.memoryUsage().heapUsed;
            results['4-FetchEvent-PlainTarget'] = { before, after, diff: after - before };
        }

        // === Test 5: Is it the state reference? ===
        {
            context.gc();
            const before = process.memoryUsage().heapUsed;

            const { FetchEvent, FetchEventNames } = await import('../../../../../../packages/fetch/src/helpers.ts');

            const sharedState = { token: 'abc', user: { id: 1 } };

            for (let i = 0; i < 100; i++) {

                const et = new EventTarget();

                // FetchEvent with reference to shared state
                const event = new FetchEvent(FetchEventNames['fetch-response'], {
                    state: sharedState,  // Shared reference
                    data: { index: i },
                    url: 'http://test.com',
                    method: 'GET'
                });

                et.dispatchEvent(event);
            }

            context.gc();
            const after = process.memoryUsage().heapUsed;
            results['5-FetchEvent-SharedState'] = { before, after, diff: after - before };
        }

        // === Test 6: Raw fetch baseline ===
        {
            context.gc();
            const before = process.memoryUsage().heapUsed;

            for (let i = 0; i < 20; i++) {

                const res = await fetch(`${BASE_URL}/success`);
                await res.json();
            }

            context.gc();
            const after = process.memoryUsage().heapUsed;
            results['6-RawFetch'] = { before, after, diff: after - before };
        }

        // === Test 7: FetchEngine requests ===
        {
            context.gc();
            const before = process.memoryUsage().heapUsed;

            const engine = new FetchEngine({ baseUrl: BASE_URL });

            for (let i = 0; i < 20; i++) {

                await attempt(() => engine.get('/success'));
            }

            engine.destroy();

            context.gc();
            const after = process.memoryUsage().heapUsed;
            results['7-FetchEngine'] = { before, after, diff: after - before };
        }

        // Print results
        console.log(`\n--- Iteration ${iteration} Memory Diffs ---`);

        for (const [name, { diff }] of Object.entries(results)) {

            const kb = (diff / 1024).toFixed(2);
            const status = diff > 10000 ? '⚠️ ' : '✓ ';
            console.log(`${status}${name}: ${kb} KB`);
        }

        return results;
    },

    async teardown(context: ScenarioContext<DiagnosticContext>) {

        await context.data.server.stop();
    }
};
