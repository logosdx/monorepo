#!/usr/bin/env zx

/**
 * Generates llms.txt following the llmstxt.org specification.
 *
 * Structure:
 * - H1: Project name (required)
 * - Blockquote: Brief summary
 * - H2 sections: File lists with markdown links
 *
 * Also copies skill/references/*.md to docs/public/llm/ for direct access.
 */

import 'zx/globals';

const ROOT = path.join(import.meta.dirname, '..');
const LLM_HELPERS_DIR = path.join(ROOT, 'skill', 'references');
const DOCS_DIR = path.join(ROOT, 'docs');
const OUTPUT_DIR = path.join(DOCS_DIR, 'public', 'llm');
const OUTPUT_PATH = path.join(DOCS_DIR, 'public', 'llms.txt');

$.verbose = false;

const log = {
    info: (msg) => console.log(chalk.cyan(`→ ${msg}`)),
    success: (msg) => console.log(chalk.green(`✓ ${msg}`)),
    error: (msg) => console.log(chalk.red(`✗ ${msg}`)),
};

log.info('Building llms.txt from skill/references...');

const files = await fs.readdir(LLM_HELPERS_DIR);
const mdFiles = files
    .filter(f => f.endsWith('.md') && f !== 'README.md' && f !== 'REFERENCE.md')
    .sort();

if (mdFiles.length === 0) {

    log.error('No markdown files found in skill/references/');
    process.exit(1);
}

// Copy markdown files to public/llm/ for direct access
await fs.ensureDir(OUTPUT_DIR);

for (const file of mdFiles) {

    const source = path.join(LLM_HELPERS_DIR, file);
    const destination = path.join(OUTPUT_DIR, file);

    await fs.copy(source, destination);
}

log.info(`Copied ${mdFiles.length} reference files to docs/public/llm/`);

// Build package links with descriptions
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
        const path = `https://logosdx.dev/llm/${file}`;
        const desc = packageDescriptions[name] || '';
        return `- [${name}](${path}): ${desc}`;
    })
    .join('\n');

// Generate llms.txt following the spec
const output = `# LogosDX

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

await fs.writeFile(OUTPUT_PATH, output);

log.success(`Generated llms.txt with ${mdFiles.length} package links`);

// Generate llms-full.txt — inlines all package reference content
const FULL_OUTPUT_PATH = path.join(DOCS_DIR, 'public', 'llms-full.txt');

const fullSections = [];

for (const file of mdFiles) {

    const source = path.join(LLM_HELPERS_DIR, file);
    const content = await fs.readFile(source, 'utf-8');

    // Strip YAML frontmatter if present
    const stripped = content.replace(/^---[\s\S]*?---\n*/, '');
    fullSections.push(stripped.trim());
}

const fullOutput = `# LogosDX

> Focused TypeScript utilities for building JavaScript applications in any runtime. Zero dependencies, type-safe, and designed for production resilience.

LogosDX provides a collection of packages that work together or independently. Each package follows consistent patterns: error tuples with \`attempt()\`, event-driven architecture, and comprehensive TypeScript support.

## Documentation

- [Getting Started](https://logosdx.dev/getting-started): Installation and basic usage
- [API Reference](https://typedoc.logosdx.dev): Full TypeScript API documentation
- [Cheat Sheet](https://logosdx.dev/cheat-sheet): Quick reference for common patterns

---

${fullSections.join('\n\n---\n\n')}
`;

await fs.writeFile(FULL_OUTPUT_PATH, fullOutput);

log.success(`Generated llms-full.txt with ${mdFiles.length} inlined packages`);
