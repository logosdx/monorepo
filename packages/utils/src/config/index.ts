import { clone } from '../data-structures/clone.ts';
import { attemptSync } from '../async/attempt.ts';
import { MemoizeOptions, memoizeSync } from '../flow-control/index.ts';
import type { PathLeaves, PathNames, PathValue } from '../types.ts';
import { parseTimeDuration, parseByteSize } from '../units/index.ts';
import { assert, isEnabledValue, isDisabledValue } from '../validation/index.ts';
import { reach, setDeepMany } from '../object-utils/index.ts';

const onlyNumRegex = /^\d+$/;

/**
 * Coerces string values in an object to their appropriate types.
 * Converts "true"/"false" to booleans, numeric strings to numbers, etc.
 * Recursively processes nested objects.
 *
 * IMPORTANT: This function mutates the input object in place.
 *
 * INTENTION: This is a best-effort coercion based on common string patterns.
 * It does not handle all edge cases and should be used with caution. The goal
 * is to convert typical string representations of booleans and numbers to their
 * actual types, while leaving other strings unchanged.
 *
 * USE CASE: Parsing environment variables or other flatmap configuration objects.
 *
 * @param obj The object whose values should be coerced (mutated in place).
 * @param opts Optional configuration options
 * @param opts.parseUnits Optional flag to parse unit values like '5m', '10mb'. Default is false.
 * @param opts.skipConversion Optional function to skip conversion for specific keys. Default is to convert all keys.
 *
 * @example
 * const config = {
 *     debug: 'true',
 *     port: '3000',
 *     nested: {
 *         enabled: 'false',
 *         retries: '5'
 *     }
 * };
 *
 * castValuesToTypes(config);
 *
 * console.log(config);
 * // {
 * //     debug: true,
 * //     port: 3000,
 * //     nested: {
 * //         enabled: false,
 * //         retries: 5
 * //     }
 * // }
 *
 * @example
 * const config = {
 *     timeout: '5m',
 *     maxUploadSize: '10mb',
 *     debug: 'true'
 * };
 *
 * castValuesToTypes(config, { parseUnits: true });
 *
 * console.log(config);
 * // {
 * //     timeout: 300000,  // 5 minutes in milliseconds
 * //     maxUploadSize: 10485760,  // 10 megabytes in bytes
 * //     debug: true
 * // }
 *
 * @example
 * const config = {
 *     apiKey: '12345',
 *     port: '3000'
 * };
 *
 * // Skip conversion for apiKey (keep it as string)
 * castValuesToTypes(config, {
 *     skipConversion: (key) => key.toLowerCase().includes('key')
 * });
 *
 * console.log(config);
 * // {
 * //     apiKey: '12345',  // Kept as string
 * //     port: 3000        // Converted to number
 * // }
 */
export const castValuesToTypes = (
    obj: object,
    opts: {
        parseUnits?: boolean,
        skipConversion?: ((key: string, value: unknown) => boolean) | undefined
    } = {}
) => {

    const { parseUnits = false, skipConversion } = opts;

    for (const key in obj) {

        const k = key as keyof typeof obj;
        const val = obj[k];

        // Check if this key should be skipped
        if (skipConversion?.(key, val)) {
            continue;
        }

        const isObject = typeof val === 'object' && val !== null;

        if (isObject) {
            castValuesToTypes(val, opts);

            continue;
        }

        // Try to parse unit values if enabled
        if (parseUnits && typeof val === 'string') {

            const [timeDuration, timeErr] = attemptSync(() => parseTimeDuration(val));

            if (!timeErr && typeof timeDuration === 'number') {
                obj[k] = timeDuration as never;

                continue;
            }

            const [byteSize, bytesErr] = attemptSync(() => parseByteSize(val));

            if (!bytesErr && typeof byteSize === 'number') {
                obj[k] = byteSize as never;

                continue;
            }
        }

        const truthy = isEnabledValue(obj[k]);
        const falsy = isDisabledValue(obj[k]);

        // If the value is truthy or falsy, set it to the boolean value
        // NOTE: it MUST be a truthy or falsy value. If you only check
        // for truthy, you end up with a lot of false positives
        if (truthy || falsy) {
            obj[k] = truthy as never;

            continue;
        }

        // Only test regex on string values to avoid TypeError
        if (typeof val === 'string' && onlyNumRegex.test(val)) {

            obj[k] = Number(val) as never;

            continue;
        }
    }
}

export type MakeNestedConfigOpts = {

    filter?: (key: string, value: string) => boolean,
    skipConversion?: (key: string, value: unknown) => boolean,
    separator?: string,
    stripPrefix?: string | number,
    forceAllCapToLower?: boolean
    parseUnits?: boolean,
    memoizeOpts?: false | MemoizeOptions<any>
}

/**
 * Loads the flatmap variables and returns a config object.
 * Coerces values to the correct types based on guessing from
 * the value itself. For example, if the value is "true", it will be
 * converted to a boolean true, if it's "123", it will be converted
 * to a number 123, etc.
 *
 * @param flatConfig The flatmap configuration object (e.g. process.env)
 * @param opts Optional options object
 * @param opts.filter Optional filter function to include/exclude specific keys. Default is to include all keys.
 * @param opts.forceAllCapToLower Optional flag to force all-caps keys to lowercase. Default is true.
 * @param opts.separator Optional string to use as a separator for nested keys. Default is "_"
 * @param opts.stripPrefix Optional prefix to strip from keys. Can be a string (e.g., "APP_") or number of characters (e.g., 4). Default is undefined (no stripping).
 * @param opts.parseUnits Optional flag to parse unit values like '5m', '10mb'. Default is false.
 * @param opts.skipConversion Optional function to skip conversion for specific keys. Default is to convert all keys.
 * @param opts.memoizeOpts Optional memoization options for caching the config. Default is false (no memoization).
 *
 * @returns The full configuration object.
 *
 * @example
 * // Assuming process.env contains:
 * // {
 * //     APP_DB_HOST: 'localhost',
 * //     APP_DB_PORT: '5432',
 * //     APP_DEBUG: 'true',
 * //     APP_FEATURE_X_ENABLED: 'false'
 * //     APP_WORKER_EMAILS_maxRunsPerMin: '100'
 * //     APP_WORKER_EMAILS_networkTimeoutMs: '100'
 * // }
 *
 * const config = makeNestedConfig(process.env, {
 *     filter: (key) => key.startsWith('APP_'),
 *     stripPrefix: 'APP_',  // Strip the APP_ prefix from all keys
 *     forceAllCapToLower: true,
 *     separator: '_',
 *     memoizeOpts: { ttl: 60000 } // Cache for 60 seconds
 * });
 *
 * console.log(config());
 * // {
 * //     db: {
 * //         host: 'localhost',
 * //         port: 5432
 * //     },
 * //     debug: true,
 * //     feature: {
 * //         x: {
 * //             enabled: false
 * //         }
 * //     },
 * //     worker: {
 * //         emails: {
 * //             maxRunsPerMin: 100,
 * //             networkTimeoutMs: 100
 * //         }
 * //     }
 * // }
 *
 * @example
 * // Using a custom separator
 * // Assuming process.env contains:
 * // {
 * //     APP_DB__HOST: 'localhost',
 * //     APP_DB__PORT: '5432',
 * //     APP_DEBUG: 'true',
 * //     APP_FEATURE__X_ENABLED: 'false',
 * //     APP_WORKER__EMAILS__maxRunsPerMin: '100'
 * //     APP_WORKER__EMAILS__networkTimeoutMs: '100'
 * // }
 * const config = makeNestedConfig(process.env, {
 *     filter: (key) => key.startsWith('APP_'),
 *     stripPrefix: 'APP_',  // Strip the APP_ prefix
 *     forceAllCapToLower: true,
 *     separator: '__'
 * });
 *
 * console.log(config());
 * // {
 * //     db: {
 * //         host: 'localhost',
 * //         port: 5432
 * //     },
 * //     debug: true,
 * //     feature: {
 * //         x_enabled: false
 * //     },
 * //     worker: {
 * //         emails: {
 * //             maxRunsPerMin: 100,
 * //             networkTimeoutMs: 100
 * //         }
 * //     }
 * // }
 *
 * @example
 *
 * // Not forcing all-caps to lowercase
 * // Assuming process.env contains:
 * // {
 * //     APP_DB_HOST: 'localhost',
 * //     APP_DB_PORT: '5432',
 * //     APP_DEBUG: 'true',
 * //     APP_FEATURE_X_ENABLED: 'false'
 * //     APP_WORKER_EMAILS_maxRunsPerMin: '100'
 * //     APP_WORKER_EMAILS_networkTimeoutMs: '100'
 * // }
 *
 * const config = makeNestedConfig(process.env, {
 *     filter: (key) => key.startsWith('APP_'),
 *     stripPrefix: 'APP_',  // Strip the APP_ prefix
 *     forceAllCapToLower: false,
 *     separator: '_'
 * });
 *
 * console.log(config());
 * // {
 * //     DB: {
 * //         HOST: 'localhost',
 * //         PORT: 5432
 * //     },
 * //     DEBUG: true,
 * //     FEATURE: {
 * //         X_ENABLED: false
 * //     },
 * //     WORKER: {
 * //         EMAILS: {
 * //             maxRunsPerMin: 100,
 * //             networkTimeoutMs: 100
 * //         }
 * //     }
 * // }
 *
 * @example
 * // Using parseUnits to convert time and byte values
 * // Assuming process.env contains:
 * // {
 * //     APP_SESSION_TIMEOUT: '15m',
 * //     APP_CACHE_TTL: '1hour',
 * //     APP_MAX_UPLOAD_SIZE: '10mb',
 * //     APP_DISK_QUOTA: '100gb'
 * // }
 *
 * const config = makeNestedConfig(process.env, {
 *     filter: (key) => key.startsWith('APP_'),
 *     stripPrefix: 'APP_',
 *     parseUnits: true  // Enable unit parsing
 * });
 *
 * console.log(config());
 * // {
 * //     session: {
 * //         timeout: 900000  // 15 minutes in milliseconds
 * //     },
 * //     cache: {
 * //         ttl: 3600000  // 1 hour in milliseconds
 * //     },
 * //     max: {
 * //         upload: {
 * //             size: 10485760  // 10 megabytes in bytes
 * //         }
 * //     },
 * //     disk: {
 * //         quota: 107374182400  // 100 gigabytes in bytes
 * //     }
 * // }
 *
 * @example
 * // Using skipConversion to keep certain values as strings
 * // Assuming process.env contains:
 * // {
 * //     APP_API_KEY: '12345',
 * //     APP_SECRET_TOKEN: '67890',
 * //     APP_PORT: '3000',
 * //     APP_DEBUG: 'true'
 * // }
 *
 * const config = makeNestedConfig(process.env, {
 *     filter: (key) => key.startsWith('APP_'),
 *     stripPrefix: 'APP_',
 *     skipConversion: (key) => key.toLowerCase().includes('key') || key.toLowerCase().includes('token')
 * });
 *
 * console.log(config());
 * // {
 * //     api: {
 * //         key: '12345'  // Kept as string
 * //     },
 * //     secret: {
 * //         token: '67890'  // Kept as string
 * //     },
 * //     port: 3000,  // Converted to number
 * //     debug: true  // Converted to boolean
 * // }
 *
 */
export const makeNestedConfig = <
    C extends object = Record<string, any>,
    F = Record<string, string>
>(
    _flatConfig: F,
    opts: MakeNestedConfigOpts = {}
): {
    allConfigs: () => C;
    getConfig: <P extends PathLeaves<C>, D extends PathValue<C, P>>(
        path: P,
        defaultValue?: D
    ) => PathValue<C, P>;
} => {

    assert(typeof _flatConfig === 'object' && _flatConfig !== null, 'flatConfig must be a non-null object');
    assert(typeof opts === 'object' && opts !== null, 'opts must be a non-null object');
    assert(opts.filter === undefined || typeof opts.filter === 'function', 'filter must be a function');
    assert(opts.forceAllCapToLower === undefined || typeof opts.forceAllCapToLower === 'boolean', 'forceAllCapToLower must be a boolean');
    assert(opts.separator === undefined || typeof opts.separator === 'string', 'separator must be a string');
    assert(opts.stripPrefix === undefined || typeof opts.stripPrefix === 'string' || typeof opts.stripPrefix === 'number', 'stripPrefix must be a string or number');
    assert(opts.parseUnits === undefined || typeof opts.parseUnits === 'boolean', 'parseUnits must be a boolean');
    assert(opts.skipConversion === undefined || typeof opts.skipConversion === 'function', 'skipConversion must be a function');
    assert(opts.memoizeOpts === undefined || typeof opts.memoizeOpts === 'object' || opts.memoizeOpts === false, 'memoizeOpts must be an object or false');

    const {
        filter,
        forceAllCapToLower = true,
        separator = '_',
        stripPrefix,
        parseUnits = false,
        skipConversion,
        memoizeOpts = false
    } = opts;

    const isAllCaps = (str: string) => /^[A-Z0-9_]+$/.test(str);

    // If an key is set as all-caps, we want to convert it to lowercase
    // for use in a javascript object. For example, in the case of
    // APP_DB_HOST, we want to convert it to db.host. If we, however,
    // set a variable like APP_WORKER_AUTH_maxRunsPerMin=100, we get to
    // keep the capitalization of maxRunsPerMin, because it's not all-caps.
    // This can be very useful for using a convention that allows for conf-
    // iguration via a flatmap.
    const handleCasing = (str: string) => {

        let processedStr = str;

        if (stripPrefix !== undefined) {

            if (typeof stripPrefix === 'number') {
                processedStr = str.slice(stripPrefix);
            }
            else {
                processedStr = str.startsWith(stripPrefix)
                    ? str.slice(stripPrefix.length)
                    : str
                ;
            }
        }

        const split = processedStr.split(separator);

        return split.map(
            (s) => {

                if (isAllCaps(s) && forceAllCapToLower) return s.toLowerCase();

                return s;
            }
        ).join('.');
    }

    function allConfigs(): C {

        const flatConfig = clone(_flatConfig);
        const config = {} as C;

        const keys = Object.entries(flatConfig as Record<string, string>)
            .filter(([key, val]) => filter?.(key, val!) ?? true)
            .map(([key]) => key)
            .sort()
        ;

        const [, err] = attemptSync(() => {

            setDeepMany<C>(
                config,
                keys.map((k) => [handleCasing(k), flatConfig[k as keyof typeof flatConfig]]) as never
            );

            castValuesToTypes(
                config as Record<string, string>,
                {
                    parseUnits,
                    skipConversion
                }
            );

        });

        if (
            err instanceof Error &&
            err.message.includes('on primitive value')
        ) {

            const key = (k: string) => k.split('_').join(separator);
            const eq = (k: string, v: string) => `${key(k)}=${v}`;

            // Build the message as the user would see it in the flatmap
            // If the user uses '__' as a separator, we want to show that in the message
            // so they can easily identify the problem.
            const message = [
                'Failed to load flatmap variables.',
                'You\'re likely trying to set a nested property on a non-object value.',
                `For example, if you have ${eq('APP_DB_NAME', 'foo')}, and then you try to set`,
                `${eq('APP_DB_NAME_TEST', 'bar')}, you'll get this error because ${key('APP_DB_NAME')} is a string.`,
                'The correct way is to designate each namespace (separated by underscores) as ',
                `an object. For example, ${eq('APP_DB_NAME', 'foo')} becomes { db: { name: "foo" } }, and,`,
                `${eq('APP_DB_NAME_TEST', 'bar')} becomes { db: { name: { test: "bar" } } }, but both cannot coexist.`,
                `\n\nYou can either \`unset ${key('APP_PROBLEMATIC')}\` or scope all vars to \`${key('APP_NAMESPACE_NAME')}\` to`,
                'make it a nested object.',
                '\n\n'
            ]

            console.error(message.join(' '));
        }

        if (err) throw err;

        return config;
    }

    function getConfig<P extends PathLeaves<C>, D extends PathValue<C, P>>(
        path: P,
        defaultValue?: D
    ): PathValue<C, P> {

        const config = allConfigs();

        const value = reach(config, path as PathNames<C>);

        if (value === undefined || value === null) {
            return defaultValue as PathValue<C, P>;
        }

        return value as PathValue<C, P>;
    }

    if (!memoizeOpts) return {
        allConfigs,
        getConfig
    };

    return {
        allConfigs: memoizeSync(allConfigs, memoizeOpts),
        getConfig: memoizeSync(getConfig, memoizeOpts) as typeof getConfig
    }
}
