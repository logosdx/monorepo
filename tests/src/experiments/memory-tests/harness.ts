/**
 * Memory Testing Harness
 *
 * Interactive harness for running memory leak tests with
 * keyboard controls and snapshot capture.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

import type {
    HarnessOptions,
    RequiredHarnessOptions,
    HarnessState,
    MemorySnapshot,
    HeapStats,
    ScenarioContext,
    ScenarioResult,
    ScenarioMetrics,
    TestSuiteResult,
    KeyAction,
    Scenario
} from './types.ts';

// Check if GC is exposed
const gc = (globalThis as any).gc as (() => void) | undefined;

export class MemoryTestHarness {

    #options: RequiredHarnessOptions;
    #state: HarnessState;
    #rl: readline.Interface | null = null;
    #scenarioContext: ScenarioContext<unknown> | null = null;

    constructor(options: HarnessOptions) {

        this.#options = {
            outputPath: options.outputPath ?? 'tmp/memory-tests.json',
            autoGc: options.autoGc ?? false,
            suite: options.suite,
            scenarios: options.scenarios,
            thresholds: {
                gcRecoveryRate: options.thresholds?.gcRecoveryRate ?? 0.90,
                heapGrowthPerIteration: options.thresholds?.heapGrowthPerIteration ?? (10 * 1024) // 10KB
            },
            autoMode: options.autoMode ?? false,
            autoModeIterations: options.autoModeIterations ?? 20
        };

        this.#state = {
            currentScenarioIndex: 0,
            currentIteration: 0,
            running: false,
            snapshots: [],
            results: [],
            startTime: new Date()
        };
    }

    /**
     * Get current heap statistics
     */
    #getHeapStats(): HeapStats {

        const mem = process.memoryUsage();

        return {
            used: mem.heapUsed,
            total: mem.heapTotal,
            external: mem.external,
            arrayBuffers: mem.arrayBuffers
        };
    }

    /**
     * Take a memory snapshot
     */
    #takeSnapshot(phase: MemorySnapshot['phase']): MemorySnapshot {

        const snapshot: MemorySnapshot = {
            phase,
            iteration: this.#state.currentIteration,
            timestamp: Date.now(),
            heap: this.#getHeapStats()
        };

        // Add observer stats if scenario provides them
        const scenario = this.#currentScenario;

        if (scenario?.getStats && this.#scenarioContext) {
            snapshot.observer = scenario.getStats(this.#scenarioContext);
        }

        this.#state.snapshots.push(snapshot);
        return snapshot;
    }

    /**
     * Force garbage collection if available
     */
    #forceGc(): boolean {

        if (gc) {

            gc();
            return true;
        }

        return false;
    }

    /**
     * Get current scenario
     */
    get #currentScenario(): Scenario | undefined {

        return this.#options.scenarios[this.#state.currentScenarioIndex];
    }

    /**
     * Format bytes for display
     */
    #formatBytes(bytes: number): string {

        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    /**
     * Print current stats to console
     */
    #printStats(): void {

        const heap = this.#getHeapStats();
        const scenario = this.#currentScenario;

        console.log('\n--- Current Stats ---');
        console.log(`Scenario: ${scenario?.name ?? 'none'} (${this.#state.currentScenarioIndex + 1}/${this.#options.scenarios.length})`);
        console.log(`Iteration: ${this.#state.currentIteration}`);
        console.log(`Heap Used: ${this.#formatBytes(heap.used)}`);
        console.log(`Heap Total: ${this.#formatBytes(heap.total)}`);
        console.log(`External: ${this.#formatBytes(heap.external)}`);
        console.log(`Snapshots: ${this.#state.snapshots.length}`);

        if (scenario?.getStats && this.#scenarioContext) {

            const stats = scenario.getStats(this.#scenarioContext);
            console.log(`Listener Count: ${stats.listenerCount}`);
            console.log(`Regex Listeners: ${stats.regexListenerCount}`);

            if (stats.queueSize !== undefined) {
                console.log(`Queue Size: ${stats.queueSize}`);
            }

            if (stats.generatorCount !== undefined) {
                console.log(`Generators: ${stats.generatorCount}`);
            }
        }

        console.log('---------------------\n');
    }

    /**
     * Dump all snapshots to console
     */
    #dumpSnapshots(): void {

        console.log('\n--- Snapshots ---');
        console.log(JSON.stringify(this.#state.snapshots, null, 2));
        console.log('-----------------\n');
    }


    /**
     * Calculate metrics from snapshots
     */
    #calculateMetrics(): ScenarioMetrics {

        const snapshots = this.#state.snapshots;

        const baseline = snapshots.find(s => s.phase === 'baseline');
        const afterGcSnapshots = snapshots.filter(s => s.phase === 'after-gc');
        const afterRunSnapshots = snapshots.filter(s => s.phase === 'after-run');

        const baselineHeap = baseline?.heap.used ?? 0;
        const peakHeap = snapshots.length > 0
            ? Math.max(...snapshots.map(s => s.heap.used))
            : 0;
        const lastAfterGc = afterGcSnapshots[afterGcSnapshots.length - 1];
        const lastSnapshot = snapshots[snapshots.length - 1];
        const finalHeap = lastAfterGc?.heap.used ?? lastSnapshot?.heap.used ?? 0;

        // Calculate heap growth per iteration
        let heapGrowthPerIteration = 0;

        if (afterRunSnapshots.length > 1) {

            const firstRunSnapshot = afterRunSnapshots[0];
            const lastRunSnapshot = afterRunSnapshots[afterRunSnapshots.length - 1];

            if (firstRunSnapshot && lastRunSnapshot) {

                const firstRun = firstRunSnapshot.heap.used;
                const lastRun = lastRunSnapshot.heap.used;
                heapGrowthPerIteration = (lastRun - firstRun) / (afterRunSnapshots.length - 1);
            }
        }

        // Calculate GC recovery rate
        let gcRecoveryRate = 1;

        if (afterGcSnapshots.length > 0 && baselineHeap > 0) {

            const avgAfterGc = afterGcSnapshots.reduce((sum, s) => sum + s.heap.used, 0) / afterGcSnapshots.length;
            const peakGrowth = peakHeap - baselineHeap;

            if (peakGrowth > 0) {
                const recovered = peakHeap - avgAfterGc;
                gcRecoveryRate = recovered / peakGrowth;
            }
        }

        // Calculate average iteration time
        const runPairs: Array<{ before: number; after: number }> = [];

        for (let i = 0; i < snapshots.length - 1; i++) {

            const current = snapshots[i];
            const next = snapshots[i + 1];

            if (current && next && current.phase === 'before-run' && next.phase === 'after-run') {

                runPairs.push({
                    before: current.timestamp,
                    after: next.timestamp
                });
            }
        }

        const avgIterationMs = runPairs.length > 0
            ? runPairs.reduce((sum, p) => sum + (p.after - p.before), 0) / runPairs.length
            : 0;

        return {
            baselineHeap,
            peakHeap,
            finalHeap,
            heapGrowthPerIteration,
            gcRecoveryRate: Math.max(0, Math.min(1, gcRecoveryRate)),
            avgIterationMs,
            totalIterations: this.#state.currentIteration
        };
    }

    /**
     * Check health of current scenario
     *
     * Health logic:
     * - If GC recovery is >= threshold (e.g., 90%), the scenario passes regardless of
     *   heap growth per iteration (temporary allocations that get cleaned up are fine)
     * - If GC recovery is below threshold, that's a failure
     * - Heap growth per iteration is only a failure if GC recovery is also below threshold
     *   (indicates actual memory leak vs just temporary working memory)
     */
    #checkHealth(metrics: ScenarioMetrics): { healthy: boolean; warnings: string[] } {

        const warnings: string[] = [];
        const thresholds = this.#options.thresholds;

        const gcRecoveryOk = metrics.gcRecoveryRate >= thresholds.gcRecoveryRate;

        if (!gcRecoveryOk) {

            warnings.push(
                `GC recovery rate ${(metrics.gcRecoveryRate * 100).toFixed(1)}% ` +
                `is below threshold ${(thresholds.gcRecoveryRate * 100).toFixed(1)}%`
            );

            // Only flag heap growth as a problem if GC recovery is also failing
            // (indicates actual leak, not just temporary allocations)
            if (metrics.heapGrowthPerIteration > thresholds.heapGrowthPerIteration) {

                warnings.push(
                    `Heap growth ${this.#formatBytes(metrics.heapGrowthPerIteration)}/iteration ` +
                    `exceeds threshold ${this.#formatBytes(thresholds.heapGrowthPerIteration)}`
                );
            }
        }

        return {
            healthy: gcRecoveryOk,
            warnings
        };
    }

    /**
     * Complete current scenario and save results
     */
    #completeScenario(): ScenarioResult {

        const scenario = this.#currentScenario!;
        const metrics = this.#calculateMetrics();
        const { healthy, warnings } = this.#checkHealth(metrics);

        const result: ScenarioResult = {
            name: scenario.name,
            description: scenario.description,
            iterations: this.#state.currentIteration,
            snapshots: [...this.#state.snapshots],
            metrics,
            healthy,
            warnings
        };

        this.#state.results.push(result);

        // Print summary
        console.log(`\n=== Scenario Complete: ${scenario.name} ===`);
        console.log(`Iterations: ${result.iterations}`);
        console.log(`Baseline Heap: ${this.#formatBytes(metrics.baselineHeap)}`);
        console.log(`Peak Heap: ${this.#formatBytes(metrics.peakHeap)}`);
        console.log(`Final Heap: ${this.#formatBytes(metrics.finalHeap)}`);
        console.log(`GC Recovery: ${(metrics.gcRecoveryRate * 100).toFixed(1)}%`);
        console.log(`Avg Iteration: ${metrics.avgIterationMs.toFixed(2)}ms`);
        console.log(`Health: ${healthy ? 'PASS' : 'FAIL'}`);

        if (warnings.length > 0) {

            console.log('Warnings:');
            warnings.forEach(w => console.log(`  - ${w}`));
        }

        console.log('========================================\n');

        return result;
    }

    /**
     * Initialize scenario context
     */
    async #initScenario(): Promise<void> {

        const scenario = this.#currentScenario;

        if (!scenario) return;

        console.log(`\nInitializing scenario: ${scenario.name}`);
        console.log(`Description: ${scenario.description}\n`);

        // Reset state for new scenario
        this.#state.currentIteration = 0;
        this.#state.snapshots = [];

        // Run setup if provided
        const data = scenario.setup ? await scenario.setup() : undefined;

        // Create context
        this.#scenarioContext = {
            data,
            iteration: 0,
            snapshot: (phase) => this.#takeSnapshot(phase),
            log: (message) => console.log(`[${scenario.name}] ${message}`)
        };

        // Take baseline snapshot
        this.#forceGc();
        this.#takeSnapshot('baseline');

        console.log('Scenario initialized. Press "r" to run iterations.\n');
    }

    /**
     * Teardown current scenario
     */
    async #teardownScenario(): Promise<void> {

        const scenario = this.#currentScenario;

        if (scenario?.teardown && this.#scenarioContext) {
            await scenario.teardown(this.#scenarioContext);
        }

        this.#scenarioContext = null;
    }

    /**
     * Run one iteration of current scenario
     */
    async #runIteration(): Promise<void> {

        const scenario = this.#currentScenario;

        if (!scenario || !this.#scenarioContext) {

            console.log('No scenario initialized');
            return;
        }

        this.#state.currentIteration++;
        this.#scenarioContext.iteration = this.#state.currentIteration;

        console.log(`Running iteration ${this.#state.currentIteration}...`);

        // Before-run snapshot
        this.#takeSnapshot('before-run');

        // Run the iteration
        const startTime = Date.now();
        const customMetrics = await scenario.run(this.#state.currentIteration, this.#scenarioContext);
        const duration = Date.now() - startTime;

        // After-run snapshot
        const afterRun = this.#takeSnapshot('after-run');
        afterRun.custom = customMetrics;

        console.log(`  Duration: ${duration}ms`);
        console.log(`  Heap Used: ${this.#formatBytes(afterRun.heap.used)}`);

        // Auto-GC if enabled
        if (this.#options.autoGc) {
            await this.#runGc();
        }
    }

    /**
     * Force GC and take snapshots
     */
    async #runGc(): Promise<void> {

        console.log('Forcing garbage collection...');

        this.#takeSnapshot('before-gc');

        if (this.#forceGc()) {

            // Allow GC to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            const afterGc = this.#takeSnapshot('after-gc');
            console.log(`  Heap after GC: ${this.#formatBytes(afterGc.heap.used)}`);
        }
        else {

            console.log('  GC not available. Run with --expose-gc flag.');
        }
    }

    /**
     * Move to next scenario
     */
    async #nextScenario(): Promise<void> {

        // Complete current scenario if we ran any iterations
        if (this.#state.currentIteration > 0 && this.#currentScenario) {

            await this.#runGc();
            this.#completeScenario();
            await this.#teardownScenario();
        }

        // Move to next
        this.#state.currentScenarioIndex++;

        if (this.#state.currentScenarioIndex >= this.#options.scenarios.length) {

            console.log('All scenarios complete.');
            this.#state.currentScenarioIndex = this.#options.scenarios.length - 1;
            return;
        }

        await this.#initScenario();
    }

    /**
     * Move to previous scenario
     */
    async #prevScenario(): Promise<void> {

        if (this.#state.currentScenarioIndex <= 0) {

            console.log('Already at first scenario.');
            return;
        }

        // Teardown current without saving
        await this.#teardownScenario();

        this.#state.currentScenarioIndex--;
        await this.#initScenario();
    }

    /**
     * Save results to file
     */
    #saveResults(): void {

        // Complete current scenario if running
        if (this.#state.currentIteration > 0 && this.#currentScenario) {

            this.#completeScenario();
        }

        const result: TestSuiteResult = {
            suite: this.#options.suite,
            startTime: this.#state.startTime.toISOString(),
            endTime: new Date().toISOString(),
            nodeVersion: process.version,
            platform: `${process.platform} ${process.arch}`,
            scenarios: this.#state.results
        };

        // Ensure output directory exists
        const outputDir = path.dirname(this.#options.outputPath);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(
            this.#options.outputPath,
            JSON.stringify(result, null, 2)
        );

        console.log(`\nResults saved to: ${this.#options.outputPath}`);
    }

    /**
     * Handle keyboard input
     */
    async #handleKey(key: string): Promise<boolean> {

        const keyMap: Record<string, KeyAction> = {
            'r': 'run',
            'c': 'gc',
            'n': 'next',
            'p': 'prev',
            's': 'stats',
            'd': 'dump',
            '?': 'help',
            'q': 'quit'
        };

        const action = keyMap[key.toLowerCase()];

        if (!action) {

            console.log(`Unknown key: ${key}. Press ? for help`);
            return true;
        }

        switch (action) {

            case 'run':
                await this.#runIteration();
                break;

            case 'gc':
                await this.#runGc();
                break;

            case 'next':
                await this.#nextScenario();
                break;

            case 'prev':
                await this.#prevScenario();
                break;

            case 'stats':
                this.#printStats();
                break;

            case 'dump':
                this.#dumpSnapshots();
                break;

            case 'help':
                this.#printHelpWithScenarios();
                break;

            case 'quit':
                return false;
        }

        return true;
    }

    /**
     * Print help message
     */
    #printHelp(): void {

        console.log('\n=== Memory Test Harness ===');
        console.log('Controls:');
        console.log('  r - Run one iteration');
        console.log('  c - Force GC + snapshot');
        console.log('  n - Next scenario');
        console.log('  p - Previous scenario');
        console.log('  s - Show current stats');
        console.log('  d - Dump snapshots to console');
        console.log('  ? - Show help and scenario list');
        console.log('  q - Quit and save results');
        console.log('===========================\n');
    }

    /**
     * Print detailed help with scenario information
     */
    #printHelpWithScenarios(): void {

        const scenarios = this.#options.scenarios;
        const currentIndex = this.#state.currentScenarioIndex;

        console.log('\n╔══════════════════════════════════════════════════════════════╗');
        console.log('║               MEMORY TEST HARNESS - HELP                     ║');
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log('║  CONTROLS                                                    ║');
        console.log('║    r - Run one iteration of current scenario                 ║');
        console.log('║    c - Force garbage collection + take snapshot              ║');
        console.log('║    n - Move to next scenario                                 ║');
        console.log('║    p - Move to previous scenario                             ║');
        console.log('║    s - Show current memory stats                             ║');
        console.log('║    d - Dump all snapshots to console                         ║');
        console.log('║    ? - Show this help                                        ║');
        console.log('║    q - Quit and save results                                 ║');
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log('║  SCENARIOS                                                   ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');

        scenarios.forEach((scenario, index) => {

            const isCurrent = index === currentIndex;
            const marker = isCurrent ? '▶' : ' ';
            const highlight = isCurrent ? '\x1b[36m' : '\x1b[90m'; // cyan for current, gray for others
            const reset = '\x1b[0m';

            console.log(`${highlight}${marker} [${index + 1}/${scenarios.length}] ${scenario.name}${reset}`);
            console.log(`${highlight}     ${scenario.description}${reset}`);

            if (isCurrent) {
                console.log(`     Iteration: ${this.#state.currentIteration}`);
            }

            console.log('');
        });
    }

    /**
     * Run in auto mode (non-interactive)
     *
     * For each scenario:
     * 1. Run GC
     * 2. Run N iterations
     * 3. Run GC x2
     * 4. Move to next scenario
     */
    async #runAutoMode(): Promise<void> {

        const iterations = this.#options.autoModeIterations;
        const totalScenarios = this.#options.scenarios.length;

        console.log('\n╔══════════════════════════════════════════════════════════════╗');
        console.log('║                    AUTO MODE STARTED                         ║');
        console.log(`║  Iterations per scenario: ${iterations.toString().padEnd(35)}║`);
        console.log(`║  Total scenarios: ${totalScenarios.toString().padEnd(43)}║`);
        console.log('╚══════════════════════════════════════════════════════════════╝\n');

        for (let scenarioIdx = 0; scenarioIdx < totalScenarios; scenarioIdx++) {

            this.#state.currentScenarioIndex = scenarioIdx;
            await this.#initScenario();

            const scenario = this.#currentScenario!;

            console.log(`\n[${scenarioIdx + 1}/${totalScenarios}] Running: ${scenario.name}`);
            console.log('─'.repeat(60));

            // Step 1: Initial GC
            console.log('  → Initial GC...');
            await this.#runGc();

            // Step 2: Run N iterations
            console.log(`  → Running ${iterations} iterations...`);

            for (let i = 0; i < iterations; i++) {

                await this.#runIteration();

                // Progress indicator every 10 iterations
                if ((i + 1) % 10 === 0 || i === iterations - 1) {
                    console.log(`    Progress: ${i + 1}/${iterations}`);
                }
            }

            // Step 3: Final GC x2
            console.log('  → Final GC (1/2)...');
            await this.#runGc();

            console.log('  → Final GC (2/2)...');
            await this.#runGc();

            // Complete and save scenario results
            this.#completeScenario();
            await this.#teardownScenario();

            // Reset iteration count to prevent #saveResults from re-completing
            this.#state.currentIteration = 0;
        }

        // Save all results
        this.#saveResults();

        console.log('\n╔══════════════════════════════════════════════════════════════╗');
        console.log('║                    AUTO MODE COMPLETE                        ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');
    }

    /**
     * Start the interactive harness
     */
    async start(): Promise<void> {

        if (this.#options.scenarios.length === 0) {

            console.error('No scenarios provided');
            return;
        }

        // Check for GC availability
        if (!gc) {

            console.warn('WARNING: GC not exposed. Run with --expose-gc for accurate memory testing.\n');
        }

        this.#state.running = true;
        this.#state.startTime = new Date();

        // Auto mode: run non-interactively
        if (this.#options.autoMode) {

            await this.#runAutoMode();
            return;
        }

        this.#printHelp();

        // Initialize first scenario
        await this.#initScenario();

        // Setup readline for keyboard input
        this.#rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Enable raw mode for single keypress
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }

        process.stdin.resume();

        // Handle keypresses
        process.stdin.on('data', async (data) => {

            const key = data.toString();

            // Handle Ctrl+C
            if (key === '\u0003') {

                this.#saveResults();
                process.exit(0);
            }

            const shouldContinue = await this.#handleKey(key);

            if (!shouldContinue) {

                this.#saveResults();
                await this.#teardownScenario();
                this.#rl?.close();
                process.exit(0);
            }
        });

        console.log('Waiting for input...\n');
    }
}
