import {
    describe,
    it,
    expect
} from 'vitest'


import {
    timeUnits,
    seconds,
    minutes,
    hours,
    days,
    weeks,
    months,
    years,
    byteUnits,
    kilobytes,
    megabytes,
    gigabytes,
    terabytes,
    parseByteSize,
    parseTimeDuration,
    formatByteSize,
    formatTimeDuration,
} from '../../../packages/utils/src/index.ts';

describe('@logosdx/utils', () => {

    describe('units: timeUnits constants', () => {

        it('should have correct second constant', () => {

            expect(timeUnits.sec).to.equal(1000);
        });

        it('should have correct minute constant', () => {

            expect(timeUnits.min).to.equal(60 * 1000);
        });

        it('should have correct hour constant', () => {

            expect(timeUnits.hour).to.equal(60 * 60 * 1000);
        });

        it('should have correct day constant', () => {

            expect(timeUnits.day).to.equal(24 * 60 * 60 * 1000);
        });

        it('should have correct week constant', () => {

            expect(timeUnits.week).to.equal(7 * 24 * 60 * 60 * 1000);
        });

        it('should have correct 15 minute constant', () => {

            expect(timeUnits.min15).to.equal(15 * 60 * 1000);
        });

        it('should have correct 30 minute constant', () => {

            expect(timeUnits.min30).to.equal(30 * 60 * 1000);
        });
    });

    describe('units: timeUnits helper functions', () => {

        it('should multiply seconds correctly', () => {

            expect(timeUnits.secs(30)).to.equal(30 * 1000);
            expect(timeUnits.secs(1)).to.equal(1000);
            expect(timeUnits.secs(0)).to.equal(0);
        });

        it('should multiply minutes correctly', () => {

            expect(timeUnits.mins(5)).to.equal(5 * 60 * 1000);
            expect(timeUnits.mins(1)).to.equal(60 * 1000);
        });

        it('should multiply hours correctly', () => {

            expect(timeUnits.hours(2)).to.equal(2 * 60 * 60 * 1000);
            expect(timeUnits.hours(24)).to.equal(24 * 60 * 60 * 1000);
        });

        it('should multiply days correctly', () => {

            expect(timeUnits.days(7)).to.equal(7 * 24 * 60 * 60 * 1000);
            expect(timeUnits.days(1)).to.equal(24 * 60 * 60 * 1000);
        });

        it('should multiply weeks correctly', () => {

            expect(timeUnits.weeks(2)).to.equal(2 * 7 * 24 * 60 * 60 * 1000);
        });

        it('should multiply months correctly (rounded)', () => {

            const result = timeUnits.months(1);
            expect(result).to.equal(Math.round(30.4 * 24 * 60 * 60 * 1000));
        });

        it('should multiply years correctly', () => {

            expect(timeUnits.years(1)).to.equal(365 * 24 * 60 * 60 * 1000);
            expect(timeUnits.years(2)).to.equal(2 * 365 * 24 * 60 * 60 * 1000);
        });
    });

    describe('units: exported time helper functions', () => {

        it('should export seconds helper', () => {

            expect(seconds(30)).to.equal(30 * 1000);
        });

        it('should export minutes helper', () => {

            expect(minutes(5)).to.equal(5 * 60 * 1000);
        });

        it('should export hours helper', () => {

            expect(hours(2)).to.equal(2 * 60 * 60 * 1000);
        });

        it('should export days helper', () => {

            expect(days(7)).to.equal(7 * 24 * 60 * 60 * 1000);
        });

        it('should export weeks helper', () => {

            expect(weeks(2)).to.equal(2 * 7 * 24 * 60 * 60 * 1000);
        });

        it('should export months helper', () => {

            expect(months(1)).to.equal(Math.round(30.4 * 24 * 60 * 60 * 1000));
        });

        it('should export years helper', () => {

            expect(years(1)).to.equal(365 * 24 * 60 * 60 * 1000);
        });
    });

    describe('units: byteUnits constants', () => {

        it('should have correct kilobyte constant', () => {

            expect(byteUnits.kb).to.equal(1024);
        });

        it('should have correct megabyte constant', () => {

            expect(byteUnits.mb).to.equal(1024 ** 2);
        });

        it('should have correct gigabyte constant', () => {

            expect(byteUnits.gb).to.equal(1024 ** 3);
        });

        it('should have correct terabyte constant', () => {

            expect(byteUnits.tb).to.equal(1024 ** 4);
        });
    });

    describe('units: byteUnits helper functions', () => {

        it('should multiply kilobytes correctly', () => {

            expect(byteUnits.kbs(10)).to.equal(10 * 1024);
            expect(byteUnits.kbs(1)).to.equal(1024);
            expect(byteUnits.kbs(0)).to.equal(0);
        });

        it('should multiply megabytes correctly', () => {

            expect(byteUnits.mbs(5)).to.equal(5 * 1024 ** 2);
            expect(byteUnits.mbs(1)).to.equal(1024 ** 2);
        });

        it('should multiply gigabytes correctly', () => {

            expect(byteUnits.gbs(2)).to.equal(2 * 1024 ** 3);
            expect(byteUnits.gbs(1)).to.equal(1024 ** 3);
        });

        it('should multiply terabytes correctly', () => {

            expect(byteUnits.tbs(3)).to.equal(3 * 1024 ** 4);
        });
    });

    describe('units: exported byte helper functions', () => {

        it('should export kilobytes helper', () => {

            expect(kilobytes(100)).to.equal(100 * 1024);
        });

        it('should export megabytes helper', () => {

            expect(megabytes(10)).to.equal(10 * 1024 ** 2);
        });

        it('should export gigabytes helper', () => {

            expect(gigabytes(5)).to.equal(5 * 1024 ** 3);
        });

        it('should export terabytes helper', () => {

            expect(terabytes(2)).to.equal(2 * 1024 ** 4);
        });
    });

    describe('units: parseByteSize', () => {

        it('should parse kilobytes', () => {

            expect(parseByteSize('10kb')).to.equal(10 * 1024);
            expect(parseByteSize('10KB')).to.equal(10 * 1024);
            expect(parseByteSize('10 kb')).to.equal(10 * 1024);
        });

        it('should parse megabytes', () => {

            expect(parseByteSize('5mb')).to.equal(5 * 1024 ** 2);
            expect(parseByteSize('5MB')).to.equal(5 * 1024 ** 2);
            expect(parseByteSize('5 mb')).to.equal(5 * 1024 ** 2);
        });

        it('should parse gigabytes', () => {

            expect(parseByteSize('2gb')).to.equal(2 * 1024 ** 3);
            expect(parseByteSize('2GB')).to.equal(2 * 1024 ** 3);
            expect(parseByteSize('2 gb')).to.equal(2 * 1024 ** 3);
        });

        it('should parse terabytes', () => {

            expect(parseByteSize('1tb')).to.equal(1024 ** 4);
            expect(parseByteSize('1TB')).to.equal(1024 ** 4);
        });

        it('should parse decimal values', () => {

            expect(parseByteSize('2.5mb')).to.equal(2.5 * 1024 ** 2);
            expect(parseByteSize('0.5gb')).to.equal(0.5 * 1024 ** 3);
        });

        it('should throw on invalid format', () => {

            expect(() => parseByteSize('invalid')).to.throw('Invalid byte size');
            expect(() => parseByteSize('10')).to.throw('Invalid byte size');
            expect(() => parseByteSize('mb10')).to.throw('Invalid byte size');
            expect(() => parseByteSize('')).to.throw('Invalid byte size');
        });

        it('should throw on unknown unit', () => {

            // The regex won't match pb, so it will throw "Invalid byte size"
            expect(() => parseByteSize('10pb')).to.throw('Invalid byte size');
        });

        it('should handle edge cases', () => {

            expect(parseByteSize('0kb')).to.equal(0);
            expect(parseByteSize('1kb')).to.equal(1024);
        });

        it('should parse plural forms', () => {

            expect(parseByteSize('10kbs')).to.equal(10 * 1024);
            expect(parseByteSize('5mbs')).to.equal(5 * 1024 ** 2);
            expect(parseByteSize('2gbs')).to.equal(2 * 1024 ** 3);
            expect(parseByteSize('1tbs')).to.equal(1024 ** 4);
        });

        it('should parse full word forms', () => {

            expect(parseByteSize('10 kilobyte')).to.equal(10 * 1024);
            expect(parseByteSize('10 kilobytes')).to.equal(10 * 1024);
            expect(parseByteSize('5 megabyte')).to.equal(5 * 1024 ** 2);
            expect(parseByteSize('5 megabytes')).to.equal(5 * 1024 ** 2);
            expect(parseByteSize('2 gigabyte')).to.equal(2 * 1024 ** 3);
            expect(parseByteSize('2 gigabytes')).to.equal(2 * 1024 ** 3);
            expect(parseByteSize('1 terabyte')).to.equal(1024 ** 4);
            expect(parseByteSize('1 terabytes')).to.equal(1024 ** 4);
        });
    });

    describe('units: parseTimeDuration', () => {

        it('should parse seconds', () => {

            expect(parseTimeDuration('30sec')).to.equal(30 * 1000);
            expect(parseTimeDuration('30SEC')).to.equal(30 * 1000);
            expect(parseTimeDuration('30 sec')).to.equal(30 * 1000);
        });

        it('should parse minutes', () => {

            expect(parseTimeDuration('5min')).to.equal(5 * 60 * 1000);
            expect(parseTimeDuration('5MIN')).to.equal(5 * 60 * 1000);
            expect(parseTimeDuration('5 min')).to.equal(5 * 60 * 1000);
        });

        it('should parse hours', () => {

            expect(parseTimeDuration('2hour')).to.equal(2 * 60 * 60 * 1000);
            expect(parseTimeDuration('2HOUR')).to.equal(2 * 60 * 60 * 1000);
            expect(parseTimeDuration('2 hour')).to.equal(2 * 60 * 60 * 1000);
        });

        it('should parse days', () => {

            expect(parseTimeDuration('7day')).to.equal(7 * 24 * 60 * 60 * 1000);
            expect(parseTimeDuration('7DAY')).to.equal(7 * 24 * 60 * 60 * 1000);
        });

        it('should parse weeks', () => {

            expect(parseTimeDuration('2week')).to.equal(2 * 7 * 24 * 60 * 60 * 1000);
            expect(parseTimeDuration('2WEEK')).to.equal(2 * 7 * 24 * 60 * 60 * 1000);
        });

        it('should parse months', () => {

            const result = parseTimeDuration('1month');
            expect(result).to.equal(Math.round(30.4 * 24 * 60 * 60 * 1000));
        });

        it('should parse years', () => {

            expect(parseTimeDuration('1year')).to.equal(365 * 24 * 60 * 60 * 1000);
        });

        it('should parse decimal values', () => {

            expect(parseTimeDuration('2.5hour')).to.equal(2.5 * 60 * 60 * 1000);
            expect(parseTimeDuration('0.5min')).to.equal(0.5 * 60 * 1000);
        });

        it('should throw on invalid format', () => {

            expect(() => parseTimeDuration('invalid')).to.throw('Invalid time duration');
            expect(() => parseTimeDuration('30')).to.throw('Invalid time duration');
            expect(() => parseTimeDuration('sec30')).to.throw('Invalid time duration');
            expect(() => parseTimeDuration('')).to.throw('Invalid time duration');
        });

        it('should throw on unknown unit', () => {

            // Test with a completely invalid unit
            expect(() => parseTimeDuration('30lightyears')).to.throw('Invalid time duration');
            expect(() => parseTimeDuration('30xyz')).to.throw('Invalid time duration');
        });

        it('should handle edge cases', () => {

            expect(parseTimeDuration('0sec')).to.equal(0);
            expect(parseTimeDuration('1sec')).to.equal(1000);
        });

        it('should parse plural forms', () => {

            expect(parseTimeDuration('30secs')).to.equal(30 * 1000);
            expect(parseTimeDuration('5mins')).to.equal(5 * 60 * 1000);
            expect(parseTimeDuration('2hours')).to.equal(2 * 60 * 60 * 1000);
            expect(parseTimeDuration('7days')).to.equal(7 * 24 * 60 * 60 * 1000);
            expect(parseTimeDuration('2weeks')).to.equal(2 * 7 * 24 * 60 * 60 * 1000);
            expect(parseTimeDuration('1months')).to.equal(Math.round(30.4 * 24 * 60 * 60 * 1000));
            expect(parseTimeDuration('1years')).to.equal(365 * 24 * 60 * 60 * 1000);
        });

        it('should parse full word forms', () => {

            expect(parseTimeDuration('30 second')).to.equal(30 * 1000);
            expect(parseTimeDuration('30 seconds')).to.equal(30 * 1000);
            expect(parseTimeDuration('5 minute')).to.equal(5 * 60 * 1000);
            expect(parseTimeDuration('5 minutes')).to.equal(5 * 60 * 1000);
            expect(parseTimeDuration('2 hour')).to.equal(2 * 60 * 60 * 1000);
            expect(parseTimeDuration('2 hours')).to.equal(2 * 60 * 60 * 1000);
            expect(parseTimeDuration('7 day')).to.equal(7 * 24 * 60 * 60 * 1000);
            expect(parseTimeDuration('7 days')).to.equal(7 * 24 * 60 * 60 * 1000);
            expect(parseTimeDuration('2 week')).to.equal(2 * 7 * 24 * 60 * 60 * 1000);
            expect(parseTimeDuration('2 weeks')).to.equal(2 * 7 * 24 * 60 * 60 * 1000);
        });

        it('should parse short forms', () => {

            expect(parseTimeDuration('30s')).to.equal(30 * 1000);
            expect(parseTimeDuration('5m')).to.equal(5 * 60 * 1000);
            expect(parseTimeDuration('2h')).to.equal(2 * 60 * 60 * 1000);
            expect(parseTimeDuration('2hr')).to.equal(2 * 60 * 60 * 1000);
            expect(parseTimeDuration('2hrs')).to.equal(2 * 60 * 60 * 1000);
            expect(parseTimeDuration('7d')).to.equal(7 * 24 * 60 * 60 * 1000);
            expect(parseTimeDuration('2w')).to.equal(2 * 7 * 24 * 60 * 60 * 1000);
            expect(parseTimeDuration('2wk')).to.equal(2 * 7 * 24 * 60 * 60 * 1000);
            expect(parseTimeDuration('2wks')).to.equal(2 * 7 * 24 * 60 * 60 * 1000);
            expect(parseTimeDuration('1mo')).to.equal(Math.round(30.4 * 24 * 60 * 60 * 1000));
            expect(parseTimeDuration('1mon')).to.equal(Math.round(30.4 * 24 * 60 * 60 * 1000));
            expect(parseTimeDuration('1y')).to.equal(365 * 24 * 60 * 60 * 1000);
            expect(parseTimeDuration('1yr')).to.equal(365 * 24 * 60 * 60 * 1000);
            expect(parseTimeDuration('1yrs')).to.equal(365 * 24 * 60 * 60 * 1000);
        });
    });

    describe('units: formatByteSize', () => {

        it('should format bytes with auto-selection', () => {

            expect(formatByteSize(512)).to.equal('512b');
            expect(formatByteSize(1024)).to.equal('1kb');
            expect(formatByteSize(1536)).to.equal('1.5kb');
            expect(formatByteSize(1024 ** 2)).to.equal('1mb');
            expect(formatByteSize(10485760)).to.equal('10mb');
            expect(formatByteSize(1024 ** 3)).to.equal('1gb');
            expect(formatByteSize(1024 ** 4)).to.equal('1tb');
        });

        it('should format with custom decimal places', () => {

            expect(formatByteSize(1536, { decimals: 0 })).to.equal('2kb');
            expect(formatByteSize(1536, { decimals: 1 })).to.equal('1.5kb');
            expect(formatByteSize(1536, { decimals: 3 })).to.equal('1.5kb');
        });

        it('should force specific unit', () => {

            expect(formatByteSize(1024, { unit: 'kb' })).to.equal('1kb');
            expect(formatByteSize(1024, { unit: 'mb' })).to.equal('0mb');
            expect(formatByteSize(1024 ** 2, { unit: 'kb' })).to.equal('1024kb');
            expect(formatByteSize(1024 ** 2, { unit: 'mb' })).to.equal('1mb');
        });

        it('should handle zero', () => {

            expect(formatByteSize(0)).to.equal('0b');
        });

        it('should handle large numbers', () => {

            expect(formatByteSize(5 * 1024 ** 4)).to.equal('5tb');
        });

        it('should handle decimal precision correctly', () => {

            expect(formatByteSize(1536, { decimals: 0 })).to.equal('2kb');
            expect(formatByteSize(1024 * 1.5, { decimals: 2 })).to.equal('1.5kb');
        });
    });

    describe('units: formatTimeDuration', () => {

        it('should format milliseconds with auto-selection', () => {

            expect(formatTimeDuration(500)).to.equal('500ms');
            expect(formatTimeDuration(1000)).to.equal('1sec');
            expect(formatTimeDuration(30000)).to.equal('30sec');
            expect(formatTimeDuration(60000)).to.equal('1min');
            expect(formatTimeDuration(90000)).to.equal('1.5min');
            expect(formatTimeDuration(3600000)).to.equal('1hour');
            expect(formatTimeDuration(86400000)).to.equal('1day');
            expect(formatTimeDuration(604800000)).to.equal('1week');
        });

        it('should handle fractional values with smart decimals', () => {

            // Whole numbers get 0 decimals by default
            expect(formatTimeDuration(60000)).to.equal('1min');

            // Fractional values get 1 decimal by default
            expect(formatTimeDuration(90000)).to.equal('1.5min');
        });

        it('should format with custom decimal places', () => {

            expect(formatTimeDuration(90000, { decimals: 0 })).to.equal('2min');
            expect(formatTimeDuration(90000, { decimals: 1 })).to.equal('1.5min');
            // Note: Number() removes trailing zeros, so 1.50 becomes 1.5
            expect(formatTimeDuration(90000, { decimals: 2 })).to.equal('1.5min');
        });

        it('should force specific unit', () => {

            expect(formatTimeDuration(90000, { unit: 'sec' })).to.equal('90sec');
            expect(formatTimeDuration(90000, { unit: 'min' })).to.equal('1.5min');
            expect(formatTimeDuration(3600000, { unit: 'min' })).to.equal('60min');
            expect(formatTimeDuration(3600000, { unit: 'hour' })).to.equal('1hour');
        });

        it('should handle zero', () => {

            expect(formatTimeDuration(0)).to.equal('0ms');
        });

        it('should handle large durations', () => {

            expect(formatTimeDuration(365 * 24 * 60 * 60 * 1000)).to.equal('1year');
            expect(formatTimeDuration(2 * 365 * 24 * 60 * 60 * 1000)).to.equal('2year');
        });

        it('should handle months correctly', () => {

            const monthMs = Math.round(30.4 * 24 * 60 * 60 * 1000);
            expect(formatTimeDuration(monthMs)).to.equal('1month');
            expect(formatTimeDuration(2 * monthMs)).to.equal('2month');
        });

        it('should override smart decimals when explicitly set', () => {

            // Note: Number() removes trailing zeros, so 1.0 becomes 1
            expect(formatTimeDuration(60000, { decimals: 1 })).to.equal('1min');
            expect(formatTimeDuration(90000, { decimals: 0 })).to.equal('2min');
        });
    });
});
