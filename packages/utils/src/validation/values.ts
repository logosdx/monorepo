const ENABLED_VALUES = new Set<string | boolean>(['true', 'yes', true]);
const DISABLED_VALUES = new Set<string | boolean>(['false', 'no', false]);

/**
 * Checks if a value is considered an enabled value.
 *
 * Recognizes 'true', 'yes', and true as enabled values.
 *
 * @param val value to check (string or boolean)
 * @returns true if value is an enabled value, false otherwise
 *
 * @example
 * isEnabledValue('true') // true
 * isEnabledValue('yes') // true
 * isEnabledValue(true) // true
 * isEnabledValue('false') // false
 * isEnabledValue('no') // false
 * isEnabledValue(false) // false
 */
export const isEnabledValue = (val: unknown) => {

    return ENABLED_VALUES.has(val as string | boolean);
};

/**
 * Checks if a value is considered a disabled value.
 *
 * Recognizes 'false', 'no', and false as disabled values.
 *
 * @param val value to check (string or boolean)
 * @returns true if value is a disabled value, false otherwise
 *
 * @example
 * isDisabledValue('false') // true
 * isDisabledValue('no') // true
 * isDisabledValue(false) // true
 * isDisabledValue('true') // false
 * isDisabledValue('yes') // false
 * isDisabledValue(true) // false
 */
export const isDisabledValue = (val: unknown) => {

    return DISABLED_VALUES.has(val as string | boolean);
}

/**
 * Checks if a value is either an enabled or disabled value.
 *
 * Recognizes 'true', 'yes', true, 'false', 'no', and false.
 *
 * @param val value to check (string or boolean)
 * @returns true if value is an enabled or disabled value, false otherwise
 *
 * @example
 * hasEnabledOrDisabledValue('true') // true
 * hasEnabledOrDisabledValue('false') // true
 * hasEnabledOrDisabledValue('yes') // true
 * hasEnabledOrDisabledValue('no') // true
 * hasEnabledOrDisabledValue(true) // true
 * hasEnabledOrDisabledValue(false) // true
 * hasEnabledOrDisabledValue('maybe') // false
 * hasEnabledOrDisabledValue(123) // false
 */
export const hasEnabledOrDisabledValue = (val: unknown) => {

    return isEnabledValue(val) || isDisabledValue(val);
}
