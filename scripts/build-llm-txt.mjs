#!/usr/bin/env zx

/**
 * Generates llms.txt following the llmstxt.org specification.
 *
 * Structure:
 * - H1: Project name (required)
 * - Blockquote: Brief summary
 * - H2 sections: File lists with markdown links
 *
 * Also copies llm-helpers/*.md to docs/public/llm/ for direct access.
 */

import 'zx/globals';

const ROOT = path.join(import.meta.dirname, '..');
const LLM_HELPERS_DIR = path.join(ROOT, 'llm-helpers');
const DOCS_DIR = path.join(ROOT, 'docs');
const OUTPUT_DIR = path.join(DOCS_DIR, 'public', 'llm');
const OUTPUT_PATH = path.join(DOCS_DIR, 'public', 'llms.txt');

$.verbose = false;

const log = {
    info: (msg) => console.log(chalk.cyan(`→ ${msg}`)),
    success: (msg) => console.log(chalk.green(`✓ ${msg}`)),
    error: (msg) => console.log(chalk.red(`✗ ${msg}`)),
};

log.info('Building llms.txt from llm-helpers...');

const files = await fs.readdir(LLM_HELPERS_DIR);
const mdFiles = files
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .sort();

if (mdFiles.length === 0) {

    log.error('No markdown files found in llm-helpers/');
    process.exit(1);
}

// Copy markdown files to public/llm/ for direct access
await fs.ensureDir(OUTPUT_DIR);

for (const file of mdFiles) {

    const source = path.join(LLM_HELPERS_DIR, file);
    const destination = path.join(OUTPUT_DIR, file);

    await fs.copy(source, destination);
}

log.info(`Copied ${mdFiles.length} files to docs/public/llm/`);

// Build package links with descriptions
const packageDescriptions = {
    dom: 'DOM manipulation utilities for CSS, attributes, events, and behaviors',
    fetch: 'HTTP client with retry logic, lifecycle hooks, and state management',
    hooks: 'Lifecycle event system for extensible architectures',
    localize: 'Internationalization system for multi-language support',
    observer: 'Event-driven architecture with queues and regex matching',
    storage: 'Type-safe persistence layer for browser storage',
    utils: 'Core utilities for flow control, data structures, and validation',
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
