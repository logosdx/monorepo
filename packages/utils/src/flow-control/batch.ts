import {
    attempt,
    chunk,
    MaybePromise,
    Func, AsyncFunc,
    isFunction,
    assert,
    assertOptional
} from '../index.ts';

type BatchFunction<A extends unknown[] = unknown[], R = unknown> = (
    AsyncFunc<A, R> |
    Func<A, R>
);

type OnChunkParam<T> = {
    index: number;
    total: number;
    items: T[];
    processedCount: number;
    remainingCount: number;
    completionPercent: number;
};

type BatchOptions<T, R> = {
    items: T[];
    concurrency?: number;
    failureMode?: 'abort' | 'continue';
    onError?: (error: Error, item: T, itemIndex: number) => MaybePromise<void>;
    onStart?: (total: number) => MaybePromise<void>;
    onEnd?: (results: BatchResult<T, R>[]) => MaybePromise<void>;
    onChunkStart?: (params: OnChunkParam<T>) => MaybePromise<void>;
    onChunkEnd?: (params: OnChunkParam<T>) => MaybePromise<void>;
};

type BatchResult<T, R> = {
    result: R | null;
    error: Error | null;
    item: T;
    index: number;
    itemIndex: number;
};

/**
 * Processes items in batches with configurable concurrency and error handling.
 *
 * Provides progress tracking through lifecycle callbacks and supports
 * different failure modes for robust batch processing.
 *
 * @example
 *
 * const items = [1, 2, 3, 4, 5]; // Array of arguments
 *
 * const handleOneItem = async (item: number) => {
 *     console.log(item);
 * };
 *
 * await batch(handleOneItem, {
 *     concurrency: 10,
 *     items,
 *     failureMode: 'continue',
 *     onError: (error, item) => {
 *         console.error(error, item);
 *     },
 *     onStart: (total) => {
 *         console.log(`Starting batch with ${total} chunks`);
 *     },
 *     onEnd: (results) => {
 *         console.log(`Batch completed with ${results.length} results`);
 *     },
 *     onChunkStart: ({ index, total, items }) => {
 *         console.log(`Starting chunk ${index + 1}/${total}`);
 *     },
 *     onChunkEnd: ({ index, total, items }) => {
 *         console.log(`Finished chunk ${index + 1}/${total}`);
 *     }
 * });
 */
export const batch = async <T, R>(
    fn: BatchFunction<[T], R>,
    options: BatchOptions<T, R>
): Promise<BatchResult<T, R>[]> => {

    const results: BatchResult<T, R>[] = [];

    const {
        items,
        concurrency = 10,
        failureMode = 'abort',
        onError,
        onStart,
        onChunkStart,
        onChunkEnd,
        onEnd
    } = options;

    assert(isFunction(fn), 'fn must be a function');
    assert(Array.isArray(items), 'items must be an array');
    assert(concurrency > 0, 'concurrency must be greater than 0');
    assert(failureMode === 'abort' || failureMode === 'continue', 'failureMode must be either "abort" or "continue"');

    assertOptional(onError, isFunction(onError), 'onError must be a function');
    assertOptional(onStart, isFunction(onStart), 'onStart must be a function');
    assertOptional(onChunkStart, isFunction(onChunkStart), 'onChunkStart must be a function');
    assertOptional(onChunkEnd, isFunction(onChunkEnd), 'onChunkEnd must be a function');
    assertOptional(onEnd, isFunction(onEnd), 'onEnd must be a function');

    const chunks = chunk(items, concurrency);
    const totalChunks = chunks.length;
    let chunkIndex = 0;

    const processOne = async (item: T, itemIndex: number): Promise<BatchResult<T, R>> => {

        const [result, error] = await attempt(() => fn(item) as Promise<R>);

        if (error) {

            onError?.(error, item, itemIndex);

            if (failureMode === 'abort') {

                throw error;
            }
        }

        return {
            result,
            error,
            item,
            index: chunkIndex,
            itemIndex
        };
    };

    const batchExec = async (argsList: T[]): Promise<void> => {

        const all = await Promise.all(argsList.map(processOne));

        results.push(...all);
    };

    await onStart?.(totalChunks);

    for (chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {

        const chunk = chunks[chunkIndex];

        await onChunkStart?.({
            index: chunkIndex,
            total: totalChunks,
            items: chunk ?? [],
            processedCount: chunkIndex * concurrency,
            remainingCount: (totalChunks - chunkIndex - 1) * concurrency,
            completionPercent: ((chunkIndex + 1) / totalChunks) * 100
        });

        await batchExec(chunk ?? []);

        await onChunkEnd?.({
            index: chunkIndex,
            total: totalChunks,
            items: chunk ?? [],
            processedCount: chunkIndex * concurrency,
            remainingCount: (totalChunks - chunkIndex - 1) * concurrency,
            completionPercent: ((chunkIndex + 1) / totalChunks) * 100
        });
    }

    await onEnd?.(results);

    return results;
};
