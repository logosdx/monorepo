/**
 * Scenario B: Event Listeners
 *
 * Goal: Detect memory leaks from event listener registration and removal.
 *
 * What it does:
 * - Adds and removes many event listeners
 * - Tests wildcard '*' listener registration
 * - Tests that listeners with closures are properly released
 * - Tests the cleanup function returned by on()
 * - Verifies destroy() cleans up all listeners via AbortSignal
 *
 * Pass criteria:
 * - Heap returns to baseline after GC
 * - No lingering listener references after cleanup
 * - Closures captured by listeners are released
 */

import { FetchEngine, FetchEventNames } from '../../../../../../packages/fetch/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import {
    TestServer,
    BASE_URL,
    createLargePayload
} from './_helpers.ts';

interface EventListenersContext {

    /** Test server instance */
    server: TestServer;

    /** Track listeners added */
    listenersAdded: number;

    /** Track listeners removed */
    listenersRemoved: number;
}

export const eventListeners: Scenario<EventListenersContext> = {

    name: 'event-listeners',
    description: 'Event listener registration, cleanup, and closure capture leak detection',

    async setup() {

        const server = new TestServer();

        await server.start();

        return {
            server,
            listenersAdded: 0,
            listenersRemoved: 0
        };
    },

    async run(iteration: number, context: ScenarioContext<EventListenersContext>) {

        let listenersAdded = 0;
        let listenersRemoved = 0;
        let eventsReceived = 0;

        // === Test 1: Basic listener add/remove with cleanup function ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL
            });

            const cleanupFns: Array<() => void> = [];

            // Add listeners for each event type
            for (const eventName of Object.keys(FetchEventNames)) {

                const cleanup = engine.on(eventName as keyof typeof FetchEventNames, () => {

                    eventsReceived++;
                });

                cleanupFns.push(cleanup);
                listenersAdded++;
            }

            // Make some requests to trigger events
            await engine.get('/success');
            await engine.post('/echo', { data: 'test' });

            // Remove all listeners using cleanup functions
            for (const cleanup of cleanupFns) {

                cleanup();
                listenersRemoved++;
            }

            cleanupFns.length = 0;
            engine.destroy();
        }

        // === Test 2: Wildcard listener with closure ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL
            });

            const cleanupFns: Array<() => void> = [];

            // Add wildcard listeners that capture large data
            for (let i = 0; i < 20; i++) {

                const capturedData = createLargePayload(10);

                const cleanup = engine.on('*', (event) => {

                    // Closure captures capturedData
                    if (capturedData && event.type) {
                        eventsReceived++;
                    }
                });

                cleanupFns.push(cleanup);
                listenersAdded++;
            }

            // Trigger some events
            await engine.get('/success');

            // Remove all listeners
            for (const cleanup of cleanupFns) {

                cleanup();
                listenersRemoved++;
            }

            cleanupFns.length = 0;
            engine.destroy();
        }

        // === Test 3: Listener churn (rapid add/remove) ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL
            });

            for (let i = 0; i < 100; i++) {

                const cleanup = engine.on('fetch-response', () => {

                    eventsReceived++;
                });

                listenersAdded++;

                // Immediately remove
                cleanup();
                listenersRemoved++;
            }

            engine.destroy();
        }

        // === Test 4: Once listeners ===
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL
            });

            // Add 'once' listeners
            for (let i = 0; i < 50; i++) {

                const capturedIndex = i;

                engine.on('fetch-response', () => {

                    // Should only fire once
                    if (capturedIndex >= 0) {
                        eventsReceived++;
                    }
                }, true); // once = true

                listenersAdded++;
            }

            // First request fires all once listeners
            await engine.get('/success');
            listenersRemoved += 50; // All once listeners auto-removed

            // Second request should not trigger any listeners
            await engine.get('/success');

            engine.destroy();
        }

        // === Test 5: Destroy with active listeners ===
        // Tests that destroy() properly cleans up via AbortSignal
        {
            const engine = new FetchEngine({
                baseUrl: BASE_URL
            });

            // Add many listeners but don't remove them
            for (let i = 0; i < 50; i++) {

                const largeCapture = createLargePayload(5);

                engine.on('fetch-before', () => {

                    if (largeCapture) eventsReceived++;
                });

                engine.on('fetch-after', () => {

                    if (largeCapture) eventsReceived++;
                });

                engine.on('fetch-response', () => {

                    if (largeCapture) eventsReceived++;
                });

                listenersAdded += 3;
            }

            // Make a request to exercise listeners
            await engine.get('/success');

            // Destroy should clean up all listeners via internal AbortController
            engine.destroy();
            listenersRemoved += 150; // All listeners cleaned up by destroy
        }

        // === Test 6: Multiple engines with shared handler functions ===
        {
            const engines: FetchEngine[] = [];
            const cleanupFns: Array<() => void> = [];

            // Shared handler function
            const sharedHandler = () => {

                eventsReceived++;
            };

            for (let i = 0; i < 30; i++) {

                const engine = new FetchEngine({
                    baseUrl: BASE_URL
                });

                const cleanup = engine.on('fetch-response', sharedHandler);

                engines.push(engine);
                cleanupFns.push(cleanup);
                listenersAdded++;
            }

            // Make requests
            for (const engine of engines) {

                await engine.get('/success');
            }

            // Cleanup
            for (const cleanup of cleanupFns) {

                cleanup();
                listenersRemoved++;
            }

            for (const engine of engines) {

                engine.destroy();
            }

            engines.length = 0;
            cleanupFns.length = 0;
        }

        // Allow microtasks to settle
        await new Promise<void>(resolve => queueMicrotask(resolve));

        context.data.listenersAdded += listenersAdded;
        context.data.listenersRemoved += listenersRemoved;

        return {
            listenersAdded,
            listenersRemoved,
            eventsReceived
        };
    },

    async teardown(context: ScenarioContext<EventListenersContext>) {

        await context.data.server.stop();
    }
};
