/**
 * Scenario F: Hot Code Paths
 *
 * Goal: Measure pure speed and steady-state memory.
 *
 * What it does:
 * - Very high event rate with stable listener count
 * - No churn - pure throughput measurement
 * - Measures latency (avg, p95, p99)
 *
 * Pass criteria:
 * - Heap reaches steady state, doesn't climb
 * - Throughput meets performance targets
 * - GC pauses don't exceed thresholds
 */

import { ObserverEngine } from '../../../../../../packages/observer/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import { getObserverStats } from './_helpers.ts';

interface HotPathContext {

    observer: ObserverEngine<{
        tick: number;
        data: { id: number; timestamp: number };
    }>;
    cleanups: Array<() => void>;
    latencies: number[];
    totalEvents: number;
}

export const hotPaths: Scenario<HotPathContext> = {

    name: 'hot-paths',
    description: 'Pure throughput benchmark with stable listener count',

    setup() {

        const observer = new ObserverEngine<{
            tick: number;
            data: { id: number; timestamp: number };
        }>();

        const cleanups: Array<() => void> = [];
        const listenerCount = 100;

        // Setup stable listener pool - created once
        for (let i = 0; i < listenerCount; i++) {

            cleanups.push(observer.on('tick', () => {
                // Minimal processing
            }));
        }

        // Add some listeners with data processing
        for (let i = 0; i < 10; i++) {

            cleanups.push(observer.on('data', (data) => {
                // Simulate light processing
                void (data.id * 2);
            }));
        }

        return {
            observer,
            cleanups,
            latencies: [],
            totalEvents: 0
        };
    },

    async run(iteration: number, context: ScenarioContext<HotPathContext>) {

        const { observer, latencies } = context.data;
        const eventsPerIteration = 10000;

        // === High-Rate Emit Phase ===
        const iterationLatencies: number[] = [];
        const startTime = performance.now();

        for (let i = 0; i < eventsPerIteration; i++) {

            const emitStart = performance.now();

            observer.emit('tick', iteration * eventsPerIteration + i);

            // Measure latency for a sample of events
            if (i % 100 === 0) {

                observer.emit('data', {
                    id: i,
                    timestamp: Date.now()
                });

                const emitEnd = performance.now();
                iterationLatencies.push(emitEnd - emitStart);
            }
        }

        const duration = performance.now() - startTime;

        // Store latencies for percentile calculation
        latencies.push(...iterationLatencies);
        context.data.totalEvents += eventsPerIteration;

        // Calculate stats for this iteration
        const sortedLatencies = [...iterationLatencies].sort((a, b) => a - b);
        const avgLatency = sortedLatencies.reduce((sum, l) => sum + l, 0) / sortedLatencies.length;
        const p95Index = Math.floor(sortedLatencies.length * 0.95);
        const p99Index = Math.floor(sortedLatencies.length * 0.99);

        const p95Value = sortedLatencies[p95Index] ?? 0;
        const p99Value = sortedLatencies[p99Index] ?? 0;

        return {
            eventsPerIteration,
            durationMs: duration,
            eventsPerSecond: Math.round(eventsPerIteration / (duration / 1000)),
            avgLatencyUs: Math.round(avgLatency * 1000), // Convert to microseconds
            p95LatencyUs: Math.round(p95Value * 1000),
            p99LatencyUs: Math.round(p99Value * 1000),
            totalEvents: context.data.totalEvents
        };
    },

    teardown(context: ScenarioContext<HotPathContext>) {

        // Cleanup all listeners
        context.data.cleanups.forEach(cleanup => cleanup());
        context.data.observer.clear();

        // Calculate overall percentiles
        const sortedLatencies = [...context.data.latencies].sort((a, b) => a - b);

        if (sortedLatencies.length > 0) {

            const avgLatency = sortedLatencies.reduce((sum, l) => sum + l, 0) / sortedLatencies.length;
            const p95Index = Math.floor(sortedLatencies.length * 0.95);
            const p99Index = Math.floor(sortedLatencies.length * 0.99);

            const p95Val = sortedLatencies[p95Index] ?? 0;
            const p99Val = sortedLatencies[p99Index] ?? 0;

            context.log(`Total events emitted: ${context.data.totalEvents}`);
            context.log(`Overall avg latency: ${(avgLatency * 1000).toFixed(2)}µs`);
            context.log(`Overall p95 latency: ${(p95Val * 1000).toFixed(2)}µs`);
            context.log(`Overall p99 latency: ${(p99Val * 1000).toFixed(2)}µs`);
        }
    },

    getStats(context: ScenarioContext<HotPathContext>) {

        return getObserverStats(context.data.observer);
    }
};
