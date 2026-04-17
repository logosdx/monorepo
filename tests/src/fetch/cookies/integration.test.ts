import { describe, it, expect, vi } from 'vitest';
import { FetchEngine } from '../../../../packages/fetch/src/index.ts';
import { cookiePlugin } from '../../../../packages/fetch/src/plugins/cookies/index.ts';
import type { Cookie, CookieAdapter } from '../../../../packages/fetch/src/plugins/cookies/types.ts';
import { attempt } from '../../../../packages/utils/src/index.ts';
import { makeCookieTestServer } from './_helpers.ts';

describe('cookies: FetchEngine integration', async () => {

    const { testUrl, cookieHeaderStub } = await makeCookieTestServer(4800);

    it('captures Set-Cookie from response and sends Cookie on next request', async () => {

        const cookies = cookiePlugin();
        const api = new FetchEngine({ baseUrl: testUrl, plugins: [cookies] });

        // First request: server sets a cookie, we don't have one yet
        await api.get('/set-cookie');

        expect(cookieHeaderStub.callCount).toBe(0); // /set-cookie doesn't call the stub

        // Second request to echo endpoint: cookie should now be attached
        const [res] = await attempt(() => api.get<{ cookie: string }>('/echo-cookies'));

        expect(res!.data.cookie).toContain('session=abc123');

        api.destroy();
    });

    it('cookie persists across multiple requests', async () => {

        const cookies = cookiePlugin();
        const api = new FetchEngine({ baseUrl: testUrl, plugins: [cookies] });

        await api.get('/set-cookie');

        const [r1] = await attempt(() => api.get<{ cookie: string }>('/echo-cookies'));
        const [r2] = await attempt(() => api.get<{ cookie: string }>('/echo-cookies'));

        expect(r1!.data.cookie).toContain('session=abc123');
        expect(r2!.data.cookie).toContain('session=abc123');

        api.destroy();
    });

    it('removes cookie after server responds with Max-Age=0', async () => {

        const cookies = cookiePlugin();
        const api = new FetchEngine({ baseUrl: testUrl, plugins: [cookies] });

        await api.get('/set-cookie');     // sets session=abc123
        await api.get('/delete-cookie'); // server sends Max-Age=0

        const [res] = await attempt(() => api.get<{ cookie: string }>('/echo-cookies'));

        expect(res!.data.cookie).toBe('');

        api.destroy();
    });

    it('captures multiple Set-Cookie headers from a single response', async () => {

        const cookies = cookiePlugin();
        const api = new FetchEngine({ baseUrl: testUrl, plugins: [cookies] });

        await api.get('/set-multiple');

        const [res] = await attempt(() => api.get<{ cookie: string }>('/echo-cookies'));

        expect(res!.data.cookie).toContain('token=xyz');
        expect(res!.data.cookie).toContain('user=danilo');

        api.destroy();
    });

    it('does not send a path-scoped cookie to a non-matching path', async () => {

        const cookies = cookiePlugin();
        const api = new FetchEngine({ baseUrl: testUrl, plugins: [cookies] });

        // /set-scoped sets a cookie with Path=/api
        await api.get('/set-scoped');

        // /echo-cookies is at /, which does NOT match Path=/api
        const [res] = await attempt(() => api.get<{ cookie: string }>('/echo-cookies'));

        expect(res!.data.cookie).toBe('');

        api.destroy();
    });

    it('sends a path-scoped cookie only to matching paths', async () => {

        const cookies = cookiePlugin();
        const api = new FetchEngine({ baseUrl: testUrl, plugins: [cookies] });

        await api.get('/set-scoped');

        // /api/resource matches Path=/api
        const [res] = await attempt(() => api.get<{ cookie: string }>('/api/resource'));

        expect(res!.data.cookie).toContain('scoped=yes');

        api.destroy();
    });

    it('calls adapter.save() when a Set-Cookie header is received', async () => {

        const saved: Cookie[][] = [];
        const adapter: CookieAdapter = {
            load: vi.fn().mockResolvedValue([]),
            save: vi.fn(async (cookies) => { saved.push([...cookies]); }),
        };

        const cookies = cookiePlugin({ adapter });
        await cookies.init();

        const api = new FetchEngine({ baseUrl: testUrl, plugins: [cookies] });

        await api.get('/set-cookie');

        // Give the async fire-and-forget save a chance to settle
        await new Promise(r => setTimeout(r, 20));

        expect(saved.length).toBeGreaterThan(0);
        expect(saved.at(-1)!.some(c => c.name === 'session' && c.value === 'abc123')).toBe(true);

        api.destroy();
    });

    it('pre-seeds the jar from adapter.load() at init', async () => {

        const now = Date.now();
        const preloaded: Cookie[] = [{
            name: 'preloaded',
            value: 'fromAdapter',
            domain: `localhost`,
            path: '/',
            expiryTime: now + 3_600_000,
            creationTime: now,
            lastAccessTime: now,
            persistentFlag: true,
            hostOnlyFlag: true,
            secureOnlyFlag: false,
            httpOnlyFlag: false,
        }];

        const cookies = cookiePlugin({
            adapter: {
                load: vi.fn().mockResolvedValue(preloaded),
                save: vi.fn().mockResolvedValue(undefined),
            },
        });

        await cookies.init();

        const api = new FetchEngine({ baseUrl: testUrl, plugins: [cookies] });

        const [res] = await attempt(() => api.get<{ cookie: string }>('/echo-cookies'));

        expect(res!.data.cookie).toContain('preloaded=fromAdapter');

        api.destroy();
    });

    it('coalesces adapter.save() for bursts — one save for a multi-cookie response', async () => {

        // Typed signature so `saveSpy.mock.calls[0][0]` infers as `Cookie[]`
        // without a cast — see CLAUDE.md "no `as` type assertions" rule.
        const saveSpy = vi.fn(async (_cookies: Cookie[]): Promise<void> => { /* no-op */ });
        const loadSpy = vi.fn(async (): Promise<Cookie[]> => []);

        const cookies = cookiePlugin({
            adapter: { load: loadSpy, save: saveSpy },
        });
        await cookies.init();

        saveSpy.mockClear();

        const api = new FetchEngine({ baseUrl: testUrl, plugins: [cookies] });

        // /set-multiple returns TWO Set-Cookie headers in a single response.
        // Under coalesced persistence we expect exactly ONE adapter.save call
        // covering both cookies, not two.
        await api.get('/set-multiple');

        // Give the microtask plus the fire-and-forget save a chance to settle
        await new Promise(r => setTimeout(r, 20));

        expect(saveSpy).toHaveBeenCalledTimes(1);

        const [persisted] = saveSpy.mock.calls[0]!;
        const names = persisted.map(c => c.name).sort();
        expect(names).toEqual(['token', 'user']);

        api.destroy();
    });

    it('flush() forces an immediate save on graceful shutdown', async () => {

        const saveSpy = vi.fn(async (_cookies: Cookie[]): Promise<void> => { /* no-op */ });
        const loadSpy = vi.fn(async (): Promise<Cookie[]> => []);

        const cookies = cookiePlugin({
            adapter: { load: loadSpy, save: saveSpy },
        });
        await cookies.init();

        const api = new FetchEngine({ baseUrl: testUrl, plugins: [cookies] });

        await api.get('/set-cookie');

        saveSpy.mockClear();

        // Do not wait for the coalesced microtask — go straight to flush
        await cookies.flush();

        expect(saveSpy).toHaveBeenCalled();
        const lastCall = saveSpy.mock.calls.at(-1);
        expect(lastCall).toBeDefined();
        const [persisted] = lastCall!;
        expect(persisted.some(c => c.name === 'session' && c.value === 'abc123')).toBe(true);

        api.destroy();
    });

    it('flush() surfaces adapter rejection to the caller', async () => {

        const cookies = cookiePlugin({
            adapter: {
                load: vi.fn().mockResolvedValue([]),
                save: vi.fn().mockRejectedValue(new Error('shutdown persist failed')),
            },
        });
        await cookies.init();

        const api = new FetchEngine({ baseUrl: testUrl, plugins: [cookies] });

        await api.get('/set-cookie');

        await expect(cookies.flush()).rejects.toThrow('shutdown persist failed');

        api.destroy();
    });

    describe('config shorthand', async () => {

        const { testUrl: shorthandUrl } = await makeCookieTestServer(4801);

        it('cookies: true enables the cookie jar via config shorthand', async () => {

            const api = new FetchEngine({ baseUrl: shorthandUrl, cookies: true });

            await api.get('/set-cookie');
            const [res] = await attempt(() => api.get<{ cookie: string }>('/echo-cookies'));

            expect(res!.data.cookie).toContain('session=abc123');

            api.destroy();
        });

        it('cookies: { ... } passes config through the shorthand', async () => {

            const api = new FetchEngine({
                baseUrl: shorthandUrl,
                cookies: { exclude: [/localhost/] },
            });

            await api.get('/set-cookie');
            const [res] = await attempt(() => api.get<{ cookie: string }>('/echo-cookies'));

            // Cookies are excluded for localhost, so nothing should be sent
            expect(res!.data.cookie).toBe('');

            api.destroy();
        });
    });
});
