import { describe, it, expect } from 'vitest';
import {
    getMatchingCookies,
    serializeCookies,
} from '../../../../packages/fetch/src/plugins/cookies/serializer.ts';
import type { Cookie } from '../../../../packages/fetch/src/plugins/cookies/types.ts';

function makeCookie(overrides: Partial<Cookie> = {}): Cookie {

    const now = Date.now();

    return {
        name: 'session',
        value: 'abc',
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

const HTTP_URL  = new URL('http://example.com/api/v1');
const HTTPS_URL = new URL('https://example.com/api/v1');

describe('cookies: getMatchingCookies', () => {

    it('returns cookies matching host-only domain', () => {

        const cookie = makeCookie({ hostOnlyFlag: true, domain: 'example.com' });
        const result = getMatchingCookies([cookie], HTTP_URL);

        expect(result).toHaveLength(1);
    });

    it('does not return host-only cookie for subdomain', () => {

        const cookie = makeCookie({ hostOnlyFlag: true, domain: 'example.com' });
        const result = getMatchingCookies([cookie], new URL('http://api.example.com/'));

        expect(result).toHaveLength(0);
    });

    it('returns domain cookie for subdomain when hostOnlyFlag is false', () => {

        const cookie = makeCookie({ hostOnlyFlag: false, domain: 'example.com' });
        const result = getMatchingCookies([cookie], new URL('http://api.example.com/'));

        expect(result).toHaveLength(1);
    });

    it('excludes expired cookies', () => {

        const cookie = makeCookie({ expiryTime: Date.now() - 1, persistentFlag: true });
        const result = getMatchingCookies([cookie], HTTP_URL);

        expect(result).toHaveLength(0);
    });

    it('excludes secure cookie from non-HTTPS request', () => {

        const cookie = makeCookie({ secureOnlyFlag: true });
        const result = getMatchingCookies([cookie], HTTP_URL);

        expect(result).toHaveLength(0);
    });

    it('includes secure cookie in HTTPS request', () => {

        const cookie = makeCookie({ secureOnlyFlag: true });
        const result = getMatchingCookies([cookie], HTTPS_URL);

        expect(result).toHaveLength(1);
    });

    it('excludes httpOnly cookie from non-HTTP API', () => {

        const cookie = makeCookie({ httpOnlyFlag: true });
        const result = getMatchingCookies([cookie], HTTP_URL, false);

        expect(result).toHaveLength(0);
    });

    it('includes httpOnly cookie from HTTP API', () => {

        const cookie = makeCookie({ httpOnlyFlag: true });
        const result = getMatchingCookies([cookie], HTTP_URL, true);

        expect(result).toHaveLength(1);
    });

    it('excludes cookie when path does not match', () => {

        const cookie = makeCookie({ path: '/admin' });
        const result = getMatchingCookies([cookie], new URL('http://example.com/api'));

        expect(result).toHaveLength(0);
    });

    it('includes cookie when path matches prefix with slash boundary', () => {

        const cookie = makeCookie({ path: '/api' });
        const result = getMatchingCookies([cookie], new URL('http://example.com/api/v1'));

        expect(result).toHaveLength(1);
    });
});

describe('cookies: serializeCookies', () => {

    it('serializes a single cookie as name=value', () => {

        const result = serializeCookies([makeCookie({ name: 'a', value: '1' })]);

        expect(result).toBe('a=1');
    });

    it('joins multiple cookies with "; "', () => {

        const result = serializeCookies([
            makeCookie({ name: 'a', value: '1' }),
            makeCookie({ name: 'b', value: '2' }),
        ]);

        expect(result).toBe('a=1; b=2');
    });

    it('sorts longer paths before shorter paths', () => {

        const result = serializeCookies([
            makeCookie({ name: 'short', value: '1', path: '/' }),
            makeCookie({ name: 'long',  value: '2', path: '/api/v1' }),
        ]);

        // longer path (/api/v1) should come first
        expect(result).toBe('long=2; short=1');
    });

    it('sorts earlier creationTime before later for equal path lengths', () => {

        const now = Date.now();
        const result = serializeCookies([
            makeCookie({ name: 'newer', value: '2', path: '/', creationTime: now + 1000 }),
            makeCookie({ name: 'older', value: '1', path: '/', creationTime: now }),
        ]);

        // older creation time comes first
        expect(result).toBe('older=1; newer=2');
    });

    it('returns empty string for empty array', () => {

        expect(serializeCookies([])).toBe('');
    });
});
