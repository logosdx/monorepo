/**
 * Observer Memory Test Scenarios
 *
 * Collection of scenarios for testing @logosdx/observer memory behavior.
 */

import type { Scenario } from '../../types.ts';

import { subscriberChurn } from './a-subscriber-churn.ts';
import { longLivedSubjects } from './b-long-lived-subjects.ts';
import { burstTraffic } from './c-burst-traffic.ts';
import { fanOutFanIn } from './d-fan-out-fan-in.ts';
import { failureReconnect } from './e-failure-reconnect.ts';
import { hotPaths } from './f-hot-paths.ts';

// Use Scenario<any> to allow different context types in the array
export const observerScenarios: Array<Scenario<any>> = [
    subscriberChurn,
    longLivedSubjects,
    burstTraffic,
    fanOutFanIn,
    failureReconnect,
    hotPaths
];
