
/**
 * Performs a for-in loop that breaks when the check function returns false.
 *
 * Iterates over object properties (including inherited enumerable properties)
 * and stops early if the check function returns false for any property.
 *
 * @param item object or array to iterate over
 * @param check function to test each property value and key
 * @returns true if all properties pass the check, false otherwise
 *
 * @example
 * const config = { timeout: 5000, retries: 3, enabled: true };
 *
 * const allValid = allKeysValid(config, (value, key) => {
 *     if (key === 'timeout') return typeof value === 'number' && value > 0;
 *     if (key === 'retries') return typeof value === 'number' && value >= 0;
 *     if (key === 'enabled') return typeof value === 'boolean';
 *     return true;
 * }); // true
 *
 * @example
 * const scores = { alice: 95, bob: 87, charlie: 92 };
 * const allPassed = allKeysValid(scores, (score) => score >= 90); // false (bob: 87)
 *
 * @example
 * // Validate form data
 * const formData = { name: 'John', email: 'john@example.com', age: 30 };
 * const isValid = allKeysValid(formData, (value, field) => {
 *     return value !== null && value !== undefined && value !== '';
 * });
 */
export const allKeysValid = <T extends object>(
    item: T,
    check: {
        (v: T[keyof T], i: number | string): boolean
    }
): boolean => {

    let isEqual: boolean;

    for (const i in item) {

        isEqual = check(item[i], i);

        if (isEqual === false) {
            break;
        }
    }

    return isEqual!;
};

/**
 * Performs a for-of loop that breaks when the check function returns false.
 *
 * Iterates over iterable values (arrays, Sets, Maps) and stops early
 * if the check function returns false for any value.
 *
 * @param item iterable to iterate over (Array, Set, Map, etc.)
 * @param check function to test each value
 * @returns true if all values pass the check, false otherwise
 *
 * @example
 * const numbers = [2, 4, 6, 8, 10];
 * const allEven = allItemsValid(numbers, (num) => num % 2 === 0); // true
 *
 * const mixed = [2, 4, 5, 8];
 * const allEven2 = allItemsValid(mixed, (num) => num % 2 === 0); // false (stops at 5)
 *
 * @example
 * const userIds = new Set(['user1', 'user2', 'user3']);
 * const allValidIds = allItemsValid(userIds, (id) => {
 *     return typeof id === 'string' && id.startsWith('user');
 * }); // true
 *
 * @example
 * // Check if all files exist before processing
 * const files = ['config.json', 'data.csv', 'template.html'];
 * const allExist = allItemsValid(files, (filename) => {
 *     return fs.existsSync(filename);
 * });
 */
export const allItemsValid = <
    I extends Iterable<unknown>
>(
    item: I,
    check: (v: unknown) => boolean
): boolean => {

    let isEqual: boolean;

    for (const val of item) {

        isEqual = check(val);

        if (isEqual === false) {
            break;
        }
    }

    return isEqual!;
};
