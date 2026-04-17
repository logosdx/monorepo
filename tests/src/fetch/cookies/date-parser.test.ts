import { describe, it, expect } from 'vitest';
import { parseDate } from '../../../../packages/fetch/src/plugins/cookies/date-parser.ts';

describe('cookies: parseDate', () => {

    it('parses standard RFC 1123 date', () => {

        const result = parseDate('Thu, 01 Jan 2099 00:00:00 GMT');
        expect(result).toBe(Date.UTC(2099, 0, 1, 0, 0, 0));
    });

    it('parses date with extra whitespace and delimiters', () => {

        const result = parseDate('Thu,  01  Jan  2099  00:00:00  GMT');
        expect(result).toBe(Date.UTC(2099, 0, 1, 0, 0, 0));
    });

    it('parses two-digit year 70-99 as 19xx', () => {

        const result = parseDate('01 Jan 99 00:00:00 GMT');
        expect(result).toBe(Date.UTC(1999, 0, 1, 0, 0, 0));
    });

    it('parses two-digit year 00-69 as 20xx', () => {

        const result = parseDate('01 Jan 69 00:00:00 GMT');
        expect(result).toBe(Date.UTC(2069, 0, 1, 0, 0, 0));
    });

    it('returns null when time token is missing', () => {

        expect(parseDate('01 Jan 2099')).toBeNull();
    });

    it('returns null when year is missing', () => {

        expect(parseDate('Thu, 01 Jan 00:00:00 GMT')).toBeNull();
    });

    it('returns null when month is missing', () => {

        expect(parseDate('Thu, 01 2099 00:00:00 GMT')).toBeNull();
    });

    it('returns null when day-of-month is missing', () => {

        expect(parseDate('Thu, Jan 2099 00:00:00 GMT')).toBeNull();
    });

    it('returns null when year < 1601', () => {

        expect(parseDate('01 Jan 1600 00:00:00 GMT')).toBeNull();
    });

    it('returns null when hour > 23', () => {

        expect(parseDate('01 Jan 2099 24:00:00 GMT')).toBeNull();
    });

    it('returns null when minute > 59', () => {

        expect(parseDate('01 Jan 2099 00:60:00 GMT')).toBeNull();
    });

    it('returns null when second > 59', () => {

        expect(parseDate('01 Jan 2099 00:00:60 GMT')).toBeNull();
    });

    it('returns null when day-of-month is 0', () => {

        expect(parseDate('00 Jan 2099 00:00:00 GMT')).toBeNull();
    });

    it('returns null when day-of-month > 31', () => {

        expect(parseDate('32 Jan 2099 00:00:00 GMT')).toBeNull();
    });

    it('parses all 12 months', () => {

        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

        months.forEach((mon, i) => {

            const result = parseDate(`01 ${mon} 2099 00:00:00 GMT`);
            expect(result).toBe(Date.UTC(2099, i, 1, 0, 0, 0));
        });
    });

    it('parses months case-insensitively', () => {

        expect(parseDate('01 JAN 2099 00:00:00 GMT')).toBe(Date.UTC(2099, 0, 1, 0, 0, 0));
        expect(parseDate('01 jan 2099 00:00:00 GMT')).toBe(Date.UTC(2099, 0, 1, 0, 0, 0));
        expect(parseDate('01 jAn 2099 00:00:00 GMT')).toBe(Date.UTC(2099, 0, 1, 0, 0, 0));
    });
});
