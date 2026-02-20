# Locale Type Extractor CLI Implementation Plan


> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI codegen tool inside `@logosdx/localize` that reads JSON locale files and emits a TypeScript interface + locale code union for type-safe `t()` calls.

**Architecture:** Two new files — `extractor.ts` (pure functions for scanning, converting, generating) and `cli.ts` (Node CLI entry point). Extractor is fully testable without filesystem. CLI wires it together with `fs` and `process.argv`.

**Tech Stack:** Node.js `fs`/`path`, `process.argv` (no arg-parsing deps), Vitest for tests.

---


### Task 1: Core extractor — `jsonToInterface()`

**Files:**
- Create: `packages/localize/src/extractor.ts`
- Create: `tests/src/localize-extractor.ts`

**Context:** This function converts a parsed JSON object into TypeScript interface body text. It's the core building block — everything else builds on it.

**Step 1: Write the failing tests**

In `tests/src/localize-extractor.ts`:

```typescript
import { describe, it, expect } from 'vitest';

import {
    jsonToInterface
} from '../../packages/localize/src/extractor.ts';

describe('@logosdx/localize: extractor', () => {

    describe('jsonToInterface', () => {

        it('should convert flat string values to string type', () => {

            const result = jsonToInterface({ title: 'Hello', subtitle: 'World' }, 1);
            expect(result).to.equal(
                '    title: string;\n' +
                '    subtitle: string;\n'
            );
        });

        it('should convert nested objects recursively', () => {

            const result = jsonToInterface({
                login: { title: 'Login', subtitle: 'Welcome' }
            }, 1);

            expect(result).to.equal(
                '    login: {\n' +
                '        title: string;\n' +
                '        subtitle: string;\n' +
                '    };\n'
            );
        });

        it('should convert number values to string type', () => {

            const result = jsonToInterface({ count: 42 }, 1);
            expect(result).to.equal('    count: string;\n');
        });

        it('should handle deeply nested objects', () => {

            const result = jsonToInterface({
                a: { b: { c: 'deep' } }
            }, 1);

            expect(result).to.equal(
                '    a: {\n' +
                '        b: {\n' +
                '            c: string;\n' +
                '        };\n' +
                '    };\n'
            );
        });

        it('should skip array values', () => {

            const result = jsonToInterface({ items: ['a', 'b'], title: 'ok' }, 1);
            expect(result).to.equal('    title: string;\n');
        });
    });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd tests && pnpm test localize-extractor`
Expected: FAIL — `jsonToInterface` not found

**Step 3: Implement `jsonToInterface`**

In `packages/localize/src/extractor.ts`:

```typescript
const INDENT = '    ';

/**
 * Converts a parsed JSON object into TypeScript interface body text.
 *
 * WHY: Translates locale JSON structure into typed interface properties
 * so that LocaleManager generic parameter gets full autocomplete.
 *
 * @example
 *
 *     jsonToInterface({ login: { title: 'Login' } }, 1)
 *     // '    login: {\n        title: string;\n    };\n'
 */
export const jsonToInterface = (
    obj: Record<string, unknown>,
    depth: number
): string => {

    const prefix = INDENT.repeat(depth);
    let output = '';

    for (const key of Object.keys(obj)) {

        const value = obj[key];

        if (Array.isArray(value)) {

            continue;
        }

        if (typeof value === 'object' && value !== null) {

            output += `${prefix}${key}: {\n`;
            output += jsonToInterface(value as Record<string, unknown>, depth + 1);
            output += `${prefix}};\n`;
        }
        else {

            output += `${prefix}${key}: string;\n`;
        }
    }

    return output;
};
```

**Step 4: Run tests to verify they pass**

Run: `cd tests && pnpm test localize-extractor`
Expected: PASS — all 5 tests green

**Step 5: Commit**

```bash
git add packages/localize/src/extractor.ts tests/src/localize-extractor.ts
git commit -m "feat(localize): add jsonToInterface extractor function"
```

---


### Task 2: Directory scanner — `scanDirectory()`

**Files:**
- Modify: `packages/localize/src/extractor.ts`
- Modify: `tests/src/localize-extractor.ts`

**Context:** This function walks an i18n directory and returns structured data: root shape, namespace shapes, and locale codes. It uses `fs` directly — tests will create real temp directories.

**Step 1: Write the failing tests**

Add to the test file:

```typescript
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

describe('scanDirectory', () => {

    const tmpDir = join(import.meta.dirname, '../../tmp/test-i18n');

    const setup = (structure: Record<string, Record<string, unknown>>) => {

        rmSync(tmpDir, { recursive: true, force: true });

        for (const [filePath, content] of Object.entries(structure)) {

            const full = join(tmpDir, filePath);
            mkdirSync(join(full, '..'), { recursive: true });
            writeFileSync(full, JSON.stringify(content));
        }
    };

    afterEach(() => {

        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should scan flat layout (root JSON files)', () => {

        setup({
            'en.json': { title: 'Hello' },
            'es.json': { title: 'Hola' },
        });

        const result = scanDirectory(tmpDir, 'en');

        expect(result.rootShape).to.deep.equal({ title: 'Hello' });
        expect(result.namespaces).to.deep.equal({});
        expect(result.codes.sort()).to.deep.equal(['en', 'es']);
    });

    it('should scan namespaced layout (subdirectories)', () => {

        setup({
            'auth/en.json': { login: { title: 'Login' } },
            'auth/es.json': { login: { title: 'Iniciar' } },
            'billing/en.json': { invoice: { total: 'Total' } },
        });

        const result = scanDirectory(tmpDir, 'en');

        expect(result.rootShape).to.be.null;
        expect(result.namespaces).to.deep.equal({
            auth: { login: { title: 'Login' } },
            billing: { invoice: { total: 'Total' } },
        });
        expect(result.codes.sort()).to.deep.equal(['en', 'es']);
    });

    it('should scan mixed layout (flat + namespaced)', () => {

        setup({
            'en.json': { app: { name: 'MyApp' } },
            'es.json': { app: { name: 'MiApp' } },
            'auth/en.json': { login: { title: 'Login' } },
        });

        const result = scanDirectory(tmpDir, 'en');

        expect(result.rootShape).to.deep.equal({ app: { name: 'MyApp' } });
        expect(result.namespaces).to.deep.equal({
            auth: { login: { title: 'Login' } },
        });
        expect(result.codes.sort()).to.deep.equal(['en', 'es']);
    });

    it('should skip namespace when locale file is missing', () => {

        setup({
            'auth/es.json': { login: { title: 'Iniciar' } },
        });

        const result = scanDirectory(tmpDir, 'en');

        expect(result.namespaces).to.deep.equal({});
        expect(result.codes).to.deep.equal(['es']);
    });

    it('should throw on malformed JSON', () => {

        rmSync(tmpDir, { recursive: true, force: true });
        mkdirSync(tmpDir, { recursive: true });
        writeFileSync(join(tmpDir, 'en.json'), '{ broken json');

        expect(() => scanDirectory(tmpDir, 'en')).to.throw();
    });
});
```

Update the import at the top:

```typescript
import {
    jsonToInterface,
    scanDirectory
} from '../../packages/localize/src/extractor.ts';
```

**Step 2: Run tests to verify they fail**

Run: `cd tests && pnpm test localize-extractor`
Expected: FAIL — `scanDirectory` not found

**Step 3: Implement `scanDirectory`**

Add to `packages/localize/src/extractor.ts`:

```typescript
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface ScanResult {
    rootShape: Record<string, unknown> | null;
    namespaces: Record<string, Record<string, unknown>>;
    codes: string[];
}

/**
 * Scans a directory for locale JSON files and returns structured data.
 *
 * WHY: Separates filesystem concerns from type generation,
 * enabling the generator to work with pre-parsed data.
 *
 * @example
 *
 *     const result = scanDirectory('./i18n', 'en');
 *     // { rootShape: {...}, namespaces: { auth: {...} }, codes: ['en', 'es'] }
 */
export const scanDirectory = (dir: string, locale: string): ScanResult => {

    const codes = new Set<string>();
    const namespaces: Record<string, Record<string, unknown>> = {};
    let rootShape: Record<string, unknown> | null = null;

    const entries = readdirSync(dir);

    for (const entry of entries) {

        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isFile() && entry.endsWith('.json')) {

            const code = entry.replace('.json', '');
            codes.add(code);

            if (code === locale) {

                const raw = readFileSync(fullPath, 'utf-8');
                rootShape = JSON.parse(raw);
            }
        }
        else if (stat.isDirectory()) {

            const nsEntries = readdirSync(fullPath);

            for (const nsEntry of nsEntries) {

                if (!nsEntry.endsWith('.json')) continue;

                const code = nsEntry.replace('.json', '');
                codes.add(code);

                if (code === locale) {

                    const raw = readFileSync(join(fullPath, nsEntry), 'utf-8');
                    namespaces[entry] = JSON.parse(raw);
                }
            }
        }
    }

    return { rootShape, namespaces, codes: Array.from(codes) };
};
```

**Step 4: Run tests to verify they pass**

Run: `cd tests && pnpm test localize-extractor`
Expected: PASS — all tests green

**Step 5: Commit**

```bash
git add packages/localize/src/extractor.ts tests/src/localize-extractor.ts
git commit -m "feat(localize): add scanDirectory for locale file discovery"
```

---


### Task 3: Output generator — `generateOutput()`

**Files:**
- Modify: `packages/localize/src/extractor.ts`
- Modify: `tests/src/localize-extractor.ts`

**Context:** This function takes a `ScanResult` and interface name, and produces the complete TypeScript output string.

**Step 1: Write the failing tests**

Add to the test file:

```typescript
import {
    jsonToInterface,
    scanDirectory,
    generateOutput
} from '../../packages/localize/src/extractor.ts';

describe('generateOutput', () => {

    it('should generate interface from root shape only', () => {

        const result = generateOutput({
            rootShape: { title: 'Hello', subtitle: 'World' },
            namespaces: {},
            codes: ['en', 'es'],
        }, 'AppLocale');

        expect(result).to.contain('export interface AppLocale {');
        expect(result).to.contain('    title: string;');
        expect(result).to.contain('    subtitle: string;');
        expect(result).to.contain("export type LocaleCodes = 'en' | 'es';");
    });

    it('should generate interface from namespaces only', () => {

        const result = generateOutput({
            rootShape: null,
            namespaces: {
                auth: { login: { title: 'Login' } },
            },
            codes: ['en'],
        }, 'AppLocale');

        expect(result).to.contain('    auth: {');
        expect(result).to.contain('        login: {');
        expect(result).to.contain('            title: string;');
    });

    it('should generate interface from mixed layout', () => {

        const result = generateOutput({
            rootShape: { app: { name: 'MyApp' } },
            namespaces: { auth: { login: { title: 'Login' } } },
            codes: ['en', 'es', 'fr'],
        }, 'MyLocale');

        expect(result).to.contain('export interface MyLocale {');
        expect(result).to.contain('    app: {');
        expect(result).to.contain('    auth: {');
        expect(result).to.contain("export type LocaleCodes = 'en' | 'es' | 'fr';");
    });

    it('should include auto-generated header comment', () => {

        const result = generateOutput({
            rootShape: { title: 'Hi' },
            namespaces: {},
            codes: ['en'],
        }, 'AppLocale');

        expect(result).to.contain('Auto-generated');
        expect(result).to.contain('do not edit');
    });

    it('should sort locale codes alphabetically', () => {

        const result = generateOutput({
            rootShape: null,
            namespaces: {},
            codes: ['fr', 'en', 'es'],
        }, 'AppLocale');

        expect(result).to.contain("'en' | 'es' | 'fr'");
    });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd tests && pnpm test localize-extractor`
Expected: FAIL — `generateOutput` not found

**Step 3: Implement `generateOutput`**

Add to `packages/localize/src/extractor.ts`:

```typescript
/**
 * Generates a complete TypeScript file string from scan results.
 *
 * WHY: Produces the final output that users import for type-safe t() calls.
 * Keeps generation logic pure and testable — no filesystem writes here.
 *
 * @example
 *
 *     const ts = generateOutput(scanResult, 'AppLocale');
 *     // '// Auto-generated...\nexport interface AppLocale {\n...'
 */
export const generateOutput = (
    scan: ScanResult,
    interfaceName: string
): string => {

    let output = '// Auto-generated by @logosdx/localize — do not edit\n\n';

    output += `export interface ${interfaceName} {\n`;

    if (scan.rootShape) {

        output += jsonToInterface(scan.rootShape, 1);
    }

    for (const ns of Object.keys(scan.namespaces).sort()) {

        output += `${INDENT}${ns}: {\n`;
        output += jsonToInterface(scan.namespaces[ns], 2);
        output += `${INDENT}};\n`;
    }

    output += '}\n\n';

    const sortedCodes = scan.codes.sort();
    const codeUnion = sortedCodes.map(c => `'${c}'`).join(' | ');
    output += `export type LocaleCodes = ${codeUnion};\n`;

    return output;
};
```

**Step 4: Run tests to verify they pass**

Run: `cd tests && pnpm test localize-extractor`
Expected: PASS — all tests green

**Step 5: Commit**

```bash
git add packages/localize/src/extractor.ts tests/src/localize-extractor.ts
git commit -m "feat(localize): add generateOutput for TypeScript codegen"
```

---


### Task 4: CLI entry point

**Files:**
- Create: `packages/localize/src/cli.ts`
- Modify: `packages/localize/package.json`

**Context:** The CLI parses `process.argv`, calls the extractor functions, and writes the output file. It also supports `--watch` mode via `fs.watch` with debounce.

**Step 1: Write the failing test**

Add to `tests/src/localize-extractor.ts`:

```typescript
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

describe('CLI integration', () => {

    const tmpDir = join(import.meta.dirname, '../../tmp/test-i18n-cli');
    const outFile = join(import.meta.dirname, '../../tmp/test-output.ts');
    const cliPath = join(import.meta.dirname, '../../packages/localize/src/cli.ts');

    const setup = (structure: Record<string, Record<string, unknown>>) => {

        rmSync(tmpDir, { recursive: true, force: true });
        rmSync(outFile, { force: true });

        for (const [filePath, content] of Object.entries(structure)) {

            const full = join(tmpDir, filePath);
            mkdirSync(join(full, '..'), { recursive: true });
            writeFileSync(full, JSON.stringify(content));
        }
    };

    afterEach(() => {

        rmSync(tmpDir, { recursive: true, force: true });
        rmSync(outFile, { force: true });
    });

    it('should generate types from namespaced directory', () => {

        setup({
            'auth/en.json': { login: { title: 'Login' } },
            'auth/es.json': { login: { title: 'Iniciar' } },
            'billing/en.json': { invoice: { total: 'Total' } },
        });

        execSync(`npx tsx ${cliPath} extract --dir ${tmpDir} --out ${outFile}`);

        const output = readFileSync(outFile, 'utf-8');
        expect(output).to.contain('export interface AppLocale {');
        expect(output).to.contain('auth: {');
        expect(output).to.contain('billing: {');
        expect(output).to.contain("export type LocaleCodes = 'en' | 'es';");
    });

    it('should use custom interface name', () => {

        setup({ 'en.json': { title: 'Hi' } });

        execSync(`npx tsx ${cliPath} extract --dir ${tmpDir} --out ${outFile} --name MyLocale`);

        const output = readFileSync(outFile, 'utf-8');
        expect(output).to.contain('export interface MyLocale {');
    });

    it('should exit with error on missing --dir', () => {

        expect(() => {

            execSync(`npx tsx ${cliPath} extract --out ${outFile}`, { stdio: 'pipe' });
        }).to.throw();
    });

    it('should exit with error on missing --out', () => {

        setup({ 'en.json': { title: 'Hi' } });

        expect(() => {

            execSync(`npx tsx ${cliPath} extract --dir ${tmpDir}`, { stdio: 'pipe' });
        }).to.throw();
    });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd tests && pnpm test localize-extractor`
Expected: FAIL — `cli.ts` doesn't exist

**Step 3: Implement `cli.ts`**

In `packages/localize/src/cli.ts`:

```typescript
#!/usr/bin/env node

import { writeFileSync, watch } from 'node:fs';
import { resolve } from 'node:path';

import { scanDirectory, generateOutput } from './extractor.ts';

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

const resolvedDir = resolve(dir);
const resolvedOut = resolve(out);

const extract = () => {

    const scan = scanDirectory(resolvedDir, locale);
    const output = generateOutput(scan, name);
    writeFileSync(resolvedOut, output);
    console.log(`Generated ${resolvedOut}`);
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
```

Update `packages/localize/package.json` — add `bin` field:

```json
{
    "bin": {
        "logosdx-locale": "./dist/cli.js"
    }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd tests && pnpm test localize-extractor`
Expected: PASS — all tests green

**Step 5: Commit**

```bash
git add packages/localize/src/cli.ts packages/localize/package.json tests/src/localize-extractor.ts
git commit -m "feat(localize): add CLI entry point for locale type extraction"
```

---


### Task 5: Export and build integration

**Files:**
- Modify: `packages/localize/src/index.ts`
- Modify: `packages/localize/package.json`

**Context:** Export the extractor functions from the barrel (for programmatic use) and ensure the CLI builds correctly. The CLI needs a shebang and must target Node.

**Step 1: Update barrel exports**

In `packages/localize/src/index.ts`, add:

```typescript
export { scanDirectory, generateOutput, jsonToInterface } from './extractor.ts';
export type { ScanResult } from './extractor.ts';
```

**Step 2: Update package.json exports**

Add a `cli` export to `packages/localize/package.json`:

```json
{
    "exports": {
        ".": {
            "types": "./dist/types/index.d.ts",
            "require": "./dist/cjs/index.js",
            "import": "./dist/esm/index.mjs"
        },
        "./cli": {
            "import": "./dist/esm/cli.mjs",
            "require": "./dist/cjs/cli.js"
        }
    },
    "bin": {
        "logosdx-locale": "./dist/esm/cli.mjs"
    }
}
```

**Step 3: Verify build works**

Run: `cd packages/localize && pnpm build`
Expected: Build completes without errors.

**Step 4: Verify tests still pass**

Run: `cd tests && pnpm test localize-extractor`
Expected: PASS — all tests green

**Step 5: Commit**

```bash
git add packages/localize/src/index.ts packages/localize/package.json
git commit -m "feat(localize): export extractor functions, add bin entry"
```

---


### Task 6: Documentation

**Files:**
- Modify: `llm-helpers/localize.md` — add CLI section
- Modify: `docs/packages/localize.md` — add Type Extractor CLI section

**Context:** Document the CLI usage, directory structure expectations, and generated output format.

**Step 1: Add CLI section to llm-helpers**

Add a section to `llm-helpers/localize.md` covering:
- CLI usage (`npx logosdx-locale extract --dir ... --out ...`)
- Directory structure (flat, namespaced, mixed)
- Generated output format
- Watch mode
- Programmatic API (`scanDirectory`, `generateOutput`, `jsonToInterface`)

**Step 2: Add CLI section to VitePress docs**

Add a section to `docs/packages/localize.md` covering:
- Installation reminder
- CLI usage with all flags
- Directory structure examples
- Generated output example
- How to wire into LocaleManager
- Watch mode for development

**Step 3: Commit**

```bash
git add llm-helpers/localize.md docs/packages/localize.md
git commit -m "docs(localize): document type extractor CLI"
```
