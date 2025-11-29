/**
 * Scenario B: Long-lived Subjects
 *
 * Goal: Ensure a long-running observer doesn't accumulate ghosts over hours.
 *
 * What it does:
 * - Creates ONE ObserverEngine instance at start
 * - Continuously adds/removes short-lived listeners
 * - Runs as a soak test (30-60+ minutes recommended)
 *
 * Pass criteria:
 * - Heap snapshots show stable object counts
 * - Internal registry size stays within small, stable range
 * - No creeping growth in listener references
 */

import { ObserverEngine } from '../../../../../../packages/observer/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import { getObserverStats } from './_helpers.ts';

interface LongLivedContext {

    observer: ObserverEngine<{
        heartbeat: number;
        message: { id: number; content: string };
        error: Error;
    }>;
    totalSubscriptions: number;
    totalUnsubscriptions: number;
}

export const longLivedSubjects: Scenario<LongLivedContext> = {

    name: 'long-lived-subjects',
    description: 'Soak test for ghost accumulation in long-running observers',

    setup() {

        const observer = new ObserverEngine<{
            heartbeat: number;
            message: { id: number; content: string };
            error: Error;
        }>();

        return {
            observer,
            totalSubscriptions: 0,
            totalUnsubscriptions: 0
        };
    },

    async run(iteration: number, context: ScenarioContext<LongLivedContext>) {

        const { observer } = context.data;
        const batchSize = 500;

        // === Short-lived Listener Cycle ===
        // Simulate clients connecting, receiving a few events, then disconnecting

        const cleanups: Array<() => void> = [];

        // Subscribe batch of listeners
        for (let i = 0; i < batchSize; i++) {

            // Simulate different listener patterns
            const listenerType = i % 3;

            if (listenerType === 0) {

                // Regular listener
                cleanups.push(observer.on('heartbeat', () => {}));
            }
            else if (listenerType === 1) {

                // Once listener (auto-removes after first event)
                observer.once('message', () => {});
                // No cleanup needed for once, but track it
                cleanups.push(() => {});
            }
            else {

                // Signal-based listener
                const controller = new AbortController();
                observer.on('heartbeat', () => {}, { signal: controller.signal });
                cleanups.push(() => controller.abort());
            }

            context.data.totalSubscriptions++;
        }

        // Emit events to trigger once listeners
        for (let i = 0; i < 10; i++) {

            observer.emit('heartbeat', iteration * 10 + i);
            observer.emit('message', { id: iteration * 10 + i, content: `msg-${i}` });
        }

        // Short delay to simulate real-world usage
        await new Promise(resolve => setTimeout(resolve, 10));

        // Unsubscribe all
        cleanups.forEach(cleanup => cleanup());
        context.data.totalUnsubscriptions += batchSize;

        return {
            batchSize,
            totalSubscriptions: context.data.totalSubscriptions,
            totalUnsubscriptions: context.data.totalUnsubscriptions
        };
    },

    teardown(context: ScenarioContext<LongLivedContext>) {

        context.data.observer.clear();

        context.log(`Total subscriptions: ${context.data.totalSubscriptions}`);
        context.log(`Total unsubscriptions: ${context.data.totalUnsubscriptions}`);
    },

    getStats(context: ScenarioContext<LongLivedContext>) {

        return getObserverStats(context.data.observer);
    }
};
