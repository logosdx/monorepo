#!/usr/bin/env zx
import 'zx/globals';

import path from 'path';
import { fileURLToPath } from 'url';
import glob from 'fast-glob';

import { watch } from './helpers.mjs';

// Common ignore patterns for all watchers
const ignore = ['node_modules', 'dist', '.git'];
const patterns = '*.ts,*.json';

// State management
const state = {
    cleanups: [],
    watchers: [],
    building: new Set(),
    build: {
        docs: null,
    },
    pauseAll() {
        for (const w of this.watchers) w.pause();
    },
    resumeAll() {
        for (const w of this.watchers) w.resume();
    },
};

// Folder paths
const folders = {};

folders.this = path.dirname(fileURLToPath(import.meta.url));
folders.root = path.resolve(folders.this, '..', '..');
folders.packages = path.resolve(folders.root, 'packages');
folders.docs = path.resolve(folders.root, 'docs');
folders.tests = path.resolve(folders.root, 'tests');

const globalAbort = new AbortController();
const noStdin = ['ignore', 'inherit', 'inherit'];
const fwdio = $({ stdio: noStdin, signal: globalAbort.signal });

const startDocsPreview = async () => {

    await $`pkill -f "pnpm docs:preview"`.catch(() => {});

    state.docsPreview = true;

    echo('Starting docs preview...');

    const withSignal = $({
        signal: globalAbort.signal,
        stdio: noStdin,
    });

    withSignal`pnpm docs:preview`.catch((err) => {

        if (globalAbort.signal.aborted) return;

        state.docsPreview = false;
        echo(chalk.yellow('Docs preview stopped:'), err.stderr || err.message || err);
    });
};

const main = async () => {

    const files = await glob('**/package.json', {
        absolute: true,
        cwd: folders.packages,
        ignore: ['**/node_modules/**', '**/dist/**']
    });

    state.cleanups = [];

    /**
     * Watch all packages that have "watch": true in their package.json
     * and run their build scripts on changes.
     */

    for (const file of files) {

        const { default: pkg } = await import(file, { with: { type: 'json' } });

        if (!pkg.watch) continue;

        const folder = path.dirname(file);
        const name = pkg.name;

        echo(`Watching ${name}...`);

        const build = async () => {

            if (state.building.has(name)) return;

            state.building.add(name);
            pkgWatcher.pause();

            await spinner(
                `Building ${name}...`,
                () => fwdio`cd ${folder} && pnpm build`.catch(echo)
            );

            const cleanName = name.replace('@logosdx/', '');

            await spinner(
                `Running tests for ${name}...`,
                () => fwdio`cd ${folders.tests} && pnpm test ${cleanName}`.catch(echo)
            );

            state.building.delete(name);
            pkgWatcher.resume();
        };

        state.build[name] = build;

        const pkgWatcher = watch({
            folder,
            ignore,
            patterns,
            debounce: 500,
            onChange: build
        });

        state.cleanups.push(pkgWatcher.close);
        state.watchers.push(pkgWatcher);
    }

    /**
     * Watch all tests and run them on changes.
     */

    const runTests = async () => {

        if (state.building.has('tests')) return;

        state.building.add('tests');
        testsWatcher.pause();

        await spinner(
            'Running all tests...',
            () => fwdio`cd ${folders.tests} && pnpm test`.catch(echo)
        );

        state.building.delete('tests');
        testsWatcher.resume();
    };

    state.build.tests = runTests;

    echo('Watching packages for tests...');

    const testsWatcher = watch({
        debounce: 500,
        folder: folders.tests,
        ignore,
        patterns,
        onChange: runTests
    });

    state.cleanups.push(testsWatcher.close);
    state.watchers.push(testsWatcher);

    /**
     * Watch docs and rebuild on changes.
     */

    const buildDocs = async () => {

        if (state.building.has('docs')) return;

        state.building.add('docs');
        docsWatcher.pause();

        await spinner(
            'Building docs...',
            () => fwdio`pnpm docs:build`.catch(echo)
        );

        state.building.delete('docs');
        docsWatcher.resume();

        if (!state.docsPreview) await startDocsPreview();
    };

    state.build.docs = buildDocs;

    echo('Watching docs...');

    const docsWatcher = watch({
        debounce: 1000,
        folder: folders.docs,
        ignore: [
            ...ignore,
            '.vitepress/cache',
            '.vitepress/dist',
            'public/llm',
            'public/llm.txt'
        ],
        patterns: `${patterns},*.md,*.vue,*.css,*.mts`,
        onChange: buildDocs
    });

    state.cleanups.push(docsWatcher.close);
    state.watchers.push(docsWatcher);

    /**
     * Start docs preview.
     */

    await startDocsPreview();

    /**
     * Interactive command menu.
     */

    const packageNames = Object.keys(state.build)
        .filter(k => k.startsWith('@'));

    listenForCommands(packageNames);
};

const listenForCommands = (packageNames) => {

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    echo(chalk.dim('\nPress [r] to run a command, [q] to quit\n'));

    let inMenu = false;

    process.stdin.on('data', async (key) => {

        if (key === '\u0003' || key === 'q') {

            cleanupAndExit();
            return;
        }

        if (inMenu) return;

        if (key === 'r') {

            inMenu = true;
            state.pauseAll();
            process.stdin.setRawMode(false);

            await showMenu(packageNames);

            process.stdin.setRawMode(true);
            state.resumeAll();
            inMenu = false;

            echo(chalk.dim('\nPress [r] to run a command, [q] to quit\n'));
        }
    });
};

const showMenu = async (packageNames) => {

    echo('');
    echo('  1. Build a package');
    echo('  2. Build all packages');
    echo('  3. Test a package');
    echo('  4. Run all tests');
    echo('  5. Build docs');
    echo('');

    const choice = await question('Choose an action: ');

    switch (choice.trim()) {

        case '1': {

            const name = await pickPackage(packageNames);
            if (name) await state.build[name]?.();
            break;
        }

        case '2': {

            for (const name of packageNames) {
                await state.build[name]?.();
            }
            break;
        }

        case '3': {

            const name = await pickPackage(packageNames);

            if (name) {

                const cleanName = name.replace('@logosdx/', '');

                await spinner(
                    `Running tests for ${name}...`,
                    () => fwdio`cd ${folders.tests} && pnpm test ${cleanName}`.catch(echo)
                );
            }
            break;
        }

        case '4': {

            await state.build.tests?.();
            break;
        }

        case '5': {

            await state.build.docs?.();
            break;
        }

        default: {

            echo(chalk.yellow('Cancelled.'));
        }
    }
};

const pickPackage = async (packageNames) => {

    echo('');

    for (let i = 0; i < packageNames.length; i++) {
        echo(`  ${i + 1}. ${packageNames[i]}`);
    }

    echo('');

    const choice = await question('Select package: ');
    const index = parseInt(choice.trim(), 10) - 1;

    if (index < 0 || index >= packageNames.length) {

        echo(chalk.yellow('Cancelled.'));
        return null;
    }

    return packageNames[index];
};

const cleanupAndExit = () => {

    echo('Stopping watcher...');

    for (const cleanup of state.cleanups || []) {
        try { cleanup?.() } catch (e) {}
    }

    globalAbort.abort();

    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.exit(0);
};

process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);
process.on('uncaughtException', (err) => echo('uncaughtException', err));

main();