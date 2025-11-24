#!/usr/bin/env node
/**
 * Memory Test UI Server
 *
 * Simple HTTP server that serves the memory test visualization UI
 * and provides API endpoints for test data.
 *
 * Usage:
 *   pnpm tsx src/experiments/memory-tests/ui/server.ts [port]
 *
 * Example:
 *   pnpm tsx src/experiments/memory-tests/ui/server.ts 3000
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSession, Session } from 'better-sse';

const PORT = parseInt(process.argv[2] || '3456', 10);
const FILE_CHECK_INTERVAL = 2000; // Check for new files every 2 seconds

// Get monorepo root (5 levels up from this file: ui/server.ts -> memory-tests -> experiments -> src -> tests -> monorepo)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, '../../../../../');
const DATA_DIR = path.join(monorepoRoot, 'tmp', 'memory-tests');

// In-memory storage for live data from harness
let liveData: unknown = null;

// Track connected SSE sessions
const sseSessions: Set<Session> = new Set();

// Track last known file list for change detection
let lastFileList: string[] = [];

/**
 * Get the HTML page content
 */
function getHtmlPage(): string {

    // Use __dirname equivalent for ESM
    const currentDir = new URL('.', import.meta.url).pathname;
    const htmlPath = path.join(currentDir, 'index.html');
    return fs.readFileSync(htmlPath, 'utf-8');
}

/**
 * Get saved test results from file
 */
function getSavedResults(filename: string): unknown {

    const filePath = path.join(DATA_DIR, filename);

    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    return null;
}

/**
 * List available result files
 */
function listResultFiles(): string[] {

    if (!fs.existsSync(DATA_DIR)) {
        return [];
    }

    return fs.readdirSync(DATA_DIR)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();
}

/**
 * Handle HTTP requests
 */
async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {

    const url = new URL(req.url || '/', `http://localhost:${PORT}`);

    // CORS headers for development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {

        res.writeHead(204);
        res.end();
        return;
    }

    // Route handling
    if (url.pathname === '/' || url.pathname === '/index.html') {

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(getHtmlPage());
        return;
    }

    if (url.pathname === '/api/files') {

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(listResultFiles()));
        return;
    }

    if (url.pathname === '/api/data') {

        const filename = url.searchParams.get('file');

        if (filename) {

            const data = getSavedResults(filename);

            if (data) {

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
                return;
            }

            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'File not found' }));
            return;
        }

        // Return live data if no file specified
        if (liveData) {

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(liveData));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No data available' }));
        return;
    }

    if (url.pathname === '/api/live' && req.method === 'POST') {

        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {

            try {

                liveData = JSON.parse(body);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            }
            catch {

                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });

        return;
    }

    // SSE endpoint for file updates
    if (url.pathname === '/api/events') {

        const session = await createSession(req, res);

        sseSessions.add(session);

        // Send current file list immediately
        session.push(listResultFiles(), 'files');

        // Clean up on disconnect
        session.on('disconnected', () => {
            sseSessions.delete(session);
        });

        return;
    }

    // 404 for everything else
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
}

/**
 * Check for file changes and broadcast to connected clients
 */
function checkForFileChanges(): void {

    const currentFiles = listResultFiles();
    const currentSet = new Set(currentFiles);
    const lastSet = new Set(lastFileList);

    // Check if files changed
    const hasChanges = currentFiles.length !== lastFileList.length ||
        currentFiles.some(f => !lastSet.has(f)) ||
        lastFileList.some(f => !currentSet.has(f));

    if (hasChanges) {

        lastFileList = currentFiles;

        // Broadcast to all connected SSE clients
        for (const session of sseSessions) {
            session.push(currentFiles, 'files');
        }

        if (sseSessions.size > 0) {
            console.log(`📡 Broadcasted file update to ${sseSessions.size} client(s)`);
        }
    }
}

// Create and start server
const server = http.createServer(handleRequest);

server.listen(PORT, () => {

    console.log(`\n🧪 Memory Test UI Server`);
    console.log(`   http://localhost:${PORT}\n`);
    console.log(`API Endpoints:`);
    console.log(`   GET  /api/files     - List available result files`);
    console.log(`   GET  /api/data      - Get live data or ?file=<name>`);
    console.log(`   POST /api/live      - Push live data from harness`);
    console.log(`   GET  /api/events    - SSE stream for file updates\n`);

    // Initialize file list and start watching
    lastFileList = listResultFiles();
    setInterval(checkForFileChanges, FILE_CHECK_INTERVAL);
});
