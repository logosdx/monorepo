# Memory Testing Strategy


This document outlines the memory testing strategy for `@logosdx` packages, focusing on detecting memory leaks, measuring performance, and validating cleanup mechanisms.


## Purpose


Memory leaks in event-driven architectures are notoriously difficult to detect through unit tests alone. This harness provides:

1. **Interactive debugging** - Run with `--inspect` for Chrome DevTools heap snapshots
2. **Controlled iterations** - Step through scenarios manually to isolate issues
3. **Automated snapshots** - Track heap usage before/after runs and GC cycles
4. **JSON output** - Persistent results for trend analysis


## Common Leak Patterns in Observer Systems


These are the patterns we're specifically testing for:

| Pattern                       | Description                                          | How We Test                                  |
| ----------------------------- | ---------------------------------------------------- | -------------------------------------------- |
| **Forgotten unsubscriptions** | Subjects keep strong references to observers forever | Scenario A: High churn subscribe/unsubscribe |
| **Ghost accumulation**        | Long-running subjects accumulate dead observers      | Scenario B: Soak test over time              |
| **Buffer growth**             | Per-observer queues that never shrink                | Scenario C: Burst traffic + slow listeners   |
| **Closure captures**          | Callbacks capturing large context objects            | All scenarios: monitor heap object retention |
| **Registry leaks**            | Global maps not cleaned up                           | Scenario D: Fan-out/fan-in scaling           |
| **Signal/timer leaks**        | AbortControllers, timers not cleaned                 | Scenario E: Failure & reconnect storms       |


## Test Scenarios


### Scenario A: Subscriber Churn

**Goal:** Detect leaks from not properly unregistering observers.

**What it does:**

- Rapidly subscribe/unsubscribe 1000+ listeners per iteration
- Uses `on()`, `off()`, and cleanup functions
- Tests both named events and regex patterns
- Validates AbortController signal cleanup

**Pass criteria:**

- Heap returns to baseline after GC
- Internal listener count reaches 0 after cleanup
- No growth in retained closures


### Scenario B: Long-lived Subjects

**Goal:** Ensure a long-running observer doesn't accumulate ghosts over hours.

**What it does:**

- Creates ONE `ObserverEngine` instance at start
- Continuously adds/removes short-lived listeners
- Runs as a soak test (30-60+ minutes recommended)

**Pass criteria:**

- Heap snapshots show stable object counts
- Internal registry size stays within small, stable range
- No creeping growth in listener references


### Scenario C: Burst Traffic + Slow Listeners

**Goal:** Ensure per-observer buffers don't leak or grow forever.

**What it does:**

- High-rate `emit()` calls (10k+ events/sec)
- Mix of fast and artificially slow listeners
- Tests `EventQueue` backpressure behavior

**Pass criteria:**

- Queue sizes grow during bursts but shrink after
- Memory returns to baseline when burst ends
- Slow listeners don't leak when cleaned up


### Scenario D: Fan-out and Fan-in

**Goal:** Explore scaling behavior with many relationships.

**Fan-out (1 subject -> many observers):**

- Single `ObserverEngine`, ramp to 10,000 listeners
- All receive steady event stream

**Fan-in (many subjects -> 1 observer):**

- Many `ObserverEngine` instances
- Single listener subscribed to all via regex

**Pass criteria:**

- Memory footprint scales linearly (not superlinearly)
- Tearing down half the observers reduces memory proportionally
- Internal counts match expected values


### Scenario E: Failure & Reconnect Storms

**Goal:** Catch leaks when the system is unstable.

**What it does:**

- Creates observers with `AbortController` signals
- Rapidly aborts and recreates (simulating disconnects)
- Tests `AbortSignal.any()` composition cleanup
- Cascading abort scenarios (parent -> child signals)

**Pass criteria:**

- No growth in pending abort listeners
- Aborted observers fully removed from registries
- Signal listeners properly cleaned via `queueMicrotask` pattern


### Scenario F: Hot Code Paths

**Goal:** Measure pure speed and steady-state memory.

**What it does:**

- Very high event rate with stable listener count
- No churn - pure throughput measurement
- Measures latency (avg, p95, p99)

**Pass criteria:**

- Heap reaches steady state, doesn't climb
- Throughput meets performance targets
- GC pauses don't exceed thresholds


## Interactive Controls


When running the harness:

| Key | Action                                           |
| --- | ------------------------------------------------ |
| `r` | Run one iteration of current scenario            |
| `c` | Force garbage collection + take snapshot         |
| `n` | Next scenario                                    |
| `p` | Previous scenario                                |
| `s` | Show current stats (heap, listener counts)       |
| `d` | Dump current snapshots to console                |
| `?` | Show help and scenario list                      |
| `q` | Stop and save results to `tmp/memory-tests.json` |


## Running the Harness


### Interactive Mode (Default)

```bash
# From monorepo root
cd tests

# Run with garbage collection exposed (required for accurate testing)
pnpm tsx --expose-gc src/experiments/memory-tests/index.ts observer

# Run with Chrome DevTools inspector for heap snapshots
pnpm tsx --expose-gc --inspect src/experiments/memory-tests/index.ts observer

# Run specific scenario
pnpm tsx --expose-gc src/experiments/memory-tests/index.ts observer --scenario=subscriber-churn
```


### Auto Mode

Auto mode runs all scenarios non-interactively, useful for CI or batch testing.

```bash
# Run all scenarios with default 20 iterations each
pnpm tsx --expose-gc src/experiments/memory-tests/index.ts observer --auto

# Custom iteration count
pnpm tsx --expose-gc src/experiments/memory-tests/index.ts observer --auto --iterations=50

# Single scenario in auto mode
pnpm tsx --expose-gc src/experiments/memory-tests/index.ts observer --auto --scenario=subscriber-churn
```

**Auto mode flow for each scenario:**

1. Initialize scenario
2. Run GC (establish baseline)
3. Run N iterations (default: 20)
4. Run GC twice (final cleanup)
5. Record results and move to next scenario
6. Save all results to JSON when complete

**CLI Flags:**

| Flag | Description |
|------|-------------|
| `--auto` | Enable auto mode (non-interactive) |
| `--iterations=N` | Number of iterations per scenario (default: 20) |
| `--scenario=name` | Run only the specified scenario |
| `--output=path` | Custom output file path |
| `--auto-gc` | Auto-run GC after each iteration (interactive mode) |


## Output Format


Results are written to `tmp/memory-tests.json`:

```json
{
    "suite": "observer",
    "startTime": "2024-01-15T10:30:00.000Z",
    "endTime": "2024-01-15T10:45:00.000Z",
    "scenarios": [
        {
            "name": "subscriber-churn",
            "iterations": 50,
            "snapshots": [
                {
                    "iteration": 1,
                    "phase": "before-run",
                    "timestamp": 1705315800000,
                    "heap": {
                        "used": 52428800,
                        "total": 67108864,
                        "external": 1048576
                    },
                    "observer": {
                        "listenerCount": 0,
                        "regexListenerCount": 0
                    }
                }
            ],
            "metrics": {
                "baselineHeap": 52428800,
                "peakHeap": 125829120,
                "finalHeap": 53477376,
                "heapGrowthPerIteration": 1500,
                "gcRecoveryRate": 0.98,
                "avgIterationMs": 45
            }
        }
    ]
}
```


## Interpreting Results


### Healthy Signs

- Heap returns to near-baseline after GC
- `gcRecoveryRate` > 0.95 (95% of allocated memory freed)
- `heapGrowthPerIteration` is small and stable
- Listener counts match expectations (0 after cleanup)


### Warning Signs

- Heap grows unbounded across iterations
- `gcRecoveryRate` < 0.90 (memory not being freed)
- Listener counts don't reach 0 after cleanup
- `heapGrowthPerIteration` increases over time


### Using Chrome DevTools

1. Run with `--inspect` flag
2. Open `chrome://inspect` in Chrome
3. Click "inspect" on the Node.js target
4. Go to Memory tab
5. Take heap snapshots at key points:
   - Before any iterations (baseline)
   - After several iterations
   - After forcing GC
6. Compare snapshots to find retained objects


## Adding New Scenarios


Create a new file in `scenarios/<package>/`:

```typescript
import type { Scenario } from '../../types.ts';

export const myScenario: Scenario = {
    name: 'my-scenario',
    description: 'Description of what this tests',

    setup: async () => {
        // Optional: one-time setup
        return { /* context passed to run() */ };
    },

    run: async (iteration, context) => {
        // Run one iteration
        // Return metrics for this iteration
        return {
            listenerCount: 0,
            customMetric: 42
        };
    },

    teardown: async (context) => {
        // Optional: cleanup after all iterations
    },

    getStats: (context) => {
        // Return current observable stats
        return {
            listenerCount: 0,
            queueSize: 0
        };
    }
};
```


## Future Packages


This harness is designed to be extended for other `@logosdx` packages:

- **`@logosdx/fetch`** - Request/response lifecycle, retry queue leaks
- **`@logosdx/state-machine`** - State transition listener cleanup
- **`@logosdx/storage`** - Cache eviction, IndexedDB handle cleanup
- **`@logosdx/dom`** - MutationObserver cleanup, event delegation leaks

Each package will have its own `scenarios/<package>/` directory with package-specific test scenarios.


## Web UI


A web-based visualization UI is available to view test results:

```bash
# Start the UI server
pnpm tsx src/experiments/memory-tests/ui/server.ts

# Open in browser
open http://localhost:3456
```

**Features:**

- File selector dropdown for saved results
- Suite metadata display (Node version, platform, duration)
- Per-scenario metrics cards
- Heap usage chart with GC recovery visualization
- Health status badges (PASS/FAIL)
- Warning display for failed thresholds

**API Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/files` | GET | List available result files in `tmp/` |
| `/api/data?file=<name>` | GET | Get data from specific file |
| `/api/data` | GET | Get live data (if pushed) |
| `/api/live` | POST | Push live data from harness |
