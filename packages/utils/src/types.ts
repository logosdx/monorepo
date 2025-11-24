/**
 * Generic function type for type-safe function signatures.
 *
 * Enables consistent typing across utility functions and higher-order functions
 * where function parameters need to be strongly typed.
 *
 * @example
 * function memoize<A extends any[], R>(fn: Func<A, R>): Func<A, R>
 * function debounce<A extends any[]>(fn: Func<A, void>, ms: number): Func<A, void>
 */
export type Func<A extends any[] = any[], R = any> = (...args: A) => R;

/**
 * Generic async function type for type-safe async function signatures.
 *
 * Ensures Promise return types are properly handled in utility functions
 * that work with async operations.
 *
 * @example
 * function retry<A extends any[], R>(fn: AsyncFunc<A, R>, attempts: number): AsyncFunc<A, R>
 * function withTimeout<A extends any[], R>(fn: AsyncFunc<A, R>, ms: number): AsyncFunc<A, R>
 */
export type AsyncFunc<A extends any[] = any[], R = any> = (...args: A) => Promise<R>;

/**
 * Generic constructor type for class-based type operations.
 *
 * Enables type-safe operations on constructor functions and class factories.
 *
 * @example
 * function createInstance<T extends ClassType>(ctor: T, ...args: any[]): InstanceType<T>
 */
export type ClassType = { new: Func }

/**
 * Extracts only non-function properties from an object type.
 *
 * Essential for serialization, data persistence, and state management where
 * only data properties should be included, not methods.
 *
 * @example
 * interface User { id: string; name: string; save(): void; delete(): void; }
 * type UserData = Pick<User, NonFunctionProps<User>>; // { id: string; name: string; }
 */
export type NonFunctionProps<T> = { [K in keyof T]: T[K] extends Func | ClassType ? never : K }[keyof T];

/**
 * Extracts only function properties from an object type.
 *
 * Useful for creating proxies, method decorators, or when separating
 * behavior from data in object-oriented designs.
 *
 * @example
 * interface User { id: string; name: string; save(): void; delete(): void; }
 * type UserMethods = Pick<User, FunctionProps<User>>; // { save(): void; delete(): void; }
 */
export type FunctionProps<T> = { [K in keyof T]: T[K] extends Func | ClassType ? K : never }[keyof T];

/**
 * Makes all properties in a nested object optional recursively.
 *
 * Critical for partial update operations, configuration merging, and
 * scenarios where deep object structures need incremental updates.
 *
 * @example
 * interface Config { api: { url: string; timeout: number; }; ui: { theme: string; }; }
 * function updateConfig(partial: DeepOptional<Config>): void
 * updateConfig({ api: { timeout: 5000 } }); // Only timeout is required
 */
export type DeepOptional<T> = {
    [K in keyof T]?: T[K] extends object ? DeepOptional<T[K]> : T[K]
};

/**
 * Makes all properties in an object nullable.
 *
 * Essential for database result types and API responses where fields
 * can legitimately be null due to LEFT JOINs or missing data.
 *
 * @example
 * interface User { id: string; email: string; profile: Profile; }
 * type DatabaseUser = NullableObject<User>; // All fields can be null
 */
export type NullableObject<T> = {
    [K in keyof T]: T[K] | null
};

/**
 * Generates all possible dot-notation paths for an object type.
 *
 * Essential for autocomplete in configuration systems, form builders,
 * and any API that accepts property paths as strings.
 *
 * @example
 * interface User { profile: { name: string; age: number; }; tags: string[]; }
 * type UserPaths = PathNames<User>; // 'profile' | 'profile.name' | 'profile.age' | 'tags' | 'tags.0'
 */
export type PathNames<T> = T extends object ? { [K in keyof T]:
    `${Exclude<K, symbol>}${"" | `.${
        T[K] extends Set<infer SetValue>
            ? SetValue extends object
                ? `${number}` | `${number}.${PathNames<SetValue>}`  // "set.0.subtype"
                : `${number}`                                       // "set.0"
            : T[K] extends Map<infer MapKey, infer MapValue>
                ? MapValue extends object
                    ? MapKey extends string | number
                        ? `${MapKey}` | `${MapKey}.${PathNames<MapValue>}`  // "map.key.subtype"
                        : string | `${string}.${PathNames<MapValue>}`       // "map.string.subtype" (fallback)
                    : MapKey extends string | number
                        ? `${MapKey}`                                       // "map.key"
                        : string                                            // "map.string"
                : T[K] extends any[]
                    ? T[K] extends (infer U)[]
                        ? U extends object
                            ? `${number}` | `${number}.${PathNames<U>}`
                            : `${number}`
                        : `${number}`
                    : PathNames<T[K]>
    }`}`
}[keyof T] : never

/**
 * Generates only the leaf paths (final values) for an object type.
 *
 * Useful for validation systems and data mapping where you only care
 * about paths that lead to actual values, not intermediate objects.
 *
 * @example
 * interface User { profile: { name: string; age: number; }; }
 * type UserLeaves = PathLeaves<User>; // 'profile.name' | 'profile.age'
 */
export type PathLeaves<T> = T extends object ? { [K in keyof T]:
    `${Exclude<K, symbol>}${PathLeaves<T[K]> extends never ? "" : `.${PathLeaves<T[K]>}`}`
}[keyof T] : never

/**
 * Extracts the value type at a specific string path.
 *
 * Enables type-safe deep property access with compile-time validation
 * of both path validity and return type correctness. Supports:
 * - Regular object property access
 * - Array/tuple index access
 * - Map key access
 * - Set index access
 *
 * @example
 * interface User {
 *   profile: { name: string; age: number; };
 *   tags: Set<string>;
 *   metadata: Map<string, { value: string }>;
 * }
 * type UserName = PathValue<User, 'profile.name'>; // string
 * type Tag = PathValue<User, 'tags.0'>; // string
 * type MetaValue = PathValue<User, 'metadata.someKey.value'>; // string
 */
export type PathValue<T, P extends string> =
    P extends `${infer Key}.${infer Rest}`
        ? Key extends keyof T
            ? PathValue<T[Key], Rest>
            : T extends Map<infer K, infer V>
                ? K extends string | number
                    ? Key extends `${K}`
                        ? PathValue<V, Rest>
                        : never
                    : PathValue<V, Rest>
                : T extends Set<infer V>
                    ? Key extends `${number}`
                        ? PathValue<V, Rest>
                        : never
                    : T extends any[]
                        ? Key extends `${number}`
                            ? T extends (infer U)[]
                                ? PathValue<U, Rest>
                                : never
                            : never
                        : never
        : P extends keyof T
            ? T[P]
            : T extends Map<infer K, infer V>
                ? K extends string | number
                    ? P extends `${K}`
                        ? V
                        : never
                    : V
                : T extends Set<infer V>
                    ? P extends `${number}`
                        ? V
                        : never
                    : T extends any[]
                        ? P extends `${number}`
                            ? T extends (infer U)[]
                                ? U
                                : never
                            : never
                        : never;

/**
 * Union of string and number types.
 *
 * Commonly used for object keys, array indices, and ID types that
 * can be either string or numeric.
 *
 * @example
 * function getItem<T>(collection: Record<StrOrNum, T>, key: StrOrNum): T | undefined
 */
export type StrOrNum = string | number

/**
 * Represents either a single item or an array of items.
 *
 * Essential for flexible APIs that accept both individual items and
 * collections, reducing the need for separate method overloads.
 *
 * @example
 * function addClass(elements: OneOrMany<Element>, className: string): void
 * addClass(document.body, 'active'); // single element
 * addClass([el1, el2], 'active'); // multiple elements
 */
export type OneOrMany<T> = T | T[];

/**
 * Object with string keys and string values.
 *
 * Standard type for configuration objects, HTTP headers, query parameters,
 * and any key-value mapping that should be serializable.
 *
 * @example
 * function buildQueryString(params: StringProps): string
 * function setAttributes(element: Element, attrs: StringProps): void
 */
export interface StringProps { [key: string]: string };

/**
 * Object with string keys and boolean values.
 *
 * Perfect for feature flags, permission sets, validation results,
 * and any boolean configuration mapping.
 *
 * @example
 * function checkPermissions(user: User): BoolProps // { canRead: true, canWrite: false }
 * function validateForm(data: FormData): BoolProps // { emailValid: true, nameValid: false }
 */
export interface BoolProps { [key: string]: boolean };

/**
 * Represents a value that can be either synchronous or asynchronous.
 *
 * Critical for utility functions that need to handle both sync and async
 * operations uniformly, enabling flexible API design.
 *
 * @example
 * function processData<T>(processor: () => MaybePromise<T>): Promise<T>
 * function transform<T, U>(value: T, transformer: (val: T) => MaybePromise<U>): Promise<U>
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Filters out undefined from a union type.
 *
 * Essential for type narrowing operations and ensuring required values
 * in contexts where undefined is not acceptable.
 *
 * @example
 * function requireValue<T>(value: T | undefined): NotUndefined<T>
 * type RequiredFields<T> = { [K in keyof T]: NotUndefined<T[K]> }
 */
export type NotUndefined<T> = T extends undefined ? never : T;

/**
 * Union of all JavaScript falsy values.
 *
 * Comprehensive type for conditional logic, validation functions,
 * and type guards that need to handle all falsy cases.
 *
 * @example
 * function isFalsy(value: unknown): value is Falsy
 * function removeEmpty<T>(arr: (T | Falsy)[]): T[]
 */
export type Falsy = number | false | "" | bigint | null | undefined;

/**
 * Filters out falsy values from a type.
 *
 * Enables type-safe operations on values that are guaranteed to be
 * truthy, eliminating the need for runtime falsy checks.
 *
 * @example
 * function assertTruthy<T>(value: T): asserts value is Truthy<T>
 * function compact<T>(arr: T[]): Truthy<T>[]
 */
export type Truthy<T> = T extends Falsy ? never : T;
