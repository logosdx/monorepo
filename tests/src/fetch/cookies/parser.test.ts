import { describe, it, expect } from 'vitest';
import { parseSetCookieHeader } from '../../../../packages/fetch/src/plugins/cookies/parser.ts';

const URL_HTTP  = new URL('http://api.example.com/v1/users');
const URL_HTTPS = new URL('https://api.example.com/v1/users');

describe('cookies: parseSetCookieHeader', () => {

    it('parses a simple name=value cookie', () => {

        const cookie = parseSetCookieHeader('session=abc123', URL_HTTP);

        expect(cookie).not.toBeNull();
        expect(cookie!.name).toBe('session');
        expect(cookie!.value).toBe('abc123');
    });

    it('sets host-only-flag when Domain attribute is absent', () => {

        const cookie = parseSetCookieHeader('session=abc123', URL_HTTP);

        expect(cookie!.hostOnlyFlag).toBe(true);
        expect(cookie!.domain).toBe('api.example.com');
    });

    it('sets host-only-flag to false when Domain attribute is present', () => {

        const cookie = parseSetCookieHeader('session=abc123; Domain=example.com', URL_HTTP);

        expect(cookie!.hostOnlyFlag).toBe(false);
        expect(cookie!.domain).toBe('example.com');
    });

    it('strips leading dot from Domain attribute', () => {

        const cookie = parseSetCookieHeader('session=abc123; Domain=.example.com', URL_HTTP);

        expect(cookie!.domain).toBe('example.com');
    });

    it('returns null when Domain attribute does not domain-match request host', () => {

        const result = parseSetCookieHeader('session=abc123; Domain=other.com', URL_HTTP);

        expect(result).toBeNull();
    });

    it('sets default path from request URL when Path is absent', () => {

        const cookie = parseSetCookieHeader('session=abc123', URL_HTTP);

        // defaultPath('/v1/users') → '/v1'
        expect(cookie!.path).toBe('/v1');
    });

    it('uses explicit Path attribute when provided', () => {

        const cookie = parseSetCookieHeader('session=abc123; Path=/api', URL_HTTP);

        expect(cookie!.path).toBe('/api');
    });

    it('uses default path when Path attribute does not start with "/"', () => {

        const cookie = parseSetCookieHeader('session=abc123; Path=relative', URL_HTTP);

        expect(cookie!.path).toBe('/v1');
    });

    it('sets persistentFlag and expiryTime from Max-Age', () => {

        const before = Date.now();
        const cookie = parseSetCookieHeader('session=abc123; Max-Age=3600', URL_HTTP);
        const after = Date.now();

        expect(cookie!.persistentFlag).toBe(true);
        expect(cookie!.expiryTime).toBeGreaterThanOrEqual(before + 3600_000);
        expect(cookie!.expiryTime).toBeLessThanOrEqual(after + 3600_000);
    });

    it('sets expiryTime to 0 when Max-Age is 0 (immediate deletion)', () => {

        const cookie = parseSetCookieHeader('session=abc123; Max-Age=0', URL_HTTP);

        expect(cookie!.expiryTime).toBe(0);
        expect(cookie!.persistentFlag).toBe(true);
    });

    it('sets expiryTime to 0 when Max-Age is negative', () => {

        const cookie = parseSetCookieHeader('session=abc123; Max-Age=-1', URL_HTTP);

        expect(cookie!.expiryTime).toBe(0);
    });

    it('Max-Age takes precedence over Expires when both present', () => {

        const before = Date.now();
        const cookie = parseSetCookieHeader(
            'session=abc123; Max-Age=3600; Expires=Thu, 01 Jan 2099 00:00:00 GMT',
            URL_HTTP
        );
        const after = Date.now();

        // Should use Max-Age value, not the 2099 Expires
        expect(cookie!.expiryTime).toBeGreaterThanOrEqual(before + 3600_000);
        expect(cookie!.expiryTime).toBeLessThanOrEqual(after + 3600_000);
    });

    it('sets persistentFlag and expiryTime from Expires', () => {

        const cookie = parseSetCookieHeader(
            'session=abc123; Expires=Thu, 01 Jan 2099 00:00:00 GMT',
            URL_HTTP
        );

        expect(cookie!.persistentFlag).toBe(true);
        expect(cookie!.expiryTime).toBe(Date.UTC(2099, 0, 1, 0, 0, 0));
    });

    it('sets persistentFlag=false and expiryTime=Infinity when no expiry', () => {

        const cookie = parseSetCookieHeader('session=abc123', URL_HTTP);

        expect(cookie!.persistentFlag).toBe(false);
        expect(cookie!.expiryTime).toBe(Infinity);
    });

    it('sets secureOnlyFlag from Secure attribute', () => {

        const cookie = parseSetCookieHeader('session=abc123; Secure', URL_HTTPS);

        expect(cookie!.secureOnlyFlag).toBe(true);
    });

    it('secureOnlyFlag is false when Secure absent', () => {

        const cookie = parseSetCookieHeader('session=abc123', URL_HTTP);

        expect(cookie!.secureOnlyFlag).toBe(false);
    });

    it('sets httpOnlyFlag from HttpOnly attribute', () => {

        const cookie = parseSetCookieHeader('session=abc123; HttpOnly', URL_HTTP);

        expect(cookie!.httpOnlyFlag).toBe(true);
    });

    it('attributes are parsed case-insensitively', () => {

        const cookie = parseSetCookieHeader('session=abc123; secure; HTTPONLY; path=/; domain=example.com', URL_HTTP);

        expect(cookie!.secureOnlyFlag).toBe(true);
        expect(cookie!.httpOnlyFlag).toBe(true);
        expect(cookie!.path).toBe('/');
        expect(cookie!.domain).toBe('example.com');
    });

    it('silently ignores unknown attributes (extension-av per §5.2)', () => {

        // RFC 6265 §5.2 requires unknown attributes to be parsed but silently
        // ignored. This matters in practice — Hapi's default cookie options
        // emit `SameSite=Strict` (from RFC 6265bis, not RFC 6265), and the
        // parser must accept the cookie and drop the unknown attribute.
        const cookie = parseSetCookieHeader(
            'session=abc123; SameSite=Strict; Priority=High; Partitioned',
            URL_HTTP
        );

        expect(cookie).not.toBeNull();
        expect(cookie!.name).toBe('session');
        expect(cookie!.value).toBe('abc123');
        // Known attributes still work after an unknown one
        expect(cookie!.secureOnlyFlag).toBe(false);
        expect(cookie!.httpOnlyFlag).toBe(false);
    });

    it('accepts unknown attributes mixed with known ones', () => {

        const cookie = parseSetCookieHeader(
            'session=abc123; Path=/api; SameSite=Lax; Secure; HttpOnly',
            URL_HTTP
        );

        expect(cookie).not.toBeNull();
        expect(cookie!.path).toBe('/api');
        expect(cookie!.secureOnlyFlag).toBe(true);
        expect(cookie!.httpOnlyFlag).toBe(true);
    });

    it('returns null when header has no "=" in name-value pair', () => {

        expect(parseSetCookieHeader('invalidsession', URL_HTTP)).toBeNull();
    });

    it('returns null when name is empty', () => {

        expect(parseSetCookieHeader('=value', URL_HTTP)).toBeNull();
    });

    it('trims whitespace from name and value', () => {

        const cookie = parseSetCookieHeader('  session  =  abc123  ', URL_HTTP);

        expect(cookie!.name).toBe('session');
        expect(cookie!.value).toBe('abc123');
    });

    it('ignores unparseable Expires and treats cookie as session', () => {

        const cookie = parseSetCookieHeader('session=abc123; Expires=not-a-date', URL_HTTP);

        expect(cookie!.persistentFlag).toBe(false);
        expect(cookie!.expiryTime).toBe(Infinity);
    });
});
