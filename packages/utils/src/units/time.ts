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
