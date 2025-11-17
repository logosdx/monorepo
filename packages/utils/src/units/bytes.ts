
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
