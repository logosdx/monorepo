/**
 * Utils Memory Test Scenarios
 *
 * Collection of scenarios for testing @logosdx/utils memory behavior.
 */

import type { Scenario } from '../../types.ts';

import { memoizeChurn } from './a-memoize-churn.ts';
import { debounceThrottle } from './b-debounce-throttle.ts';
import { circuitBreakerScenario } from './c-circuit-breaker.ts';
import { rateLimitScenario } from './d-rate-limit.ts';
import { inflightDedupScenario } from './e-inflight-dedup.ts';
import { batchRetryScenario } from './f-batch-retry.ts';
import { timeoutWaitScenario } from './g-timeout-wait.ts';
import { priorityQueueScenario } from './h-priority-queue.ts';
import { cloneScenario } from './i-clone.ts';
import { composeFlowScenario } from './j-compose-flow.ts';

// Use Scenario<any> to allow different context types in the array
export const utilsScenarios: Array<Scenario<any>> = [
    memoizeChurn,
    debounceThrottle,
    circuitBreakerScenario,
    rateLimitScenario,
    inflightDedupScenario,
    batchRetryScenario,
    timeoutWaitScenario,
    priorityQueueScenario,
    cloneScenario,
    composeFlowScenario
];
