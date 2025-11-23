/**
 * Scenario D: Fan-out and Fan-in
 *
 * Goal: Explore scaling behavior with many relationships.
 *
 * Fan-out (1 subject -> many observers):
 * - Single ObserverEngine, ramp to 10,000 listeners
 * - All receive steady event stream
 *
 * Fan-in (many subjects -> 1 observer):
 * - Many ObserverEngine instances
 * - Single listener pattern subscribed to all
 *
 * Pass criteria:
 * - Memory footprint scales linearly (not superlinearly)
 * - Tearing down half the observers reduces memory proportionally
 * - Internal counts match expected values
 */

import { ObserverEngine } from '../../../../../../packages/observer/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import { getObserverStats } from './_helpers.ts';

interface FanContext {

    // Fan-out: single observer, many listeners
    fanOutObserver: ObserverEngine<{ event: number }>;
    fanOutCleanups: Array<() => void>;

    // Fan-in: many observers, single listener pattern
    fanInObservers: Array<ObserverEngine<{ event: number }>>;
    fanInCleanups: Array<() => void>;
}

export const fanOutFanIn: Scenario<FanContext> = {

    name: 'fan-out-fan-in',
    description: 'Scaling test with 1->many and many->1 relationships',

    setup() {

        return {
            fanOutObserver: new ObserverEngine<{ event: number }>(),
            fanOutCleanups: [],
            fanInObservers: [],
            fanInCleanups: []
        };
    },

    async run(iteration: number, context: ScenarioContext<FanContext>) {

        const {
            fanOutObserver,
            fanOutCleanups,
            fanInObservers,
            fanInCleanups
        } = context.data;

        // Scale factors - increase each iteration
        const fanOutScale = 1000;  // Add 1000 listeners per iteration
        const fanInScale = 50;     // Add 50 observers per iteration

        // === Fan-out Phase ===
        // Add many listeners to single observer

        let fanOutReceived = 0;

        for (let i = 0; i < fanOutScale; i++) {

            const cleanup = fanOutObserver.on('event', () => {
                fanOutReceived++;
            });

            fanOutCleanups.push(cleanup);
        }

        // Emit to all fan-out listeners
        for (let i = 0; i < 10; i++) {
            fanOutObserver.emit('event', iteration * 10 + i);
        }

        // === Fan-in Phase ===
        // Create many observers, subscribe single pattern to each

        let fanInReceived = 0;
        const sharedListener = () => {
            fanInReceived++;
        };

        for (let i = 0; i < fanInScale; i++) {

            const observer = new ObserverEngine<{ event: number }>();
            fanInObservers.push(observer);

            const cleanup = observer.on('event', sharedListener);
            fanInCleanups.push(cleanup);
        }

        // Emit from all fan-in observers
        for (const observer of fanInObservers) {
            observer.emit('event', iteration);
        }

        // === Partial Teardown ===
        // Remove half to test memory recovery

        const halfFanOut = Math.floor(fanOutCleanups.length / 2);
        const halfFanIn = Math.floor(fanInCleanups.length / 2);

        // Remove half of fan-out listeners
        for (let i = 0; i < halfFanOut; i++) {

            const cleanup = fanOutCleanups.pop();
            cleanup?.();
        }

        // Remove half of fan-in observers
        for (let i = 0; i < halfFanIn; i++) {

            const cleanup = fanInCleanups.pop();
            cleanup?.();

            const observer = fanInObservers.pop();
            observer?.clear();
        }

        return {
            fanOutTotal: fanOutCleanups.length,
            fanInTotal: fanInObservers.length,
            fanOutReceived,
            fanInReceived,
            iteration
        };
    },

    teardown(context: ScenarioContext<FanContext>) {

        // Clean up all remaining
        context.data.fanOutCleanups.forEach(cleanup => cleanup());
        context.data.fanOutObserver.clear();

        context.data.fanInCleanups.forEach(cleanup => cleanup());
        context.data.fanInObservers.forEach(observer => observer.clear());

        context.log(`Final fan-out listeners: ${context.data.fanOutCleanups.length}`);
        context.log(`Final fan-in observers: ${context.data.fanInObservers.length}`);
    },

    getStats(context: ScenarioContext<FanContext>) {

        const fanOutStats = getObserverStats(context.data.fanOutObserver);

        // Aggregate fan-in stats
        let totalFanInListeners = 0;

        for (const observer of context.data.fanInObservers) {

            const stats = getObserverStats(observer);
            totalFanInListeners += stats.listenerCount;
        }

        return {
            listenerCount: fanOutStats.listenerCount + totalFanInListeners,
            regexListenerCount: fanOutStats.regexListenerCount,
            generatorCount: context.data.fanInObservers.length
        };
    }
};
