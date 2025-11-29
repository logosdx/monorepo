/**
 * Scenario A: Subscriber Churn
 *
 * Goal: Detect leaks from not properly unregistering observers.
 *
 * What it does:
 * - Rapidly subscribe/unsubscribe 1000+ listeners per iteration
 * - Uses on(), off(), and cleanup functions
 * - Tests both named events and regex patterns
 * - Validates AbortController signal cleanup
 *
 * Pass criteria:
 * - Heap returns to baseline after GC
 * - Internal listener count reaches 0 after cleanup
 * - No growth in retained closures
 */

import { ObserverEngine } from '../../../../../../packages/observer/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import { getObserverStats } from './_helpers.ts';

interface ChurnContext {

    observer: ObserverEngine<{
        tick: number;
        data: { value: string };
        status: 'active' | 'inactive';
    }>;
}

export const subscriberChurn: Scenario<ChurnContext> = {

    name: 'subscriber-churn',
    description: 'Rapid subscribe/unsubscribe cycles to detect cleanup leaks',

    setup() {

        const observer = new ObserverEngine<{
            tick: number;
            data: { value: string };
            status: 'active' | 'inactive';
        }>();

        return { observer };
    },

    async run(iteration: number, context: ScenarioContext<ChurnContext>) {

        const { observer } = context.data;
        const cleanups: Array<() => void> = [];
        const controllers: AbortController[] = [];
        const listenerCount = 1000;

        // === Subscribe Phase ===
        // Add many listeners with different patterns

        // Named event listeners
        for (let i = 0; i < listenerCount; i++) {

            cleanups.push(observer.on('tick', () => {
                // Intentionally capture nothing to avoid artificial leaks
            }));
        }

        // Regex pattern listeners
        for (let i = 0; i < 100; i++) {

            cleanups.push(observer.on(/^(tick|data|status)$/, () => {}));
        }

        // Signal-based listeners (new AbortController feature)
        for (let i = 0; i < 100; i++) {

            const controller = new AbortController();
            controllers.push(controller);
            observer.on('tick', () => {}, { signal: controller.signal });
        }

        // === Emit Phase ===
        // Fire some events (use static data to avoid allocation noise)
        const staticData = { value: 'test' };

        for (let i = 0; i < 100; i++) {

            observer.emit('tick', i);
            observer.emit('data', staticData);
        }

        // === Cleanup Phase ===
        // Unsubscribe all listeners
        cleanups.forEach(cleanup => cleanup());

        // Abort all signal-based listeners
        controllers.forEach(controller => controller.abort());

        // Allow microtasks to process abort cleanup
        await new Promise<void>(resolve => queueMicrotask(resolve));

        // Clear references to help GC
        cleanups.length = 0;
        controllers.length = 0;

        // Verify cleanup
        const stats = getObserverStats(observer);

        return {
            subscribedCount: listenerCount + 200, // 1000 + 100 regex + 100 signal
            finalListenerCount: stats.listenerCount,
            finalRegexCount: stats.regexListenerCount
        };
    },

    teardown(context: ScenarioContext<ChurnContext>) {

        context.data.observer.clear();
    },

    getStats(context: ScenarioContext<ChurnContext>) {

        return getObserverStats(context.data.observer);
    }
};
