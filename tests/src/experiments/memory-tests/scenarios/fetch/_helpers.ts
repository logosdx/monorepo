/**
 * Fetch Memory Test Helpers
 *
 * Shared utilities for @logosdx/fetch memory testing scenarios.
 * Uses a real Hapi server on port 4123 for realistic fetch testing.
 */

import * as Hapi from '@hapi/hapi';

/** Server port */
const SERVER_PORT = 4123;

/** Base URL for the test server */
export const BASE_URL = `http://localhost:${SERVER_PORT}`;

/**
 * Test server class that encapsulates all server state.
 * Store an instance on your scenario context to avoid global memory pollution.
 */
export class TestServer {

    #server: Hapi.Server | null = null;
    #requestCount = 0;

    /**
     * Gets the current request count.
     */
    get requestCount(): number {

        return this.#requestCount;
    }

    /**
     * Resets the request count.
     */
    resetRequestCount(): void {

        this.#requestCount = 0;
    }

    /**
     * Starts the test server.
     */
    async start(): Promise<void> {

        if (this.#server) {

            return;
        }

        this.#requestCount = 0;

        this.#server = Hapi.server({
            port: SERVER_PORT,
            host: 'localhost'
        });

        // Add Connection: close header to all responses to prevent keep-alive pooling
        this.#server.ext('onPreResponse', (request, h) => {

            const response = request.response;

            if ('header' in response) {
                response.header('Connection', 'close');
            }

            return h.continue;
        });

        // === Default success route ===
        this.#server.route({
            method: '*',
            path: '/success',
            handler: async (request, h) => {

                this.#requestCount++;

                return h.response({ success: true, method: request.method })
                    .type('application/json');
            }
        });

        // === Delayed response route ===
        this.#server.route({
            method: '*',
            path: '/delay/{ms}',
            handler: async (request, h) => {

                this.#requestCount++;

                const delay = parseInt(request.params.ms, 10) || 0;

                await new Promise(resolve => setTimeout(resolve, delay));

                return h.response({ delayed: true, ms: delay })
                    .type('application/json');
            }
        });

        // === Error route ===
        this.#server.route({
            method: '*',
            path: '/error/{code}',
            handler: async (request, h) => {

                this.#requestCount++;

                const code = parseInt(request.params.code, 10) || 500;

                return h.response({ error: true, code })
                    .code(code)
                    .type('application/json');
            }
        });

        // === Large payload route ===
        this.#server.route({
            method: '*',
            path: '/large/{sizeKb}',
            handler: async (request, h) => {

                this.#requestCount++;

                const sizeKb = parseInt(request.params.sizeKb, 10) || 10;
                const data = 'x'.repeat(sizeKb * 1024);

                return h.response({ data })
                    .type('application/json');
            }
        });

        // === Echo route (returns request info) ===
        this.#server.route({
            method: '*',
            path: '/echo',
            handler: async (request, h) => {

                this.#requestCount++;

                return h.response({
                    method: request.method,
                    headers: request.headers,
                    query: request.query,
                    payload: request.payload
                }).type('application/json');
            }
        });

        // === Catch-all route ===
        this.#server.route({
            method: '*',
            path: '/{path*}',
            handler: async (request, h) => {

                this.#requestCount++;

                return h.response({
                    path: request.path,
                    method: request.method,
                    timestamp: Date.now()
                }).type('application/json');
            }
        });

        await this.#server.start();
    }

    /**
     * Stops the test server.
     */
    async stop(): Promise<void> {

        if (this.#server) {

            await this.#server.stop();
            this.#server = null;
        }
    }
}

/**
 * Creates a large payload object for testing memory retention.
 */
export function createLargePayload(sizeKb: number = 10): Record<string, string> {

    const obj: Record<string, string> = {};
    const charsPerKey = 100;
    const keysNeeded = Math.ceil((sizeKb * 1024) / charsPerKey);

    for (let i = 0; i < keysNeeded; i++) {

        obj[`field_${i}`] = 'x'.repeat(charsPerKey);
    }

    return obj;
}

/**
 * Creates multiple headers for testing header management.
 */
export function createHeaders(count: number): Record<string, string> {

    const headers: Record<string, string> = {};

    for (let i = 0; i < count; i++) {

        headers[`X-Custom-Header-${i}`] = `value-${i}-${Date.now()}`;
    }

    return headers;
}

/**
 * Creates multiple params for testing param management.
 */
export function createParams(count: number): Record<string, string> {

    const params: Record<string, string> = {};

    for (let i = 0; i < count; i++) {

        params[`param_${i}`] = `value-${i}-${Date.now()}`;
    }

    return params;
}

/**
 * Waits for a specified number of milliseconds.
 */
export function delay(ms: number): Promise<void> {

    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generates a unique URL path for testing.
 */
export function generateUniquePath(prefix: string, index: number): string {

    return `/${prefix}/${index}/${Date.now()}`;
}
