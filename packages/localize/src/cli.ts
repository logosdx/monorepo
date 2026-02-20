#!/usr/bin/env node

import { writeFileSync, watch, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { attemptSync } from '@logosdx/utils';

import { scanDirectory, generateOutput, VALID_IDENT } from './extractor.ts';

const args = process.argv.slice(2);

const getFlag = (name: string): string | undefined => {

    const idx = args.indexOf(`--${name}`);

    if (idx === -1 || idx + 1 >= args.length) return undefined;

    return args[idx + 1];
};

const hasFlag = (name: string): boolean => args.includes(`--${name}`);

const command = args[0];

if (command !== 'extract') {

    console.error('Usage: logosdx-locale extract --dir <path> --out <path> [--locale <code>] [--name <name>] [--watch]');
    process.exit(1);
}

const dir = getFlag('dir');
const out = getFlag('out');
const locale = getFlag('locale') || 'en';
const name = getFlag('name') || 'AppLocale';
const watchMode = hasFlag('watch');

if (!dir) {

    console.error('Error: --dir is required');
    process.exit(1);
}

if (!out) {

    console.error('Error: --out is required');
    process.exit(1);
}

if (!VALID_IDENT.test(name)) {

    console.error(`Error: --name "${name}" is not a valid TypeScript identifier`);
    process.exit(1);
}

const resolvedDir = resolve(dir);
const resolvedOut = resolve(out);

const dirStat = statSync(resolvedDir, { throwIfNoEntry: false });

if (!dirStat?.isDirectory()) {

    console.error(`Error: "${resolvedDir}" is not a directory`);
    process.exit(1);
}

const extract = () => {

    const [, scanErr] = attemptSync(() => {

        const scan = scanDirectory(resolvedDir, locale);
        const output = generateOutput(scan, name);
        writeFileSync(resolvedOut, output);
        console.log(`Generated ${resolvedOut}`);
    });

    if (scanErr) {

        console.error(`Error: ${scanErr.message}`);

        if (!watchMode) process.exit(1);
    }
};

extract();

if (watchMode) {

    let timeout: ReturnType<typeof setTimeout> | null = null;

    watch(resolvedDir, { recursive: true }, () => {

        if (timeout) clearTimeout(timeout);

        timeout = setTimeout(() => {

            console.log('Change detected, regenerating...');
            extract();
        }, 100);
    });

    console.log(`Watching ${resolvedDir} for changes...`);
}
