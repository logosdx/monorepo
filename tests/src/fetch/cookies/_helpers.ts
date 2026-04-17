import { beforeAll, afterAll, beforeEach } from 'vitest';
import Hapi from '@hapi/hapi';
import Sinon from 'sinon';
import { Deferred } from '@logosdx/utils';
import net from 'net';

const getNextPort = (basePort = 4800) => {

    let nextPort = basePort;
    const deferred = new Deferred<number>();

    const checkPort = (port: number) => {

        const srv = net.createServer();

        srv.once('error', () => {

            nextPort++;
            checkPort(nextPort);
        });

        srv.once('listening', () => {

            srv.close();
            deferred.resolve(port);
        });

        srv.listen(port, '127.0.0.1');
    };

    checkPort(nextPort);

    return deferred.promise;
};


/**
 * Spins up a Hapi server with cookie-specific routes for integration testing.
 *
 * Cookies are declared via `server.state()` and set via `h.state()` /
 * `h.unstate()` — the canonical Hapi cookie API. This matches how a real
 * production service emits Set-Cookie headers (correct attribute formatting,
 * RFC 6265 validation via `strictHeader: true`, separate headers per cookie).
 *
 * Routes:
 *   GET /set-cookie       h.state('session', 'abc123')         — HttpOnly, Path=/
 *   GET /set-max-age      h.state('session-long', 'abc123')    — ttl=3600s → Max-Age=3600
 *   GET /delete-cookie    h.unstate('session')                  — clears via Max-Age=0
 *   GET /set-multiple     h.state('token').state('user')        — TWO Set-Cookie headers
 *   GET /set-scoped       h.state('scoped', 'yes')              — Path=/api (scoped)
 *   GET /echo-cookies     returns { cookie: req.headers.cookie } (no state set)
 *   GET /api/resource     echoes cookie at Path=/api            (no state set)
 */
export const makeCookieTestServer = async (port?: number) => {

    const nextPort = await getNextPort(port);
    const testUrl = `http://localhost:${nextPort}`;
    const cookieHeaderStub = Sinon.stub<[string]>();

    const server = Hapi.server({
        port: nextPort,
        host: 'localhost',
        debug: false,
        state: {
            // Tests run over HTTP, so suppress the `Secure` attribute by
            // default. Hapi's default is isSecure:true which would set the
            // Secure flag and our client jar would then refuse to send the
            // cookie over http:// (secureOnlyFlag check).
            isSecure: false,
            isHttpOnly: true,
            isSameSite: 'Strict',
            strictHeader: true,
        },
    });

    // Declare each cookie Hapi will emit. server.state() registers per-cookie
    // defaults which h.state(name, value) picks up. Any option here can still
    // be overridden per-call via `h.state(name, value, overrides)`.
    server.state('session', {
        isSecure: false,
        isHttpOnly: true,
        isSameSite: 'Strict',
        path: '/',
    });

    server.state('session-long', {
        isSecure: false,
        isHttpOnly: true,
        isSameSite: 'Strict',
        path: '/',
        ttl: 3600 * 1000, // 1 hour in ms → emits Max-Age=3600
    });

    server.state('token', {
        isSecure: false,
        isHttpOnly: false,
        isSameSite: 'Strict',
        path: '/',
    });

    server.state('user', {
        isSecure: false,
        isHttpOnly: false,
        isSameSite: 'Strict',
        path: '/',
    });

    server.state('scoped', {
        isSecure: false,
        isHttpOnly: false,
        isSameSite: 'Strict',
        path: '/api',
    });

    server.route([

        {
            method: 'GET',
            path: '/set-cookie',
            handler: (_req, h) => {

                // h.state() — the canonical Hapi cookie API.
                // Emits Set-Cookie: session=abc123; HttpOnly; SameSite=Strict; Path=/
                return h.response({ ok: true }).state('session', 'abc123');
            },
        },

        {
            method: 'GET',
            path: '/set-max-age',
            handler: (_req, h) => {

                // ttl is pre-configured via server.state('session-long', ...)
                // Emits Set-Cookie: session-long=abc123; Max-Age=3600; HttpOnly; ...
                return h.response({ ok: true }).state('session-long', 'abc123');
            },
        },

        {
            method: 'GET',
            path: '/delete-cookie',
            handler: (_req, h) => {

                // h.unstate() — the canonical "clear this cookie" API.
                // Emits Set-Cookie: session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/
                return h.response({ ok: true }).unstate('session');
            },
        },

        {
            method: 'GET',
            path: '/set-multiple',
            handler: (_req, h) => {

                // Two h.state() calls produce two distinct Set-Cookie headers.
                // This exercises the executor.ts multi-value preservation from Task 8.
                return h.response({ ok: true })
                    .state('token', 'xyz')
                    .state('user', 'danilo');
            },
        },

        {
            method: 'GET',
            path: '/set-scoped',
            handler: (_req, h) => {

                // server.state('scoped', { path: '/api' }) scopes the cookie.
                // Emits Set-Cookie: scoped=yes; SameSite=Strict; Path=/api
                return h.response({ ok: true }).state('scoped', 'yes');
            },
        },

        {
            method: 'GET',
            path: '/echo-cookies',
            handler: (req) => {

                const cookieHeader = req.headers['cookie'] ?? '';
                cookieHeaderStub(cookieHeader);

                return { cookie: cookieHeader };
            },
        },

        {
            method: 'GET',
            path: '/api/resource',
            handler: (req) => {

                const cookieHeader = req.headers['cookie'] ?? '';
                cookieHeaderStub(cookieHeader);

                return { ok: true, cookie: cookieHeader };
            },
        },
    ]);

    beforeAll(async () => {

        await server.start();
    });

    afterAll(async () => {

        await server.stop();
    });

    beforeEach(() => {

        cookieHeaderStub.reset();
    });

    return { server, testUrl, cookieHeaderStub };
};
