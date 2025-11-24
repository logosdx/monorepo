#!/usr/bin/env node
/**
 * Memory Test CLI Entry Point
 *
 * Usage:
 *   pnpm tsx --expose-gc src/experiments/memory-tests/index.ts <suite>
 *
 * Examples:
 *   pnpm tsx --expose-gc src/experiments/memory-tests/index.ts observer
 *   pnpm tsx --expose-gc --inspect src/experiments/memory-tests/index.ts observer
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MemoryTestHarness } from './harness.ts';

// Get monorepo root (4 levels up from this file)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, '../../../../');

// Generate timestamped filename: YYMMDD-HHMM-{suite}.json
function generateOutputPath(suiteName: string): string {

    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');

    const filename = `${yy}${mm}${dd}-${hh}${min}-${suiteName}.json`;
    return path.join(monorepoRoot, 'tmp', 'memory-tests', filename);
}

// Import scenario registries
import { observerScenarios } from './scenarios/observer/index.ts';
import { utilsScenarios } from './scenarios/utils/index.ts';

const suites: Record<string, typeof observerScenarios> = {
    observer: observerScenarios,
    utils: utilsScenarios,
    // Future: fetch, state-machine, storage, dom
};

async function main() {

    const args = process.argv.slice(2);
    const suiteName = args[0];

    if (!suiteName) {

        console.log('Usage: memory-tests <suite>');
        console.log('');
        console.log('Available suites:');
        Object.keys(suites).forEach(name => {
            console.log(`  - ${name}`);
        });
        process.exit(1);
    }

    const scenarios = suites[suiteName];

    if (!scenarios) {

        console.error(`Unknown suite: ${suiteName}`);
        console.log('');
        console.log('Available suites:');
        Object.keys(suites).forEach(name => {
            console.log(`  - ${name}`);
        });
        process.exit(1);
    }

    // Parse optional flags
    const scenarioFilter = args.find(a => a.startsWith('--scenario='))?.split('=')[1];
    const outputPath = args.find(a => a.startsWith('--output='))?.split('=')[1];
    const autoGc = args.includes('--auto-gc');
    const autoMode = args.includes('--auto');
    const iterationsArg = args.find(a => a.startsWith('--iterations='))?.split('=')[1];
    const iterations = iterationsArg ? parseInt(iterationsArg, 10) : 20;

    let selectedScenarios = scenarios;

    if (scenarioFilter) {

        selectedScenarios = scenarios.filter(s => s.name === scenarioFilter);

        if (selectedScenarios.length === 0) {

            console.error(`Unknown scenario: ${scenarioFilter}`);
            console.log('');
            console.log('Available scenarios:');
            scenarios.forEach(s => {
                console.log(`  - ${s.name}: ${s.description}`);
            });
            process.exit(1);
        }
    }

    const harness = new MemoryTestHarness({
        suite: suiteName,
        scenarios: selectedScenarios,
        outputPath: outputPath ?? generateOutputPath(suiteName),
        autoGc,
        autoMode,
        autoModeIterations: iterations
    });

    await harness.start();
}

main().catch(err => {

    console.error('Fatal error:', err);
    process.exit(1);
});
