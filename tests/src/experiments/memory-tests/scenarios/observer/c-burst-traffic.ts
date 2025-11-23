/**
 * Scenario C: Burst Traffic + Slow Listeners
 *
 * Goal: Ensure per-observer buffers don't leak or grow forever.
 *
 * What it does:
 * - High-rate emit() calls (10k+ events/sec)
 * - Mix of fast and artificially slow listeners
 * - Tests async listener behavior under load
 *
 * Pass criteria:
 * - Memory returns to baseline when burst ends
 * - Slow listeners don't leak when cleaned up
 * - All listeners complete processing
 */

import { ObserverEngine } from '../../../../../../packages/observer/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import { getObserverStats } from './_helpers.ts';

interface BurstContext {

    observer: ObserverEngine<{
        data: { id: number; payload: string };
        batch: number[];
    }>;
    processedEvents: number;
    droppedEvents: number;
}

export const burstTraffic: Scenario<BurstContext> = {

    name: 'burst-traffic',
    description: 'High-rate emits with slow listeners to test backpressure',

    setup() {

        const observer = new ObserverEngine<{
            data: { id: number; payload: string };
            batch: number[];
        }>();

        return {
            observer,
            processedEvents: 0,
            droppedEvents: 0
        };
    },

    async run(iteration: number, context: ScenarioContext<BurstContext>) {

        const { observer } = context.data;
        const burstSize = 5000;
        const slowListenerDelay = 1; // 1ms delay per event

        // === Setup Listeners ===

        // Fast listener - processes immediately
        let fastCount = 0;
        const fastCleanup = observer.on('data', () => {
            fastCount++;
        });

        // Slow listener - simulates processing delay
        let slowCount = 0;
        const slowCleanup = observer.on('data', async () => {

            await new Promise(resolve => setTimeout(resolve, slowListenerDelay));
            slowCount++;
        });

        // Regex listener - matches pattern
        let regexCount = 0;
        const regexCleanup = observer.on(/^(data|batch)$/, () => {
            regexCount++;
        });

        // === Burst Phase ===
        const startTime = Date.now();

        // Emit burst of events
        for (let i = 0; i < burstSize; i++) {

            observer.emit('data', {
                id: iteration * burstSize + i,
                payload: `burst-${iteration}-event-${i}`
            });
        }

        // Emit some batch events too
        for (let i = 0; i < 100; i++) {
            observer.emit('batch', [i, i + 1, i + 2]);
        }

        const burstDuration = Date.now() - startTime;

        // === Wait for Slow Listeners ===
        // Give slow listeners time to catch up
        await new Promise(resolve => setTimeout(resolve, 100));

        // === Cleanup ===
        fastCleanup();
        slowCleanup();
        regexCleanup();

        context.data.processedEvents += fastCount + slowCount + regexCount;

        return {
            burstSize,
            burstDurationMs: burstDuration,
            eventsPerSecond: Math.round(burstSize / (burstDuration / 1000)),
            fastProcessed: fastCount,
            slowProcessed: slowCount,
            regexProcessed: regexCount
        };
    },

    teardown(context: ScenarioContext<BurstContext>) {

        context.data.observer.clear();
        context.log(`Total processed events: ${context.data.processedEvents}`);
    },

    getStats(context: ScenarioContext<BurstContext>) {

        return getObserverStats(context.data.observer);
    }
};
