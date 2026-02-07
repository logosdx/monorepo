import { watch as fsWatch, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';

/**
 * Watch a folder recursively for file changes matching given patterns.
 * Debounces rapid changes into a single batched callback with deduplicated paths.
 *
 * @param {object} config - Watcher configuration
 * @param {string} config.folder - Directory to watch
 * @param {string} config.patterns - Comma-separated glob extensions (e.g. '*.ts,*.json')
 * @param {(event: { files: string[], deleted: string[] }) => void} config.onChange - Called with changed and deleted file paths
 * @param {string[]} [config.ignore] - Directory/file segments to ignore (e.g. ['node_modules', 'dist'])
 * @param {number} [config.debounce=100] - Debounce interval in milliseconds
 * @returns {{ close: () => void, pause: () => void, resume: () => void }} Watcher handle
 *
 * @example
 *
 *     const watcher = watch({
 *         folder: 'packages',
 *         patterns: '*.ts,*.json',
 *         ignore: ['node_modules', 'dist', '.git'],
 *         onChange: ({ files, deleted }) => {
 *             console.log('Changed:', files);
 *             console.log('Deleted:', deleted);
 *         },
 *     });
 *
 *     // Suppress events during builds to prevent circular triggers
 *     watcher.pause();
 *     await build();
 *     watcher.resume();
 */
export function watch({ folder, patterns, onChange, ignore, debounce = 100 }) {

    const dir = resolve(folder);

    if (!existsSync(dir)) {

        throw new Error(`watch: directory does not exist: ${dir}`);
    }

    const extensions = parsePatterns(patterns);
    const ignored = buildIgnoreSet(ignore);
    const pendingFiles = new Set();
    const pendingDeleted = new Set();
    let timer = null;
    let paused = false;

    const watcher = fsWatch(dir, { recursive: true }, (_event, filename) => {

        if (paused) return;
        if (!filename) return;
        if (isIgnored(filename, ignored)) return;
        if (!matchesExtension(filename, extensions)) return;

        const fullPath = resolve(dir, filename);

        if (existsSync(fullPath)) {

            pendingFiles.add(fullPath);
            pendingDeleted.delete(fullPath);
        }
        else {

            pendingDeleted.add(fullPath);
            pendingFiles.delete(fullPath);
        }

        clearTimeout(timer);
        timer = setTimeout(flush, debounce);
    });

    function flush() {

        if (pendingFiles.size === 0 && pendingDeleted.size === 0) return;

        const files = [...pendingFiles];
        const deleted = [...pendingDeleted];
        pendingFiles.clear();
        pendingDeleted.clear();
        timer = null;

        onChange({ files, deleted });
    }

    function close() {

        clearTimeout(timer);
        watcher.close();
    }

    /**
     * Suppresses all events and discards any pending changes.
     * Use before builds to prevent artifacts from re-triggering the watcher.
     */
    function pause() {

        paused = true;
        clearTimeout(timer);
        pendingFiles.clear();
        pendingDeleted.clear();
    }

    /**
     * Re-enables event collection after a pause.
     */
    function resume() {

        paused = false;
    }

    return { close, pause, resume };
}

/**
 * Normalizes a comma-separated pattern string into a Set of file extensions.
 * Accepts flexible input formats: '*.ts', '.ts', or just 'ts'.
 *
 * @param {string} patterns - Comma-separated extension patterns
 * @returns {Set<string>} Set of normalized extensions (e.g. {'.ts', '.json'})
 *
 * @example
 *
 *     parsePatterns('*.ts, *.json, mjs');
 *     // => Set { '.ts', '.json', '.mjs' }
 */
function parsePatterns(patterns) {

    return new Set(
        patterns
            .split(',')
            .map(p => p.trim())
            .map(p => {

                if (p.startsWith('*.')) return p.slice(1);
                if (p.startsWith('.')) return p;
                return `.${p}`;
            })
    );
}

/**
 * Splits ignore entries into single-segment names (O(1) Set lookup) and
 * multi-segment paths (substring matching). Returns null when no rules are provided.
 *
 * @param {string[] | undefined} ignore - Names or paths to ignore
 * @returns {{ segments: Set<string>, paths: string[] } | null}
 *
 * @example
 *
 *     buildIgnoreSet(['node_modules', '.vitepress/cache']);
 *     // => { segments: Set { 'node_modules' }, paths: ['.vitepress/cache'] }
 *
 *     buildIgnoreSet(undefined);
 *     // => null
 */
function buildIgnoreSet(ignore) {

    if (!ignore || ignore.length === 0) return null;

    const segments = new Set();
    const paths = [];

    for (const entry of ignore) {

        if (entry.includes('/')) paths.push(entry);
        else segments.add(entry);
    }

    return { segments, paths };
}

/**
 * Checks whether a file path matches any ignored entry.
 * Single-segment entries are matched against individual path segments.
 * Multi-segment entries are matched as path prefixes or subpaths.
 *
 * @param {string} filename - Relative file path from the watched directory
 * @param {{ segments: Set<string>, paths: string[] } | null} ignored - Ignored rules, or null to skip
 * @returns {boolean} True if the file should be ignored
 *
 * @example
 *
 *     const ignored = buildIgnoreSet(['node_modules', '.vitepress/cache']);
 *     isIgnored('observer/node_modules/foo/bar.ts', ignored);
 *     // => true
 *
 *     isIgnored('.vitepress/cache/deps/foo.js', ignored);
 *     // => true
 *
 *     isIgnored('observer/src/index.ts', ignored);
 *     // => false
 */
function isIgnored(filename, ignored) {

    if (!ignored) return false;

    const parts = filename.split('/');

    for (const part of parts) {

        if (ignored.segments.has(part)) return true;
    }

    for (const p of ignored.paths) {

        if (filename.startsWith(p + '/') || filename.startsWith(p) || filename.includes('/' + p + '/') || filename.endsWith('/' + p)) return true;
    }

    return false;
}

/**
 * Tests whether a filename's extension exists in the allowed extensions Set.
 *
 * @param {string} filename - File path to check
 * @param {Set<string>} extensions - Allowed extensions (e.g. {'.ts', '.json'})
 * @returns {boolean} True if the file's extension is in the Set
 *
 * @example
 *
 *     matchesExtension('src/index.ts', new Set(['.ts', '.json']));
 *     // => true
 *
 *     matchesExtension('readme.md', new Set(['.ts', '.json']));
 *     // => false
 */
function matchesExtension(filename, extensions) {

    return extensions.has(extname(filename));
}
