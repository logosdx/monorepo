/**
 * Fetch Memory Test Scenarios
 *
 * Collection of scenarios for testing @logosdx/fetch memory behavior.
 * Tests FetchEngine lifecycle, event listeners, state management,
 * and abort/timeout cleanup.
 *
 * ## Important Notes on Memory Behavior
 *
 * These tests revealed that Node.js's native `fetch()` (undici HTTP client)
 * retains ~50KB per 20 requests due to internal connection pooling and
 * request tracking. This is expected HTTP client behavior for performance
 * optimization, NOT a memory leak in FetchEngine.
 *
 * FetchEngine adds ~50KB overhead on top of undici due to:
 * - Event data objects with response/data references
 * - Response cloning for event dispatching
 *
 * FetchEngine now extends ObserverEngine for event handling, which provides
 * proper garbage collection of listeners via the `clear()` method called
 * during `destroy()`. The memory retention is from undici's connection pool,
 * TLS session cache, and request metadata - not from the event system.
 */

import type { Scenario } from '../../types.ts';

import { instanceChurn } from './a-instance-churn.ts';
import { eventListeners } from './b-event-listeners.ts';
import { stateHeadersParams } from './c-state-headers-params.ts';
import { abortTimeout } from './d-abort-timeout.ts';
import { repeatedCalls } from './e-repeated-calls.ts';
import { diagnostic } from './z-diagnostic.ts';

// Use Scenario<any> to allow different context types in the array
export const fetchScenarios: Array<Scenario<any>> = [
    instanceChurn,
    eventListeners,
    stateHeadersParams,
    abortTimeout,
    repeatedCalls,
    diagnostic
];
