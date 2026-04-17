import { describe, it, expect, beforeEach } from 'vitest';
import { CookieJar } from '../../../../packages/fetch/src/plugins/cookies/jar.ts';
import type { Cookie } from '../../../../packages/fetch/src/plugins/cookies/types.ts';

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

describe('cookies: CookieJar', () => {

    let jar: CookieJar;

    beforeEach(() => {

        jar = new CookieJar();
    });

    it('stores and retrieves a cookie', () => {

        jar.set(makeCookie({ name: 'token', value: 'xyz' }));

        const all = jar.all();

        expect(all).toHaveLength(1);
        expect(all[0]!.name).toBe('token');
        expect(all[0]!.value).toBe('xyz');
    });

    it('replaces existing cookie with same name+domain+path, preserving creationTime', () => {

        const originalTime = Date.now() - 10000;
        jar.set(makeCookie({ name: 'token', value: 'old', creationTime: originalTime }));
        jar.set(makeCookie({ name: 'token', value: 'new' }));

        const all = jar.all();

        expect(all).toHaveLength(1);
        expect(all[0]!.value).toBe('new');
        expect(all[0]!.creationTime).toBe(originalTime);
    });

    it('removes cookie when set with expiryTime in the past', () => {

        jar.set(makeCookie({ name: 'token', value: 'old' }));
        jar.set(makeCookie({ name: 'token', value: 'expired', expiryTime: Date.now() - 1, persistentFlag: true }));

        expect(jar.all()).toHaveLength(0);
    });

    it('evicts expired cookies on any set() call', () => {

        jar.set(makeCookie({ name: 'expired', expiryTime: Date.now() - 1, persistentFlag: true }));
        jar.set(makeCookie({ name: 'fresh' }));

        const names = jar.all().map(c => c.name);

        expect(names).not.toContain('expired');
        expect(names).toContain('fresh');
    });

    it('clears session cookies on clearSession()', () => {

        jar.set(makeCookie({ name: 'session-cookie', persistentFlag: false, expiryTime: Infinity }));
        jar.set(makeCookie({ name: 'persistent', persistentFlag: true, expiryTime: Date.now() + 100_000 }));

        jar.clearSession();

        const names = jar.all().map(c => c.name);

        expect(names).not.toContain('session-cookie');
        expect(names).toContain('persistent');
    });

    it('delete() removes a specific cookie', () => {

        jar.set(makeCookie({ name: 'a', domain: 'example.com', path: '/' }));
        jar.set(makeCookie({ name: 'b', domain: 'example.com', path: '/' }));
        jar.delete('example.com', '/', 'a');

        const names = jar.all().map(c => c.name);

        expect(names).not.toContain('a');
        expect(names).toContain('b');
    });

    it('clear() removes all cookies when no domain given', () => {

        jar.set(makeCookie({ name: 'a', domain: 'example.com' }));
        jar.set(makeCookie({ name: 'b', domain: 'other.com' }));
        jar.clear();

        expect(jar.all()).toHaveLength(0);
    });

    it('clear(domain) removes only cookies for that domain', () => {

        jar.set(makeCookie({ name: 'a', domain: 'example.com' }));
        jar.set(makeCookie({ name: 'b', domain: 'other.com' }));
        jar.clear('example.com');

        const all = jar.all();

        expect(all).toHaveLength(1);
        expect(all[0]!.domain).toBe('other.com');
    });

    it('enforces maxCookiesPerDomain limit, evicting oldest by lastAccessTime', () => {

        const jar2 = new CookieJar({ maxCookiesPerDomain: 3 });
        const now = Date.now();

        for (let i = 0; i < 4; i++) {

            jar2.set(makeCookie({
                name: `cookie${i}`,
                domain: 'example.com',
                lastAccessTime: now + i,
            }));
        }

        const names = jar2.all().map(c => c.name);

        expect(names).toHaveLength(3);
        // cookie0 has the oldest lastAccessTime, should be evicted
        expect(names).not.toContain('cookie0');
    });

    it('enforces maxCookies total limit, evicting oldest by lastAccessTime', () => {

        const jar2 = new CookieJar({ maxCookies: 3 });
        const now = Date.now();

        for (let i = 0; i < 4; i++) {

            jar2.set(makeCookie({
                name: `cookie${i}`,
                domain: `domain${i}.com`,
                lastAccessTime: now + i,
            }));
        }

        expect(jar2.all()).toHaveLength(3);
        expect(jar2.all().map(c => c.name)).not.toContain('cookie0');
    });

    it('load() seeds jar from provided cookies array', () => {

        jar.load([
            makeCookie({ name: 'a' }),
            makeCookie({ name: 'b' }),
        ]);

        expect(jar.all()).toHaveLength(2);
    });

    describe('get(url) — §5.4 retrieval', () => {

        it('returns cookies matching the given URL', () => {

            jar.set(makeCookie({ name: 'a', domain: 'example.com', path: '/' }));
            jar.set(makeCookie({ name: 'b', domain: 'other.com', path: '/' }));

            const matches = jar.get(new URL('https://example.com/home'));
            const names = matches.map(c => c.name);

            expect(names).toContain('a');
            expect(names).not.toContain('b');
        });

        it('updates lastAccessTime on retrieved cookies (RFC 6265 §5.4 step 3)', async () => {

            const old = Date.now() - 10_000;

            jar.set(makeCookie({
                name: 'a',
                domain: 'example.com',
                path: '/',
                lastAccessTime: old,
            }));

            const before = jar.all()[0]!.lastAccessTime;
            jar.get(new URL('https://example.com/home'));
            const after = jar.all()[0]!.lastAccessTime;

            expect(after).toBeGreaterThan(before);
        });

        it('omits httpOnly cookies when httpApi=false (document.cookie API context)', () => {

            const jar2 = new CookieJar({ httpApi: false });

            jar2.set(makeCookie({
                name: 'httponly',
                domain: 'example.com',
                path: '/',
                httpOnlyFlag: true,
            }));
            jar2.set(makeCookie({
                name: 'regular',
                domain: 'example.com',
                path: '/',
                httpOnlyFlag: false,
            }));

            const names = jar2.get(new URL('https://example.com/')).map(c => c.name);

            expect(names).not.toContain('httponly');
            expect(names).toContain('regular');
        });

        it('includes httpOnly cookies by default (HTTP request context)', () => {

            jar.set(makeCookie({
                name: 'httponly',
                domain: 'example.com',
                path: '/',
                httpOnlyFlag: true,
            }));

            const names = jar.get(new URL('https://example.com/')).map(c => c.name);

            expect(names).toContain('httponly');
        });
    });

    describe('onChange callback', () => {

        it('fires once per set() call', () => {

            let count = 0;
            const jar2 = new CookieJar({ onChange: () => count++ });

            jar2.set(makeCookie({ name: 'a' }));
            jar2.set(makeCookie({ name: 'b' }));

            expect(count).toBe(2);
        });

        it('fires on delete()', () => {

            let count = 0;
            const jar2 = new CookieJar({ onChange: () => count++ });

            jar2.set(makeCookie({ name: 'a', domain: 'example.com', path: '/' }));
            count = 0;
            jar2.delete('example.com', '/', 'a');

            expect(count).toBe(1);
        });

        it('fires on clear()', () => {

            let count = 0;
            const jar2 = new CookieJar({ onChange: () => count++ });

            jar2.set(makeCookie({ name: 'a' }));
            count = 0;
            jar2.clear();

            expect(count).toBe(1);
        });

        it('fires on clearSession()', () => {

            let count = 0;
            const jar2 = new CookieJar({ onChange: () => count++ });

            jar2.set(makeCookie({ name: 'a', persistentFlag: false }));
            count = 0;
            jar2.clearSession();

            expect(count).toBe(1);
        });

        it('fires on get() when at least one cookie is retrieved (lastAccessTime bump)', () => {

            let count = 0;
            const jar2 = new CookieJar({ onChange: () => count++ });

            jar2.set(makeCookie({ name: 'a', domain: 'example.com', path: '/' }));
            count = 0;
            jar2.get(new URL('https://example.com/'));

            expect(count).toBe(1);
        });

        it('does NOT fire on get() when no cookies match', () => {

            let count = 0;
            const jar2 = new CookieJar({ onChange: () => count++ });

            jar2.set(makeCookie({ name: 'a', domain: 'example.com', path: '/' }));
            count = 0;
            jar2.get(new URL('https://nowhere.com/'));

            expect(count).toBe(0);
        });

        it('fires once on load() regardless of cookie count', () => {

            let count = 0;
            const jar2 = new CookieJar({ onChange: () => count++ });

            jar2.load([
                makeCookie({ name: 'a' }),
                makeCookie({ name: 'b' }),
                makeCookie({ name: 'c' }),
            ]);

            expect(count).toBe(1);
        });
    });
});
