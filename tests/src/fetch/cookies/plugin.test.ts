import { describe, it, expect, vi } from 'vitest';
import { cookiePlugin } from '../../../../packages/fetch/src/plugins/cookies/plugin.ts';
import { CookieJar } from '../../../../packages/fetch/src/plugins/cookies/jar.ts';
import type { Cookie, CookieAdapter } from '../../../../packages/fetch/src/plugins/cookies/types.ts';

function makeCookie(overrides: Partial<Cookie> = {}): Cookie {

    const now = Date.now();

    return {
        name: 'session',
        value: 'abc123',
        domain: 'example.com',
        path: '/',
        expiryTime: Infinity,
        creationTime: now,
        lastAccessTime: now,
        persistentFlag: false,
        hostOnlyFlag: true,
        secureOnlyFlag: false,
        httpOnlyFlag: false,
        ...overrides,
    };
}

function flushMicrotasks(): Promise<void> {

    return new Promise(resolve => queueMicrotask(resolve));
}

describe('cookies: cookiePlugin', () => {

    it('creates a plugin with name "cookies"', () => {

        const plugin = cookiePlugin();

        expect(plugin.name).toBe('cookies');
    });

    it('exposes the jar as a CookieJar instance', () => {

        const plugin = cookiePlugin();

        expect(plugin.jar).toBeInstanceOf(CookieJar);
        expect(typeof plugin.jar.set).toBe('function');
        expect(typeof plugin.jar.get).toBe('function');
    });

    it('jar can be pre-seeded via config.cookies', () => {

        const plugin = cookiePlugin({
            cookies: [makeCookie({ name: 'pre-seeded' })],
        });

        expect(plugin.jar.all().map(c => c.name)).toContain('pre-seeded');
    });

    it('loads cookies from adapter on init()', async () => {

        const adapter: CookieAdapter = {
            load: vi.fn().mockResolvedValue([makeCookie({ name: 'from-adapter' })]),
            save: vi.fn().mockResolvedValue(undefined),
        };

        const plugin = cookiePlugin({ adapter });
        await plugin.init();

        expect(plugin.jar.all().map(c => c.name)).toContain('from-adapter');
    });

    it('init() is a no-op when no adapter is configured', async () => {

        const plugin = cookiePlugin();

        await expect(plugin.init()).resolves.toBeUndefined();
    });

    it('init() swallows adapter.load() errors and leaves the jar untouched', async () => {

        const adapter: CookieAdapter = {
            load: vi.fn().mockRejectedValue(new Error('redis is down')),
            save: vi.fn().mockResolvedValue(undefined),
        };

        const plugin = cookiePlugin({ adapter });
        await expect(plugin.init()).resolves.toBeUndefined();
        expect(plugin.jar.all()).toHaveLength(0);
    });

    describe('microtask-coalesced persistence', () => {

        it('calls adapter.save() exactly once after a burst of jar.set() calls', async () => {

            // Typed spy so `saveSpy.mock.calls[0][0]` infers as `Cookie[]`
            // without a cast (see CLAUDE.md "no `as`" rule).
            const saveSpy = vi.fn(async (_cookies: Cookie[]): Promise<void> => { /* no-op */ });
            const loadSpy = vi.fn(async (): Promise<Cookie[]> => []);

            const adapter: CookieAdapter = { load: loadSpy, save: saveSpy };

            const plugin = cookiePlugin({ adapter });

            plugin.jar.set(makeCookie({ name: 'a' }));
            plugin.jar.set(makeCookie({ name: 'b' }));
            plugin.jar.set(makeCookie({ name: 'c' }));

            // Save is queued on a microtask and has not yet run
            expect(saveSpy).toHaveBeenCalledTimes(0);

            await flushMicrotasks();

            expect(saveSpy).toHaveBeenCalledTimes(1);
            const [persisted] = saveSpy.mock.calls[0]!;
            const names = persisted.map(c => c.name).sort();
            expect(names).toEqual(['a', 'b', 'c']);
        });

        it('schedules a new save for a second burst after the first microtask settles', async () => {

            const saveSpy = vi.fn().mockResolvedValue(undefined);
            const adapter: CookieAdapter = {
                load: vi.fn().mockResolvedValue([]),
                save: saveSpy,
            };

            const plugin = cookiePlugin({ adapter });

            plugin.jar.set(makeCookie({ name: 'a' }));
            await flushMicrotasks();

            plugin.jar.set(makeCookie({ name: 'b' }));
            await flushMicrotasks();

            expect(saveSpy).toHaveBeenCalledTimes(2);
        });

        it('user calls to jar.delete() also persist through the same coalesce', async () => {

            const saveSpy = vi.fn().mockResolvedValue(undefined);
            const adapter: CookieAdapter = {
                load: vi.fn().mockResolvedValue([]),
                save: saveSpy,
            };

            const plugin = cookiePlugin({ adapter });

            plugin.jar.set(makeCookie({ name: 'a', domain: 'example.com', path: '/' }));
            await flushMicrotasks();

            saveSpy.mockClear();

            plugin.jar.delete('example.com', '/', 'a');
            await flushMicrotasks();

            expect(saveSpy).toHaveBeenCalledTimes(1);
            expect(saveSpy.mock.calls[0]![0]).toEqual([]);
        });

        it('swallows adapter.save() errors without throwing', async () => {

            const saveSpy = vi.fn().mockRejectedValue(new Error('redis is down'));
            const adapter: CookieAdapter = {
                load: vi.fn().mockResolvedValue([]),
                save: saveSpy,
            };

            const plugin = cookiePlugin({ adapter });

            plugin.jar.set(makeCookie({ name: 'a' }));

            // Should not throw even though save rejects
            await expect(flushMicrotasks()).resolves.toBeUndefined();
            expect(saveSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('flush()', () => {

        it('resolves without calling adapter.save when there is no adapter', async () => {

            const plugin = cookiePlugin();

            await expect(plugin.flush()).resolves.toBeUndefined();
        });

        it('forces an immediate save with the current jar contents', async () => {

            const saveSpy = vi.fn(async (_cookies: Cookie[]): Promise<void> => { /* no-op */ });
            const loadSpy = vi.fn(async (): Promise<Cookie[]> => []);

            const adapter: CookieAdapter = { load: loadSpy, save: saveSpy };

            const plugin = cookiePlugin({ adapter });

            plugin.jar.set(makeCookie({ name: 'a' }));
            // Do NOT await microtask drain — go straight to flush
            await plugin.flush();

            expect(saveSpy).toHaveBeenCalled();
            const lastCall = saveSpy.mock.calls.at(-1);
            expect(lastCall).toBeDefined();
            const [last] = lastCall!;
            expect(last.map(c => c.name)).toContain('a');
        });

        it('propagates a rejection from the final adapter.save()', async () => {

            const saveSpy = vi.fn().mockRejectedValue(new Error('persist failed'));
            const adapter: CookieAdapter = {
                load: vi.fn().mockResolvedValue([]),
                save: saveSpy,
            };

            const plugin = cookiePlugin({ adapter });
            plugin.jar.set(makeCookie({ name: 'a' }));

            await expect(plugin.flush()).rejects.toThrow('persist failed');
        });
    });
});
