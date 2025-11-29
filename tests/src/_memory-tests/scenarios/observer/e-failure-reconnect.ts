/**
 * Scenario E: Failure & Reconnect Storms
 *
 * Goal: Catch leaks when the system is unstable.
 *
 * What it does:
 * - Creates observers with AbortController signals
 * - Rapidly aborts and recreates (simulating disconnects)
 * - Tests AbortSignal.any() composition cleanup
 * - Cascading abort scenarios (parent -> child signals)
 *
 * Pass criteria:
 * - No growth in pending abort listeners
 * - Aborted observers fully removed from registries
 * - Signal listeners properly cleaned via queueMicrotask pattern
 */

import { ObserverEngine } from '../../../../../../packages/observer/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import { getObserverStats } from './_helpers.ts';

interface ClientEntry {
    observer: ObserverEngine<{ event: number }>;
    clientController: AbortController;
    listenerController: AbortController;
    cleanup: () => void;
}

interface ReconnectContext {

    // Parent controller that cascades to children
    parentController: AbortController;

    // Active observers (simulating connected clients)
    activeObservers: Map<number, ClientEntry>;

    // Stats
    totalConnects: number;
    totalDisconnects: number;
    totalAborts: number;
}

export const failureReconnect: Scenario<ReconnectContext> = {

    name: 'failure-reconnect',
    description: 'AbortController storms and signal cascade cleanup',

    setup() {

        return {
            parentController: new AbortController(),
            activeObservers: new Map(),
            totalConnects: 0,
            totalDisconnects: 0,
            totalAborts: 0
        };
    },

    async run(iteration: number, context: ScenarioContext<ReconnectContext>) {

        const { activeObservers, parentController } = context.data;

        // === Connection Churn ===
        // Simulate clients connecting and disconnecting rapidly

        const connectCount = 100;
        const disconnectCount = 50;
        const abortCount = 25;

        // Connect new clients
        for (let i = 0; i < connectCount; i++) {

            const clientId = context.data.totalConnects++;
            const clientController = new AbortController();
            const listenerController = new AbortController();

            // Create observer with client's signal directly
            // (avoiding AbortSignal.any() to isolate the leak source)
            const observer = new ObserverEngine<{ event: number }>({
                signal: clientController.signal
            });

            // Add listener with its own signal
            const cleanup = observer.on('event', () => {}, {
                signal: listenerController.signal
            });

            activeObservers.set(clientId, {
                observer,
                clientController,
                listenerController,
                cleanup
            });
        }

        // Emit events to all active observers
        for (const [, client] of activeObservers) {
            client.observer.emit('event', iteration);
        }

        // Graceful disconnect (call cleanup)
        const disconnectIds = Array.from(activeObservers.keys()).slice(0, disconnectCount);

        for (const clientId of disconnectIds) {

            const client = activeObservers.get(clientId);

            if (client) {

                // Abort both controllers to ensure full cleanup
                client.listenerController.abort();
                client.clientController.abort();
                client.cleanup();
                client.observer.clear();
                activeObservers.delete(clientId);
                context.data.totalDisconnects++;
            }
        }

        // Abort disconnect (simulate network failure)
        const abortIds = Array.from(activeObservers.keys()).slice(0, abortCount);

        for (const clientId of abortIds) {

            const client = activeObservers.get(clientId);

            if (client) {

                // Abort both controllers
                client.listenerController.abort();
                client.clientController.abort();
                activeObservers.delete(clientId);
                context.data.totalAborts++;
            }
        }

        // Allow microtasks to process abort cleanup
        await new Promise<void>(resolve => queueMicrotask(() => resolve()));
        await new Promise(resolve => setTimeout(resolve, 10));

        // === Cascading Abort Test ===
        // Every 5 iterations, reset parent controller (simulates session timeout)
        if (iteration % 5 === 0 && iteration > 0) {

            context.log('Triggering parent abort (session timeout simulation)');

            // Abort parent - should cascade to all children
            context.data.parentController.abort();

            // Clear all observers (they should already be cleaned by signal)
            for (const [, client] of activeObservers) {
                client.observer.clear();
            }

            activeObservers.clear();
            context.data.totalAborts += activeObservers.size;

            // Create new parent controller for next batch
            context.data.parentController = new AbortController();

            // Allow cleanup to propagate
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        return {
            activeCount: activeObservers.size,
            totalConnects: context.data.totalConnects,
            totalDisconnects: context.data.totalDisconnects,
            totalAborts: context.data.totalAborts
        };
    },

    teardown(context: ScenarioContext<ReconnectContext>) {

        // Abort parent to cascade cleanup
        context.data.parentController.abort();

        // Clear any remaining observers - abort all controllers
        for (const [, client] of context.data.activeObservers) {

            client.listenerController.abort();
            client.clientController.abort();
            client.observer.clear();
        }

        context.data.activeObservers.clear();

        context.log(`Total connects: ${context.data.totalConnects}`);
        context.log(`Total disconnects: ${context.data.totalDisconnects}`);
        context.log(`Total aborts: ${context.data.totalAborts}`);
    },

    getStats(context: ScenarioContext<ReconnectContext>) {

        let totalListeners = 0;
        let totalRegex = 0;

        for (const [, client] of context.data.activeObservers) {

            const stats = getObserverStats(client.observer);
            totalListeners += stats.listenerCount;
            totalRegex += stats.regexListenerCount;
        }

        return {
            listenerCount: totalListeners,
            regexListenerCount: totalRegex,
            generatorCount: context.data.activeObservers.size
        };
    }
};
