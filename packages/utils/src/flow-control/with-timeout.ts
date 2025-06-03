import { AnyFunc } from './_helpers.ts';

export class TimeoutError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export const withTimeout = <T extends AnyFunc>(
    fn: T,
    opts: {
        timeout: number
    }
) => {

    return async (...args: Parameters<T>) => {

        let timeoutId: NodeJS.Timeout | null = null;

        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(
                () => reject(
                    new TimeoutError('Function timed out')
                ),
                opts.timeout
            );
        });

        const exec = async () => {

            const result = await fn(...args);

            clearTimeout(timeoutId!);

            return result;
        }

        const result = await Promise.race([
            exec(),
            timeoutPromise
        ]);

        return result;
    }
}
