import { describe, it, expect } from 'vitest';
import {
    defaultPath,
    matchesPath,
} from '../../../../packages/fetch/src/plugins/cookies/path.ts';

describe('cookies: defaultPath', () => {

    it('returns "/" for empty path', () => {

        expect(defaultPath('')).toBe('/');
    });

    it('returns "/" for path without leading slash', () => {

        expect(defaultPath('no-slash')).toBe('/');
    });

    it('returns "/" for path with single slash', () => {

        expect(defaultPath('/')).toBe('/');
    });

    it('returns directory portion for path with filename', () => {

        expect(defaultPath('/foo/bar/baz')).toBe('/foo/bar');
    });

    it('returns "/" for path with only one segment', () => {

        expect(defaultPath('/foo')).toBe('/');
    });

    it('returns full path when trailing slash present', () => {

        expect(defaultPath('/foo/bar/')).toBe('/foo/bar');
    });
});

describe('cookies: matchesPath', () => {

    it('matches identical paths', () => {

        expect(matchesPath('/foo', '/foo')).toBe(true);
    });

    it('matches when cookie-path is "/" and request-path is anything', () => {

        expect(matchesPath('/', '/foo/bar')).toBe(true);
        expect(matchesPath('/', '/')).toBe(true);
    });

    it('matches when cookie-path is a prefix ending with "/"', () => {

        expect(matchesPath('/foo/', '/foo/bar')).toBe(true);
        expect(matchesPath('/foo/', '/foo/bar/baz')).toBe(true);
    });

    it('matches when first non-matching character of request-path is "/"', () => {

        expect(matchesPath('/foo', '/foo/bar')).toBe(true);
        expect(matchesPath('/api', '/api/v1/users')).toBe(true);
    });

    it('does not match when cookie-path is not a prefix', () => {

        expect(matchesPath('/bar', '/foo')).toBe(false);
    });

    it('does not match partial path segment (evil prefix case)', () => {

        // /fo should NOT match /foo
        expect(matchesPath('/fo', '/foo')).toBe(false);
    });

    it('does not match when request-path is shorter than cookie-path', () => {

        expect(matchesPath('/foo/bar', '/foo')).toBe(false);
    });
});
