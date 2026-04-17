import { describe, it, expect } from 'vitest';
import {
    canonicalizeDomain,
    matchesDomain,
} from '../../../../packages/fetch/src/plugins/cookies/domain.ts';

describe('cookies: canonicalizeDomain', () => {

    it('lowercases the domain', () => {

        expect(canonicalizeDomain('EXAMPLE.COM')).toBe('example.com');
    });

    it('strips a single leading dot', () => {

        expect(canonicalizeDomain('.example.com')).toBe('example.com');
    });

    it('does not strip non-leading dots', () => {

        expect(canonicalizeDomain('api.example.com')).toBe('api.example.com');
    });

    it('handles already canonical input', () => {

        expect(canonicalizeDomain('example.com')).toBe('example.com');
    });
});

describe('cookies: matchesDomain', () => {

    it('matches identical domains', () => {

        expect(matchesDomain('example.com', 'example.com')).toBe(true);
    });

    it('matches subdomain when cookieDomain is parent', () => {

        expect(matchesDomain('example.com', 'api.example.com')).toBe(true);
    });

    it('matches deeply nested subdomain', () => {

        expect(matchesDomain('example.com', 'v1.api.example.com')).toBe(true);
    });

    it('does not match when cookieDomain is not a suffix', () => {

        expect(matchesDomain('other.com', 'example.com')).toBe(false);
    });

    it('does not match partial domain name (evil.com vs notevil.com)', () => {

        expect(matchesDomain('evil.com', 'notevil.com')).toBe(false);
    });

    it('does not match IPv4 addresses as subdomains', () => {

        // IP addresses cannot be subdomains — host-only matching only
        expect(matchesDomain('1.2.3', '1.1.2.3')).toBe(false);
    });

    it('is case-insensitive', () => {

        expect(matchesDomain('EXAMPLE.COM', 'api.EXAMPLE.COM')).toBe(true);
    });

    it('does not match when request host IS the cookie domain but cookieDomain is longer', () => {

        expect(matchesDomain('api.example.com', 'example.com')).toBe(false);
    });
});
