
/**
 * Returns an array of items, wrapping single items in an array.
 *
 * Normalizes input to always return an array, whether the input
 * was a single item or already an array.
 *
 * @param items single item or array of items
 * @returns array containing the items
 *
 * @example
 * itemsToArray('single') // ['single']
 * itemsToArray(['already', 'array']) // ['already', 'array']
 * itemsToArray(42) // [42]
 * itemsToArray([]) // []
 *
 * @example
 * function processFiles(files: string | string[]) {
 *     const fileArray = itemsToArray(files);
 *
 *     for (const file of fileArray) {
 *         console.log(`Processing: ${file}`);
 *     }
 * }
 *
 * processFiles('single.txt'); // Works with single file
 * processFiles(['file1.txt', 'file2.txt']); // Works with multiple files
 */
export const itemsToArray = <T>(items: T | T[]): T[] => {

    if (!Array.isArray(items)) {

        items = [items];
    }

    return items;
};

/**
 * Returns a single item if array has only one element, otherwise returns the array.
 *
 * Unwraps single-item arrays to the item itself, useful for APIs that
 * can return either single items or collections.
 *
 * @param items array of items
 * @returns single item if array length is 1, otherwise the array
 *
 * @example
 * oneOrMany(['single']) // 'single'
 * oneOrMany(['multiple', 'items']) // ['multiple', 'items']
 * oneOrMany([]) // []
 * oneOrMany([42]) // 42
 *
 * @example
 * function findUsers(query: string): User | User[] {
 *     const results = database.search(query);
 *     return oneOrMany(results); // Return single user or array
 * }
 *
 * const result = findUsers('john');
 * if (Array.isArray(result)) {
 *     console.log(`Found ${result.length} users`);
 * } else {
 *     console.log(`Found user: ${result.name}`);
 * }
 */
export const oneOrMany = <T>(items: T[]): T | T[] => {

    if (items.length === 1) {
        return items[0] as T
    }

    return items;
};

/**
 * Splits an array into smaller arrays of the specified size.
 *
 * Divides a large array into multiple smaller arrays (chunks) of the given size.
 * The last chunk may be smaller if the array length is not evenly divisible.
 *
 * @param array array to split into chunks
 * @param size maximum size of each chunk
 * @returns array of arrays, each containing up to `size` elements
 *
 * @example
 * chunk([1, 2, 3, 4, 5, 6, 7], 3) // [[1, 2, 3], [4, 5, 6], [7]]
 * chunk(['a', 'b', 'c', 'd'], 2) // [['a', 'b'], ['c', 'd']]
 * chunk([1, 2], 5) // [[1, 2]]
 * chunk([], 3) // []
 *
 * @example
 * // Process large datasets in batches
 * async function processBatches(items: any[], batchSize = 10) {
 *     const batches = chunk(items, batchSize);
 *
 *     for (const batch of batches) {
 *         await Promise.all(batch.map(processItem));
 *         console.log(`Processed batch of ${batch.length} items`);
 *     }
 * }
 *
 * @example
 * // Paginate results
 * function paginateResults<T>(results: T[], pageSize = 20) {
 *     const pages = chunk(results, pageSize);
 *     return pages.map((page, index) => ({
 *         page: index + 1,
 *         data: page,
 *         hasNext: index < pages.length - 1
 *     }));
 * }
 */
export const chunk = <T>(array: T[], size: number) => {

    return array.reduce((result, item, index) => {

        const chunkIndex = Math.floor(index / size);

        if (!result[chunkIndex]) {
            result[chunkIndex] = [];
        }

        result[chunkIndex]!.push(item);

        return result;
    }, [] as T[][]);
};
