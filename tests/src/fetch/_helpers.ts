import {
    beforeAll,
    beforeEach,
    afterAll
} from 'vitest'

import net from 'net';

import Hapi, { Lifecycle } from '@hapi/hapi';
import Boom from '@hapi/boom';
import Joi from 'joi';

import {
    FetchEngine,
} from '../../../packages/fetch/src/index.ts';

import { Deferred, wait } from '../../../packages/utils/src/index.ts';
import { sandbox } from '../_helpers.ts';


// Type aliases for event listener callback arguments
// Non-regex listeners receive: (data: EventData, { event: string }) => void
// Regex listeners receive: ({ event: string, data: EventData }) => void

/** Event data type alias for FetchEngine events */
export type EventData = FetchEngine.EventData;

/** Regex listener callback argument: { event, data } as first arg */
export interface RegexCallbackArg {
    event: string;
    data: EventData;
}

// Augment the FetchEngine module with custom response headers for testing
declare module '../../../packages/fetch/src/engine.ts' {

    namespace FetchEngine {

        interface InstanceResponseHeaders {
            'x-custom-response-header': string;
            'x-rate-limit-remaining': string;
            'x-request-id': string;
        }
    }
}

export const mkHapiRoute = (
    path: string,
    handler: Lifecycle.Method,
    options: Hapi.RouteOptions = {}
) => ({
    method: '*' as const,
    path,
    handler,
    options
});

const getNextPort = (basePort = Number(process.env.TEST_PORT || '0') || 3456) => {

    let nextPort = basePort;
    const deferred = new Deferred<number>();

    const checkPort = (port: number) => {

        const server = net.createServer();

        server.once('error', () => {

            nextPort++;
            checkPort(nextPort);
        });

        server.once('listening', () => {

            server.close();
            deferred.resolve(port);
        });

        server.listen(port, '127.0.0.1');
    }

    checkPort(nextPort);

    return deferred.promise;
}

export const makeTestStubs = async (port?: number) => {

    const nextPort = await getNextPort(port);

    const callStub = sandbox.stub<[Hapi.Request]>();
    const testUrl = `http://localhost:${nextPort}`;
    const server = Hapi.server({
        port: nextPort,
        host: 'localhost',
        routes: {
            payload: {
                maxBytes: 10 * 1024 * 1024 // 10MB limit for large payload tests
            }
        },
        debug: false
    });

    // Flaky endpoint state - succeeds first call, fails subsequent calls
    let flakyCallCount = 0;
    const resetFlaky = () => { flakyCallCount = 0; };

    // Fail-once endpoint state - fails first call, succeeds subsequent calls
    let failOnceCallCount = 0;
    const resetFailOnce = () => { failOnceCallCount = 0; };

    server.route(
        [
            mkHapiRoute('/bad-content-type', (_, h) => h.response().header('content-type', 'habibti/allah')),
            mkHapiRoute('/', (req) => { callStub(req); return { root: true }; }),
            mkHapiRoute('/json{n?}', (req) => { callStub(req); return { ok: true }; }),
            mkHapiRoute('/fail', () => { return Boom.badRequest('message', { the: 'data' }); }),
            mkHapiRoute('/wait', () => wait(1000, 'ok')),
            mkHapiRoute('/drop', (_, h) => h.close),
            mkHapiRoute('/abandon', (_, h) => h.abandon),
            mkHapiRoute('/empty', () => { return null; }),
            mkHapiRoute('/empty2', (_, h) => { return h.response().code(204); }),

            // Flaky endpoint: succeeds on first call, fails on subsequent calls
            // Useful for testing SWR revalidation error handling
            mkHapiRoute('/flaky', () => {

                flakyCallCount++;

                if (flakyCallCount > 1) {

                    return Boom.serverUnavailable('Flaky endpoint failed');
                }

                return { ok: true, callCount: flakyCallCount };
            }),

            // Fail-once endpoint: fails on first call, succeeds on subsequent calls
            // Useful for testing retry + deduplication scenarios
            mkHapiRoute('/fail-once', () => {

                failOnceCallCount++;

                if (failOnceCallCount === 1) {

                    return Boom.serverUnavailable('First call fails');
                }

                return { ok: true, callCount: failOnceCallCount };
            }),

            // Slow-fail endpoint: waits then fails
            // Useful for testing timeout and abort scenarios
            mkHapiRoute('/slow-fail', async () => {

                await wait(200);
                return Boom.serverUnavailable('Slow failure');
            }),

            mkHapiRoute('/slow-success/{delay?}', async (req) => {

                await wait(Number(req.params.delay) || 200);

                callStub(req);

                return { ok: true };
            }),

            mkHapiRoute('/validate', () => 'ok', {
                validate: {
                    query: Joi.object({
                        name: Joi.string().required(),
                        age: Joi.number().min(18).max(65)
                    }),
                    failAction: async (req, h, err) => {

                        if (err) {

                            return err;
                        }

                        if ((req as unknown as Boom.Boom).isBoom) {

                            return req;
                        }

                        return h.continue;
                    }
                },
            }),

            mkHapiRoute('/rate-limit', (req) => {

                const { query } = req;

                if (!query.apiKey) {
                    return Boom.tooManyRequests('Rate limit exceeded', { retryAfter: 1 });
                }

                return { ok: true };
            }),

            mkHapiRoute('/custom-headers', (_, h) => {

                return h.response({ ok: true })
                    .header('x-custom-response-header', 'test-value')
                    .header('x-rate-limit-remaining', '100')
                    .header('x-request-id', 'req-12345');
            }),

            // Large payload echo endpoint
            mkHapiRoute('/large-payload', async (req) => {

                const payload = req.payload as Record<string, unknown>;
                return {
                    receivedBytes: JSON.stringify(payload).length,
                    data: payload
                };
            }),

            // Catch-all route for testing rule matching and arbitrary paths
            // Must be last so specific routes are matched first
            mkHapiRoute('/{path*}', (req) => {

                callStub(req);
                return { ok: true, path: req.path };
            })
        ]
    );

    beforeAll(async () => {

        await server.start();
    });

    afterAll(async () => {

        await server.stop();
    });

    beforeEach(() => {

        callStub.reset();
        resetFlaky();
        resetFailOnce();
    });

    return { callStub, server, testUrl, resetFlaky, resetFailOnce };
}