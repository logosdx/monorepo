# CLAUDE.md - Memory Tests


This file provides context for Claude Code when working with the memory testing harness.


## Overview


The memory testing harness detects memory leaks in `@logosdx` packages by running scenarios that stress-test specific patterns (subscriber churn, cache pressure, timer cleanup, etc.) and measuring heap recovery after garbage collection.


## Architecture


```
memory-tests/
├── index.ts           # CLI entry point
├── harness.ts         # MemoryTestHarness class (interactive + auto modes)
├── types.ts           # TypeScript interfaces for scenarios, snapshots, results
├── scenarios/
│   ├── observer/      # @logosdx/observer memory tests
│   │   ├── index.ts   # Exports observerScenarios array
│   │   └── *.ts       # Individual scenario files
│   └── utils/         # @logosdx/utils memory tests
│       ├── index.ts   # Exports utilsScenarios array
│       ├── _helpers.ts # Shared utilities (createLargeObject, delay, etc.)
│       └── *.ts       # Individual scenario files (a-*, b-*, etc.)
└── ui/
    ├── index.html     # Single-page visualization app
    └── server.ts      # HTTP server for UI + API endpoints
```


## Running Tests


```bash
# From tests/ directory

# Interactive mode (manual control)
pnpm memory <suite>

# Auto mode (CI-friendly, runs all scenarios)
pnpm memory <suite> --auto

# With Chrome DevTools for heap snapshots
pnpm memory --inspect <suite>

# Specific scenario only
pnpm memory utils --scenario=memoize-churn

# Custom iteration count
pnpm memory utils --auto --iterations=50
```

**Available suites:** `observer`, `utils`


## CLI Flags


| Flag | Description |
|------|-------------|
| `--auto` | Non-interactive mode |
| `--iterations=N` | Iterations per scenario (default: 20) |
| `--scenario=name` | Run only specified scenario |
| `--output=path` | Custom output file path |
| `--auto-gc` | Auto-run GC after each iteration (interactive) |


## Interactive Controls


| Key | Action |
|-----|--------|
| `r` | Run one iteration |
| `c` | Force GC + snapshot |
| `n` | Next scenario |
| `p` | Previous scenario |
| `s` | Show current stats |
| `d` | Dump snapshots |
| `?` | Help + scenario list |
| `q` | Quit and save |


## Creating a New Test Suite


1. **Create scenario directory:**

    ```
    scenarios/<package-name>/
    ├── index.ts
    ├── _helpers.ts      # Optional shared utilities
    └── a-scenario.ts    # Prefix with letters for ordering
    ```

2. **Implement scenario interface:**

    ```typescript
    import type { Scenario, ScenarioContext } from '../../types.ts';

    interface MyContext {
        // Custom state for this scenario
    }

    export const myScenario: Scenario<MyContext> = {

        name: 'my-scenario',           // kebab-case
        description: 'What this tests',

        setup() {
            // One-time setup, returns context data
            return { /* MyContext */ };
        },

        async run(iteration: number, context: ScenarioContext<MyContext>) {
            // Run one iteration
            // Return custom metrics
            return {
                operationsPerformed: 1000,
                customMetric: 42
            };
        },

        teardown(context: ScenarioContext<MyContext>) {
            // Cleanup after all iterations
        },

        getStats(context: ScenarioContext<MyContext>) {
            // Optional: return observable stats for snapshots
            return {
                listenerCount: 0,
                regexListenerCount: 0
            };
        }
    };
    ```

3. **Export from index.ts:**

    ```typescript
    import { myScenario } from './a-my-scenario.ts';
    import { otherScenario } from './b-other-scenario.ts';

    export const myPackageScenarios = [
        myScenario,
        otherScenario
    ];
    ```

4. **Register in main index.ts:**

    ```typescript
    import { myPackageScenarios } from './scenarios/my-package/index.ts';

    const suites: Record<string, typeof observerScenarios> = {
        observer: observerScenarios,
        utils: utilsScenarios,
        'my-package': myPackageScenarios  // Add new suite
    };
    ```


## Scenario Design Guidelines


### Avoiding False Positives

1. **Use block scopes** - Wrap test phases in `{}` blocks so temporary objects go out of scope:

    ```typescript
    {
        const fn = debounce(() => {}, { delay: 100 });
        fn();
        fn.cancel();
    }
    // fn is now eligible for GC
    ```

2. **Don't rely on WeakRef GC timing** - WeakRef collection is non-deterministic. Report WeakRef stats for info but don't use as pass/fail criteria.

3. **Disable cleanup timers** - Use `cleanupInterval: 0` to avoid timing-dependent behavior in memoize tests.

4. **Clear all state explicitly** - Call `cache.clear()`, `cancel()`, etc. before letting references go out of scope.


### Memory Test Patterns

| Pattern | Description | How to Test |
|---------|-------------|-------------|
| Timer leaks | setInterval/setTimeout not cleared | Create/destroy functions, verify cancel clears timers |
| Closure captures | Functions holding large context | Scope closures in blocks, verify GC after block |
| Cache accumulation | Maps/Sets that grow unbounded | Stress with many entries, verify clear() works |
| Listener leaks | Event handlers not unsubscribed | Subscribe/unsubscribe cycles, check listener counts |
| Promise retention | Unresolved promises held forever | Create promises, cancel/reject, verify cleanup |


## Web UI


### Starting the Server

```bash
pnpm memory:ui
# Opens at http://localhost:3456
```


### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/files` | GET | List result files in `tmp/memory-tests/` |
| `/api/data?file=<name>` | GET | Get data from specific file |
| `/api/data` | GET | Get live data (if pushed) |
| `/api/live` | POST | Push live data from harness |
| `/api/events` | GET | SSE stream for file updates |


### UI Features

- **File selector** - Dropdown of saved result files
- **Keyboard shortcuts** - `N`/`P` navigate files, `R` refresh, `O` open local, `E` toggle charts, `A` expand/collapse
- **Scenario panels** - Collapse by default, show summary stats (iterations, GC%, peak heap, avg time)
- **Plotly charts** - Heap usage over time with baseline reference
- **Health badges** - PASS/FAIL based on GC recovery rate threshold (default: 90%)
- **SSE updates** - Auto-refreshes file list when new results appear


### UI Structure (index.html)

- Single-file SPA with embedded CSS and JavaScript
- Uses Plotly.js for charts
- Uses Tippy.js for tooltips
- Uses Toastify for notifications
- Dark theme (GitHub-inspired colors)


## Output Format


Results saved to `tmp/memory-tests/YYMMDD-HHMM-<suite>.json`:

```json
{
    "suite": "utils",
    "startTime": "2024-01-15T10:30:00.000Z",
    "endTime": "2024-01-15T10:35:00.000Z",
    "nodeVersion": "v22.14.0",
    "platform": "darwin arm64",
    "scenarios": [
        {
            "name": "memoize-churn",
            "description": "...",
            "iterations": 20,
            "healthy": true,
            "warnings": [],
            "metrics": {
                "baselineHeap": 10485760,
                "peakHeap": 31457280,
                "finalHeap": 10747904,
                "gcRecoveryRate": 0.989,
                "avgIterationMs": 35.0
            },
            "snapshots": [...]
        }
    ]
}
```


## Health Criteria


A scenario **passes** if:
- GC recovery rate >= 90% (configurable via `thresholds.gcRecoveryRate`)

A scenario **fails** if:
- GC recovery rate < 90% (indicates memory not being freed)

Heap growth per iteration is only flagged as a warning if GC recovery is also failing (indicates actual leak vs temporary working memory).


## Troubleshooting


### "GC not available" warning
Run with `--expose-gc` flag: `pnpm tsx --expose-gc ...`

### Low GC recovery rate
1. Check if `cancel()` / `clear()` / `cleanup()` methods are being called
2. Verify wrapper functions go out of scope (use block scopes)
3. Check for closure captures holding large objects
4. Use Chrome DevTools (`--inspect`) to take heap snapshots and compare

### Flaky WeakRef tests
WeakRef GC timing is non-deterministic. Don't use as pass/fail criteria - report for informational purposes only.
