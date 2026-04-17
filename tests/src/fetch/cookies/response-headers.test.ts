import { describe, it, expect } from 'vitest';
import { getSetCookieHeaders } from '../../../../packages/fetch/src/plugins/cookies/response-headers.ts';

describe('cookies: getSetCookieHeaders (reader)', () => {

    it('returns [] for headers with no set-cookie field', () => {

        expect(getSetCookieHeaders({ 'content-type': 'application/json' })).toEqual([]);
    });

    it('returns [] for empty headers object', () => {

        expect(getSetCookieHeaders({})).toEqual([]);
    });

    it('returns the array when set-cookie is already a string[]', () => {

        const headers = { 'set-cookie': ['a=1; Path=/', 'b=2; Path=/'] };

        expect(getSetCookieHeaders(headers)).toEqual(['a=1; Path=/', 'b=2; Path=/']);
    });

    it('wraps single-string set-cookie in a one-element array', () => {

        const headers = { 'set-cookie': 'session=abc; Path=/' };

        expect(getSetCookieHeaders(headers)).toEqual(['session=abc; Path=/']);
    });

    it('handles Set-Cookie (capitalized) key as fallback', () => {

        const headers = { 'Set-Cookie': ['a=1', 'b=2'] };

        expect(getSetCookieHeaders(headers)).toEqual(['a=1', 'b=2']);
    });

    it('returns [] when set-cookie is null', () => {

        const headers = { 'set-cookie': null };

        expect(getSetCookieHeaders(headers)).toEqual([]);
    });

    it('returns [] when set-cookie is undefined', () => {

        const headers: Record<string, unknown> = { 'set-cookie': undefined };

        expect(getSetCookieHeaders(headers)).toEqual([]);
    });

    it('filters non-string entries from an array value', () => {

        const headers = { 'set-cookie': ['a=1', 123, null, 'b=2'] };

        expect(getSetCookieHeaders(headers)).toEqual(['a=1', 'b=2']);
    });

    it('returns [] for non-object inputs (null, undefined, string, number)', () => {

        expect(getSetCookieHeaders(null)).toEqual([]);
        expect(getSetCookieHeaders(undefined)).toEqual([]);
        expect(getSetCookieHeaders('set-cookie=abc')).toEqual([]);
        expect(getSetCookieHeaders(42)).toEqual([]);
    });
});
