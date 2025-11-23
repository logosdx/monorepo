/**
 * Observer Scenario Helpers
 *
 * Shared utilities for observer memory test scenarios.
 */

import type { ObserverEngine } from '../../../../../../packages/observer/src/index.ts';

import type { ObserverStats } from '../../types.ts';

/**
 * Extract stats from ObserverEngine using the public $facts() API.
 *
 * This avoids brittle access to private fields and uses the
 * debug API that ObserverEngine already exposes.
 */
export function getObserverStats(observer: ObserverEngine<any>): ObserverStats {

    const facts = observer.$facts();

    // Sum up all listener counts from the listenerCounts object
    let listenerCount = 0;
    let regexListenerCount = 0;

    for (const [key, count] of Object.entries(facts.listenerCounts)) {

        // Regex patterns are stored as their string representation (e.g., "/pattern/flags")
        if (key.startsWith('/')) {
            regexListenerCount += count;
        }
        else {
            listenerCount += count;
        }
    }

    return {
        listenerCount,
        regexListenerCount
    };
}

/**
 * Get detailed stats including event names for debugging.
 */
export function getDetailedObserverStats(observer: ObserverEngine<any>) {

    const facts = observer.$facts();

    return {
        ...getObserverStats(observer),
        listeners: facts.listeners,
        rgxListeners: facts.rgxListeners,
        listenerCounts: facts.listenerCounts,
        hasSpy: facts.hasSpy
    };
}
