/**
 * Memory Testing Types
 *
 * Type definitions for the memory testing harness, including
 * snapshots, scenarios, and result structures.
 */

export interface HeapStats {

    /** Heap memory currently in use (bytes) */
    used: number;

    /** Total heap memory allocated (bytes) */
    total: number;

    /** Memory used by external C++ objects (bytes) */
    external: number;

    /** Memory used by ArrayBuffers (bytes) */
    arrayBuffers: number;
}

export interface ObserverStats {

    /** Number of named event listeners registered */
    listenerCount: number;

    /** Number of regex pattern listeners registered */
    regexListenerCount: number;

    /** Size of EventQueue if applicable */
    queueSize?: number;

    /** Number of active EventGenerators */
    generatorCount?: number;
}

export interface MemorySnapshot {

    /** Which phase of the iteration this snapshot was taken */
    phase: 'baseline' | 'before-run' | 'after-run' | 'before-gc' | 'after-gc';

    /** Iteration number (0 for baseline) */
    iteration: number;

    /** Unix timestamp when snapshot was taken */
    timestamp: number;

    /** Heap memory statistics */
    heap: HeapStats;

    /** Package-specific statistics (optional) */
    observer?: ObserverStats;

    /** Custom metrics from scenario */
    custom?: Record<string, number>;
}

export interface ScenarioMetrics {

    /** Heap at baseline (before any iterations) */
    baselineHeap: number;

    /** Maximum heap observed during test */
    peakHeap: number;

    /** Heap after final GC */
    finalHeap: number;

    /** Average heap growth per iteration (bytes) */
    heapGrowthPerIteration: number;

    /** Percentage of memory recovered by GC (0-1) */
    gcRecoveryRate: number;

    /** Average iteration duration (ms) */
    avgIterationMs: number;

    /** Total iterations completed */
    totalIterations: number;
}

export interface ScenarioResult {

    /** Scenario name */
    name: string;

    /** Scenario description */
    description: string;

    /** Number of iterations completed */
    iterations: number;

    /** All memory snapshots taken */
    snapshots: MemorySnapshot[];

    /** Computed metrics */
    metrics: ScenarioMetrics;

    /** Whether the scenario passed health checks */
    healthy: boolean;

    /** Any warnings generated */
    warnings: string[];
}

export interface TestSuiteResult {

    /** Suite name (e.g., 'observer', 'fetch') */
    suite: string;

    /** When the test started */
    startTime: string;

    /** When the test ended */
    endTime: string;

    /** Node.js version */
    nodeVersion: string;

    /** Platform info */
    platform: string;

    /** Results for each scenario run */
    scenarios: ScenarioResult[];
}

export interface ScenarioContext<T = unknown> {

    /** Custom context data from setup() */
    data: T;

    /** Current iteration number */
    iteration: number;

    /** Take a memory snapshot */
    snapshot: (phase: MemorySnapshot['phase']) => MemorySnapshot;

    /** Log a message to console */
    log: (message: string) => void;

    /** Force garbage collection (if available) */
    gc: () => void;
}

export interface Scenario<T = unknown> {

    /** Unique scenario name (kebab-case) */
    name: string;

    /** Human-readable description */
    description: string;

    /**
     * One-time setup before iterations begin.
     * Returns context data passed to run() and teardown().
     */
    setup?: () => Promise<T> | T;

    /**
     * Run a single iteration.
     * @param iteration - Current iteration number (1-based)
     * @param context - Scenario context with custom data
     * @returns Custom metrics for this iteration
     */
    run: (iteration: number, context: ScenarioContext<T>) => Promise<Record<string, number>> | Record<string, number>;

    /**
     * Cleanup after all iterations complete.
     * @param context - Scenario context with custom data
     */
    teardown?: (context: ScenarioContext<T>) => Promise<void> | void;

    /**
     * Get current observable stats for this scenario.
     * Called to populate snapshot.observer field.
     * @param context - Scenario context with custom data
     */
    getStats?: (context: ScenarioContext<T>) => ObserverStats;
}

export interface HarnessThresholds {

    /** Minimum acceptable GC recovery rate (default: 0.90) */
    gcRecoveryRate: number;

    /** Maximum acceptable heap growth per iteration in bytes (default: 10KB) */
    heapGrowthPerIteration: number;
}

export interface HarnessOptions {

    /** Suite name for output file */
    suite: string;

    /** Available scenarios */
    scenarios: Scenario[];

    /** Output file path (default: tmp/memory-tests.json) */
    outputPath?: string;

    /** Whether to auto-run GC after each iteration */
    autoGc?: boolean;

    /** Health check thresholds */
    thresholds?: Partial<HarnessThresholds>;

    /** Run in auto mode (non-interactive) */
    autoMode?: boolean;

    /** Number of iterations per scenario in auto mode (default: 20) */
    autoModeIterations?: number;
}

export interface RequiredHarnessOptions {

    suite: string;
    scenarios: Scenario[];
    outputPath: string;
    autoGc: boolean;
    thresholds: HarnessThresholds;
    autoMode: boolean;
    autoModeIterations: number;
}

export type KeyAction =
    | 'run'           // r - Run one iteration
    | 'gc'            // c - Force GC + snapshot
    | 'next'          // n - Next scenario
    | 'prev'          // p - Previous scenario
    | 'stats'         // s - Show current stats
    | 'dump'          // d - Dump snapshots to console
    | 'help'          // ? - Show help and scenario info
    | 'quit';         // q - Quit and save

export interface HarnessState {

    /** Currently selected scenario index */
    currentScenarioIndex: number;

    /** Current iteration within scenario */
    currentIteration: number;

    /** Whether the harness is running */
    running: boolean;

    /** Snapshots for current scenario */
    snapshots: MemorySnapshot[];

    /** Results for completed scenarios */
    results: ScenarioResult[];

    /** When the test suite started */
    startTime: Date;
}
