import { attempt } from './attempt.ts';
import { AnyFunc } from './_helpers.ts';
import { chunk } from '../misc.ts';
import { MaybePromise } from '../types.ts';

type OnChunkParam<T extends AnyFunc> = {
    index: number;
    total: number;
    items: Parameters<T>[];
    processedCount: number;
    remainingCount: number;
    completionPercent: number;
};

type BatchOptions<T extends AnyFunc> = {
    items: Parameters<T>[];
    concurrency?: number;
    failureMode?: 'abort' | 'continue';
    onError?: (error: Error, args: Parameters<T>) => MaybePromise<void>;
    onStart?: (total: number) => MaybePromise<void>;
    onEnd?: (results: BatchResult<T>[]) => MaybePromise<void>;
    onChunkStart?: (params: OnChunkParam<T>) => MaybePromise<void>;
    onChunkEnd?: (params: OnChunkParam<T>) => MaybePromise<void>;
};

type BatchResult<T extends AnyFunc> = {
    result: Awaited<ReturnType<T>> | null;
    error: Error | null;
};

/**
 * Processes items in batches with configurable concurrency and error handling.
 *
 * Provides progress tracking through lifecycle callbacks and supports
 * different failure modes for robust batch processing.
 *
 * @example
 *
 * const items = [[1], [2], [3], [4], [5]]; // Array of argument arrays
 *
 * const handleOneItem = async (item: number) => {
 *     console.log(item);
 * };
 *
 * await batch(handleOneItem, {
 *     concurrency: 10,
 *     items,
 *     failureMode: 'continue',
 *     onError: (error, args) => {
 *         console.error(error, args);
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
export const batch = async <T extends AnyFunc>(
    fn: T,
    options: BatchOptions<T>
): Promise<BatchResult<T>[]> => {

    const results: BatchResult<T>[] = [];

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

    if (typeof fn !== 'function') {

        throw new Error('fn must be a function');
    }

    if (concurrency < 1) {

        throw new Error('concurrency must be greater than 0');
    }

    if (!Array.isArray(items)) {

        throw new Error('items must be an array');
    }

    if (failureMode !== 'abort' && failureMode !== 'continue') {

        throw new Error('failureMode must be either "abort" or "continue"');
    }

    if (onError && typeof onError !== 'function') {

        throw new Error('onError must be a function');
    }

    if (onStart && typeof onStart !== 'function') {

        throw new Error('onStart must be a function');
    }

    if (onChunkStart && typeof onChunkStart !== 'function') {

        throw new Error('onChunkStart must be a function');
    }

    if (onChunkEnd && typeof onChunkEnd !== 'function') {

        throw new Error('onChunkEnd must be a function');
    }

    if (onEnd && typeof onEnd !== 'function') {

        throw new Error('onEnd must be a function');
    }

    const chunks = chunk(items, concurrency);
    const totalChunks = chunks.length;

    const processOne = async (args: Parameters<T>): Promise<BatchResult<T>> => {

        const [result, error] = await attempt(() => fn(...args));

        if (error) {

            onError?.(error, args);

            if (failureMode === 'abort') {

                throw error;
            }
        }

        return {
            result,
            error
        };
    };

    const batchExec = async (argsList: Parameters<T>[]): Promise<void> => {

        const all = await Promise.all(argsList.map(processOne));

        results.push(...all);
    };

    await onStart?.(totalChunks);

    for (let index = 0; index < chunks.length; index++) {

        const chunk = chunks[index];

        await onChunkStart?.({
            index,
            total: totalChunks,
            items: chunk ?? [],
            processedCount: index * concurrency,
            remainingCount: (totalChunks - index - 1) * concurrency,
            completionPercent: ((index + 1) / totalChunks) * 100
        });

        await batchExec(chunk ?? []);

        await onChunkEnd?.({
            index,
            total: totalChunks,
            items: chunk ?? [],
            processedCount: index * concurrency,
            remainingCount: (totalChunks - index - 1) * concurrency,
            completionPercent: ((index + 1) / totalChunks) * 100
        });
    }

    await onEnd?.(results);

    return results;
};
