#!/usr/bin/env zx

/**
 * Builds the full documentation site.
 *
 * 1. Pre-build: Generate llms.txt and llms-full.txt into docs/public/
 * 2. Build: Run VitePress build
 * 3. Post-build: Copy reference .md files into dist/llm/
 */

import 'zx/globals';

const ROOT = path.join(import.meta.dirname, '..');
const LLM_HELPERS_DIR = path.join(ROOT, 'skills', 'logosdx', 'references');
const DOCS_DIR = path.join(ROOT, 'docs');
const DIST_DIR = path.join(DOCS_DIR, '.vitepress', 'dist');
const PUBLIC_DIR = path.join(DOCS_DIR, 'public');

$.verbose = false;

const log = {
    info: (msg) => console.log(chalk.cyan(`→ ${msg}`)),
    success: (msg) => console.log(chalk.green(`✓ ${msg}`)),
    error: (msg) => console.log(chalk.red(`✗ ${msg}`)),
};

// === Read reference files ===

const files = await fs.readdir(LLM_HELPERS_DIR);
const mdFiles = files
    .filter(f => f.endsWith('.md') && f !== 'README.md' && f !== 'REFERENCE.md')
    .sort();

if (mdFiles.length === 0) {

    log.error('No markdown files found in skill/references/');
    process.exit(1);
}

// === Pre-build: Generate .txt files into public/ ===

log.info('Generating llms.txt and llms-full.txt...');

const packageDescriptions = {
    dom: 'DOM manipulation utilities for CSS, attributes, events, and behaviors',
    fetch: 'HTTP client with retries, timeouts, lifecycle hooks, and streaming',
    hooks: 'Lifecycle event system for extensible architectures',
    localize: 'Lightweight i18n with ICU message syntax, plural rules, and a CLI extractor',
    observer: 'Typed event system with regex subscriptions, async iteration, and queues',
    react: 'React context providers and hooks for Observer, Fetch, Storage, Localize, and State Machine',
    'state-machine': 'Finite state machines with guards, async invoke, persistence, and type-safe transitions',
    storage: 'Type-safe persistence with pluggable drivers, scoped prefixes, and event hooks',
    utils: 'Error tuples, retry, circuit breakers, rate limiting, validation, and data operations',
};

const packageLinks = mdFiles
    .map((file) => {

        const name = file.replace('.md', '');
        const url = `https://logosdx.dev/llm/${file}`;
        const desc = packageDescriptions[name] || '';
        return `- [${name}](${url}): ${desc}`;
    })
    .join('\n');

const llmsTxt = `# LogosDX

> Focused TypeScript utilities for building JavaScript applications in any runtime. Zero dependencies, type-safe, and designed for production resilience.

LogosDX provides a collection of packages that work together or independently. Each package follows consistent patterns: error tuples with \`attempt()\`, event-driven architecture, and comprehensive TypeScript support.

## Documentation

- [Getting Started](https://logosdx.dev/getting-started): Installation and basic usage
- [API Reference](https://typedoc.logosdx.dev): Full TypeScript API documentation
- [Cheat Sheet](https://logosdx.dev/cheat-sheet): Quick reference for common patterns

## Packages

${packageLinks}

## Optional

- [GitHub Repository](https://github.com/logosdx/monorepo): Source code and issue tracker
`;

await fs.writeFile(path.join(PUBLIC_DIR, 'llms.txt'), llmsTxt);
log.success(`Generated llms.txt with ${mdFiles.length} package links`);

const fullSections = [];

for (const file of mdFiles) {

    const content = await fs.readFile(path.join(LLM_HELPERS_DIR, file), 'utf-8');
    const stripped = content.replace(/^---[\s\S]*?---\n*/, '');
    fullSections.push(stripped.trim());
}

const llmsFullTxt = `# LogosDX

> Focused TypeScript utilities for building JavaScript applications in any runtime. Zero dependencies, type-safe, and designed for production resilience.

LogosDX provides a collection of packages that work together or independently. Each package follows consistent patterns: error tuples with \`attempt()\`, event-driven architecture, and comprehensive TypeScript support.

## Documentation

- [Getting Started](https://logosdx.dev/getting-started): Installation and basic usage
- [API Reference](https://typedoc.logosdx.dev): Full TypeScript API documentation
- [Cheat Sheet](https://logosdx.dev/cheat-sheet): Quick reference for common patterns

---

${fullSections.join('\n\n---\n\n')}
`;

await fs.writeFile(path.join(PUBLIC_DIR, 'llms-full.txt'), llmsFullTxt);
log.success(`Generated llms-full.txt with ${mdFiles.length} inlined packages`);

// === Build: Run VitePress ===

log.info('Building VitePress site...');
await $`vitepress build docs`;
log.success('VitePress build complete');

// === Post-build: Copy .md reference files into dist/llm/ ===

const distLlmDir = path.join(DIST_DIR, 'llm');
await fs.ensureDir(distLlmDir);

for (const file of mdFiles) {

    await fs.copy(
        path.join(LLM_HELPERS_DIR, file),
        path.join(distLlmDir, file),
    );
}

log.success(`Copied ${mdFiles.length} reference .md files to dist/llm/`);
