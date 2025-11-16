
/**
 * Time unit constants and helper functions for duration calculations.
 *
 * Provides millisecond values for common time units (seconds, minutes, hours, etc.)
 * and functions to multiply these units. Useful for setTimeout, interval calculations,
 * cache TTLs, and any duration-based logic.
 *
 * WHY: Improves code readability by using human-friendly time units instead of raw milliseconds.
 * Instead of writing `setTimeout(fn, 300000)`, you can write `setTimeout(fn, timeUnits.min15)`.
 *
 * @example
 * // Using predefined constants
 * setTimeout(cleanup, timeUnits.min15);  // 15 minutes
 * cache.set('key', value, { ttl: timeUnits.hour });  // 1 hour
 *
 * @example
 * // Using helper functions
 * const backoffDelay = timeUnits.secs(30);  // 30 seconds
 * const cacheExpiry = timeUnits.days(7);    // 7 days
 * const sessionTimeout = timeUnits.hours(2); // 2 hours
 */
export const timeUnits = {

    sec: 1000,
    min: 60 * 1000,
    min15: 15 * 60 * 1000,
    min30: 30 * 60 * 1000,
    hour: 60 * 60 * 1000,
    hour2: 2 * 60 * 60 * 1000,
    hour4: 4 * 60 * 60 * 1000,
    hour8: 8 * 60 * 60 * 1000,
    hour12: 12 * 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,

    secs(n: number) { return n * this.sec; },
    mins(n: number) { return n * this.min; },
    hours(n: number) { return n * this.hour; },
    days(n: number) { return n * this.day; },
    weeks(n: number) { return n * this.week; },
    months(n: number) { return Math.round(n * 30.4 * this.day); },
    years(n: number) { return n * 365 * this.day; }
};

/**
 * Creates a duration in seconds (converted to milliseconds).
 *
 * WHY: Provides a more readable way to specify durations in seconds.
 *
 * @param n number of seconds
 * @returns milliseconds equivalent
 *
 * @example
 * setTimeout(fn, seconds(30));  // 30 seconds = 30000ms
 * cache.set('key', value, { ttl: seconds(120) });  // 2 minutes
 */
export const seconds = (n: number) => timeUnits.secs(n);

/**
 * Creates a duration in minutes (converted to milliseconds).
 *
 * WHY: Provides a more readable way to specify durations in minutes.
 *
 * @param n number of minutes
 * @returns milliseconds equivalent
 *
 * @example
 * setTimeout(fn, minutes(5));  // 5 minutes = 300000ms
 * const pollInterval = minutes(2);  // Poll every 2 minutes
 */
export const minutes = (n: number) => timeUnits.mins(n);

/**
 * Creates a duration in hours (converted to milliseconds).
 *
 * WHY: Provides a more readable way to specify durations in hours.
 *
 * @param n number of hours
 * @returns milliseconds equivalent
 *
 * @example
 * setTimeout(fn, hours(1));  // 1 hour = 3600000ms
 * const sessionExpiry = hours(24);  // 24 hour session
 */
export const hours = (n: number) => timeUnits.hours(n);

/**
 * Creates a duration in days (converted to milliseconds).
 *
 * WHY: Provides a more readable way to specify durations in days.
 *
 * @param n number of days
 * @returns milliseconds equivalent
 *
 * @example
 * const cacheExpiry = days(7);  // 7 days = 604800000ms
 * setTimeout(cleanup, days(30));  // 30 day cleanup cycle
 */
export const days = (n: number) => timeUnits.days(n);

/**
 * Creates a duration in weeks (converted to milliseconds).
 *
 * WHY: Provides a more readable way to specify durations in weeks.
 *
 * @param n number of weeks
 * @returns milliseconds equivalent
 *
 * @example
 * const backupInterval = weeks(2);  // Backup every 2 weeks
 * setTimeout(archive, weeks(4));  // Archive after 4 weeks
 */
export const weeks = (n: number) => timeUnits.weeks(n);

/**
 * Creates a duration in months (converted to milliseconds).
 *
 * WHY: Provides a more readable way to specify durations in months.
 * Uses 30.4 days as average month length for accuracy.
 *
 * @param n number of months
 * @returns milliseconds equivalent (rounded)
 *
 * @example
 * const subscriptionExpiry = months(1);  // 1 month subscription
 * setTimeout(fn, months(3));  // Quarterly task
 */
export const months = (n: number) => timeUnits.months(n);

/**
 * Creates a duration in years (converted to milliseconds).
 *
 * WHY: Provides a more readable way to specify durations in years.
 * Uses 365 days (does not account for leap years).
 *
 * @param n number of years
 * @returns milliseconds equivalent
 *
 * @example
 * const licenseExpiry = years(1);  // 1 year license
 * const longTermCache = years(5);  // 5 year retention
 */
export const years = (n: number) => timeUnits.years(n);

/**
 * Byte size unit constants and helper functions for data size calculations.
 *
 * Provides byte values for common size units (KB, MB, GB, TB) using binary units (1024-based).
 * Useful for file size limits, memory calculations, and data transfer limits.
 *
 * WHY: Improves code readability by using human-friendly size units instead of raw bytes.
 * Instead of writing `maxSize: 5242880`, you can write `maxSize: byteUnits.mbs(5)`.
 *
 * @example
 * // Using predefined constants
 * const maxFileSize = byteUnits.mb * 10;  // 10 MB
 * if (fileSize > byteUnits.gb) console.log('File larger than 1GB');
 *
 * @example
 * // Using helper functions
 * const uploadLimit = byteUnits.mbs(50);  // 50 megabytes
 * const diskQuota = byteUnits.gbs(100);   // 100 gigabytes
 */
export const byteUnits = {
    kb: 1024,
    mb: 1024 ** 2,
    gb: 1024 ** 3,
    tb: 1024 ** 4,

    kbs(n: number) { return n * this.kb; },
    mbs(n: number) { return n * this.mb; },
    gbs(n: number) { return n * this.gb; },
    tbs(n: number) { return n * this.tb; },
}

/**
 * Creates a byte size in kilobytes.
 *
 * WHY: Provides a more readable way to specify sizes in KB.
 *
 * @param n number of kilobytes
 * @returns bytes equivalent
 *
 * @example
 * const maxSize = kilobytes(500);  // 500 KB = 512000 bytes
 * if (buffer.length > kilobytes(100)) console.log('Buffer too large');
 */
export const kilobytes = (n: number) => byteUnits.kbs(n);

/**
 * Creates a byte size in megabytes.
 *
 * WHY: Provides a more readable way to specify sizes in MB.
 *
 * @param n number of megabytes
 * @returns bytes equivalent
 *
 * @example
 * const uploadLimit = megabytes(10);  // 10 MB upload limit
 * const cacheSize = megabytes(50);  // 50 MB cache
 */
export const megabytes = (n: number) => byteUnits.mbs(n);

/**
 * Creates a byte size in gigabytes.
 *
 * WHY: Provides a more readable way to specify sizes in GB.
 *
 * @param n number of gigabytes
 * @returns bytes equivalent
 *
 * @example
 * const diskQuota = gigabytes(100);  // 100 GB disk quota
 * if (totalSize > gigabytes(5)) console.log('Large dataset');
 */
export const gigabytes = (n: number) => byteUnits.gbs(n);

/**
 * Creates a byte size in terabytes.
 *
 * WHY: Provides a more readable way to specify sizes in TB.
 *
 * @param n number of terabytes
 * @returns bytes equivalent
 *
 * @example
 * const storageLimit = terabytes(2);  // 2 TB storage limit
 * const archiveSize = terabytes(10);  // 10 TB archive
 */
export const terabytes = (n: number) => byteUnits.tbs(n);

/**
 * Parses a byte size string into bytes.
 *
 * WHY: Allows reading byte sizes from configuration files or user input in a human-friendly format.
 * Supports decimal values, plurals, full words, and is case-insensitive.
 *
 * Accepts formats:
 * - Short: "10kb", "10 kb"
 * - Plural: "10kbs", "10 mbs"
 * - Full words: "10 kilobytes", "10 megabytes"
 *
 * @param str byte size string (format: "<number> <unit>")
 * @returns bytes as number
 * @throws Error if string format is invalid or unit is unknown
 *
 * @example
 * parseByteSize('10mb');           // 10485760
 * parseByteSize('10 mbs');         // 10485760
 * parseByteSize('10 megabytes');   // 10485760
 * parseByteSize('2.5 GB');         // 2684354560
 * parseByteSize('500 kilobytes');  // 512000
 *
 * @example
 * // Using in configuration
 * const config = {
 *     uploadLimit: parseByteSize(process.env.MAX_UPLOAD || '10mb')
 * };
 */
export const parseByteSize = (str: string) => {

    const match = str.match(/^(\d+(?:\.\d+)?)\s*(kb|kbs?|kilobytes?|mb|mbs?|megabytes?|gb|gbs?|gigabytes?|tb|tbs?|terabytes?)$/i);

    if (!match) {
        throw new Error(`Invalid byte size: ${str}`);
    }

    const [, num, unit] = match;

    const n = parseFloat(num!);
    const unitLower = unit!.toLowerCase();

    // Normalize to base unit
    if (unitLower.startsWith('k')) return kilobytes(n);
    if (unitLower.startsWith('m')) return megabytes(n);
    if (unitLower.startsWith('g')) return gigabytes(n);
    if (unitLower.startsWith('t')) return terabytes(n);

    throw new Error(`Unknown unit: ${unit}`);
}

/**
 * Parses a time duration string into milliseconds.
 *
 * WHY: Allows reading durations from configuration files or user input in a human-friendly format.
 * Supports decimal values, plurals, full words, and is case-insensitive.
 *
 * Accepts formats:
 * - Short: "30sec", "5min", "2hour"
 * - Plural: "30secs", "5mins", "2hours"
 * - Full words: "30 seconds", "5 minutes", "2 hours"
 *
 * @param str time duration string (format: "<number> <unit>")
 * @returns milliseconds as number
 * @throws Error if string format is invalid or unit is unknown
 *
 * @example
 * parseTimeDuration('30sec');       // 30000
 * parseTimeDuration('30 secs');     // 30000
 * parseTimeDuration('30 seconds');  // 30000
 * parseTimeDuration('5 min');       // 300000
 * parseTimeDuration('5 minutes');   // 300000
 * parseTimeDuration('2.5 hours');   // 9000000
 *
 * @example
 * // Using in configuration
 * const config = {
 *     sessionTimeout: parseTimeDuration(process.env.SESSION_TIMEOUT || '1hour'),
 *     cacheExpiry: parseTimeDuration(process.env.CACHE_TTL || '15min')
 * };
 */
export const parseTimeDuration = (str: string) => {

    const match = str.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs?|seconds?|m|min|mins?|minutes?|h|hr|hrs?|hour|hours?|d|day|days?|w|wk|wks?|week|weeks?|mo|mon|mons?|month|months?|y|yr|yrs?|year|years?)$/i);

    if (!match) {
        throw new Error(`Invalid time duration: ${str}`);
    }

    const [, num, unit] = match;

    const n = parseFloat(num!);
    const unitLower = unit!.toLowerCase();

    // Normalize to base unit
    if (unitLower.startsWith('s')) return seconds(n);
    if (unitLower.startsWith('m') && !unitLower.startsWith('mo')) return minutes(n);
    if (unitLower.startsWith('h')) return hours(n);
    if (unitLower.startsWith('d')) return days(n);
    if (unitLower.startsWith('w')) return weeks(n);
    if (unitLower.startsWith('mo')) return months(n);
    if (unitLower.startsWith('y')) return years(n);

    throw new Error(`Unknown unit: ${unit}`);
}

/**
 * Formats a byte value into a human-readable string.
 *
 * WHY: Converts raw byte values into user-friendly strings for display.
 * Automatically selects the most appropriate unit (KB, MB, GB, TB).
 *
 * @param bytes number of bytes to format
 * @param opts optional formatting options
 * @param opts.decimals number of decimal places (default: 2)
 * @param opts.unit force a specific unit instead of auto-selecting
 * @returns formatted string (e.g., "10.5mb", "2gb")
 *
 * @example
 * formatByteSize(1024);              // "1kb"
 * formatByteSize(1536);              // "1.5kb"
 * formatByteSize(10485760);          // "10mb"
 * formatByteSize(1073741824);        // "1gb"
 * formatByteSize(1536, { decimals: 0 });  // "2kb"
 *
 * @example
 * // Force specific unit
 * formatByteSize(1024, { unit: 'mb' });  // "0mb"
 * formatByteSize(1024, { unit: 'kb' });  // "1kb"
 *
 * @example
 * // Display file sizes
 * files.forEach(file => {
 *     console.log(`${file.name}: ${formatByteSize(file.size)}`);
 * });
 */
export const formatByteSize = (
    bytes: number,
    opts: {
        decimals?: number,
        unit?: 'kb' | 'mb' | 'gb' | 'tb'
    } = {}
) => {

    const { decimals = 2, unit } = opts;

    if (unit) {

        const divisors = { kb: byteUnits.kb, mb: byteUnits.mb, gb: byteUnits.gb, tb: byteUnits.tb };
        const value = bytes / divisors[unit];
        const rounded = decimals === 0 ? Math.round(value) : Number(value.toFixed(decimals));

        return `${rounded}${unit}`;
    }

    // Auto-select unit
    if (bytes >= byteUnits.tb) {

        const value = bytes / byteUnits.tb;
        const rounded = decimals === 0 ? Math.round(value) : Number(value.toFixed(decimals));

        return `${rounded}tb`;
    }

    if (bytes >= byteUnits.gb) {

        const value = bytes / byteUnits.gb;
        const rounded = decimals === 0 ? Math.round(value) : Number(value.toFixed(decimals));

        return `${rounded}gb`;
    }

    if (bytes >= byteUnits.mb) {

        const value = bytes / byteUnits.mb;
        const rounded = decimals === 0 ? Math.round(value) : Number(value.toFixed(decimals));

        return `${rounded}mb`;
    }

    if (bytes >= byteUnits.kb) {

        const value = bytes / byteUnits.kb;
        const rounded = decimals === 0 ? Math.round(value) : Number(value.toFixed(decimals));

        return `${rounded}kb`;
    }

    return `${bytes}b`;
}

/**
 * Formats a millisecond duration into a human-readable string.
 *
 * WHY: Converts raw millisecond values into user-friendly strings for display.
 * Automatically selects the most appropriate unit (sec, min, hour, day, etc.).
 *
 * @param ms number of milliseconds to format
 * @param opts optional formatting options
 * @param opts.decimals number of decimal places (default: 0 for whole units, 1 for fractional)
 * @param opts.unit force a specific unit instead of auto-selecting
 * @returns formatted string (e.g., "30sec", "5min", "2hour")
 *
 * @example
 * formatTimeDuration(1000);          // "1sec"
 * formatTimeDuration(30000);         // "30sec"
 * formatTimeDuration(90000);         // "1.5min"
 * formatTimeDuration(3600000);       // "1hour"
 * formatTimeDuration(86400000);      // "1day"
 *
 * @example
 * // Force specific unit
 * formatTimeDuration(90000, { unit: 'sec' });  // "90sec"
 * formatTimeDuration(90000, { unit: 'min' });  // "1.5min"
 *
 * @example
 * // Control decimals
 * formatTimeDuration(90000, { decimals: 0 });  // "2min"
 * formatTimeDuration(90000, { decimals: 2 });  // "1.50min"
 *
 * @example
 * // Display cache expiry times
 * console.log(`Cache expires in: ${formatTimeDuration(cache.ttl)}`);
 */
export const formatTimeDuration = (
    ms: number,
    opts: {
        decimals?: number,
        unit?: 'sec' | 'min' | 'hour' | 'day' | 'week' | 'month' | 'year'
    } = {}
) => {

    const { decimals, unit } = opts;

    if (unit) {

        const divisors = {
            sec: timeUnits.sec,
            min: timeUnits.min,
            hour: timeUnits.hour,
            day: timeUnits.day,
            week: timeUnits.week,
            month: Math.round(30.4 * timeUnits.day),
            year: 365 * timeUnits.day
        };

        const value = ms / divisors[unit];
        const defaultDecimals = decimals ?? (value % 1 === 0 ? 0 : 1);
        const rounded = defaultDecimals === 0 ? Math.round(value) : Number(value.toFixed(defaultDecimals));

        return `${rounded}${unit}`;
    }

    // Auto-select unit
    if (ms >= 365 * timeUnits.day) {

        const value = ms / (365 * timeUnits.day);
        const defaultDecimals = decimals ?? (value % 1 === 0 ? 0 : 1);
        const rounded = defaultDecimals === 0 ? Math.round(value) : Number(value.toFixed(defaultDecimals));

        return `${rounded}year`;
    }

    if (ms >= Math.round(30.4 * timeUnits.day)) {

        const value = ms / Math.round(30.4 * timeUnits.day);
        const defaultDecimals = decimals ?? (value % 1 === 0 ? 0 : 1);
        const rounded = defaultDecimals === 0 ? Math.round(value) : Number(value.toFixed(defaultDecimals));

        return `${rounded}month`;
    }

    if (ms >= timeUnits.week) {

        const value = ms / timeUnits.week;
        const defaultDecimals = decimals ?? (value % 1 === 0 ? 0 : 1);
        const rounded = defaultDecimals === 0 ? Math.round(value) : Number(value.toFixed(defaultDecimals));

        return `${rounded}week`;
    }

    if (ms >= timeUnits.day) {

        const value = ms / timeUnits.day;
        const defaultDecimals = decimals ?? (value % 1 === 0 ? 0 : 1);
        const rounded = defaultDecimals === 0 ? Math.round(value) : Number(value.toFixed(defaultDecimals));

        return `${rounded}day`;
    }

    if (ms >= timeUnits.hour) {

        const value = ms / timeUnits.hour;
        const defaultDecimals = decimals ?? (value % 1 === 0 ? 0 : 1);
        const rounded = defaultDecimals === 0 ? Math.round(value) : Number(value.toFixed(defaultDecimals));

        return `${rounded}hour`;
    }

    if (ms >= timeUnits.min) {

        const value = ms / timeUnits.min;
        const defaultDecimals = decimals ?? (value % 1 === 0 ? 0 : 1);
        const rounded = defaultDecimals === 0 ? Math.round(value) : Number(value.toFixed(defaultDecimals));

        return `${rounded}min`;
    }

    if (ms >= timeUnits.sec) {

        const value = ms / timeUnits.sec;
        const defaultDecimals = decimals ?? (value % 1 === 0 ? 0 : 1);
        const rounded = defaultDecimals === 0 ? Math.round(value) : Number(value.toFixed(defaultDecimals));

        return `${rounded}sec`;
    }

    return `${ms}ms`;
}
