import { attempt } from './attempt.ts';
import { AnyFunc } from './_helpers.ts';
import { chunk } from '../misc.ts';
import { MaybePromise } from '../types.ts';

type OnChunkParam<T extends AnyFunc> = {
    index: number,
    total: number,
    items: Parameters<T>[]
}

type BatchOptions<T extends AnyFunc> = {
    items: Parameters<T>[],
    chunkSize?: number,
    failureMode?: 'abort' | 'continue',
    onError?: (error: Error, args: Parameters<T>) => MaybePromise<void>
    onStart?: (total: number) => MaybePromise<void>
    onEnd?: (results: BatchResult<T>[]) => MaybePromise<void>
    onChunkStart?: (params: OnChunkParam<T>) => MaybePromise<void>
    onChunkEnd?: (params: OnChunkParam<T>) => MaybePromise<void>
}

type BatchResult<T extends AnyFunc> = {
    result: Awaited<ReturnType<T>> | null
    error: Error | null
}

/**
 * Batch process items in a list.
 *
 * @example
 *
 * const items = [[1], [2], [3], [4], [5]]; // Array of argument arrays
 *
 * await batch(fn, {
 *     chunkSize: 10,
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
 *
 */
export const batch = async <T extends AnyFunc>(
    fn: T,
    options: BatchOptions<T>
) => {

    const results: BatchResult<T>[] = [];

    const {
        chunkSize = 10,
        items = [],
        failureMode = 'abort',
        onError,
        onStart,
        onChunkStart,
        onChunkEnd,
        onEnd
    } = options;

    const chunks = chunk(items, chunkSize);
    const totalChunks = chunks.length;

    const processOne = async (args: Parameters<T>) => {

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
    }

    const batchExec = async (argsList: Parameters<T>[]) => {

        const all = await Promise.all(argsList.map(processOne));

        results.push(...all);
    }

    let index = 0;

    await onStart?.(totalChunks);

    while (chunks.length > 0) {

        const chunk = chunks.shift();

        await onChunkStart?.({
            index,
            total: totalChunks,
            items: chunk ?? []
        });

        await batchExec(chunk ?? []);

        await onChunkEnd?.({
            index,
            total: totalChunks,
            items: chunk ?? []
        });

        index++;
    }

    await onEnd?.(results);

    return results;
}
