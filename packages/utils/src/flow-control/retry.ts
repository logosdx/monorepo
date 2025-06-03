import { attempt } from './attempt.ts';
import { wait } from '../misc.ts';
import { AnyFunc } from './_helpers.ts';


/**
 * Retries a function until it succeeds or the number of retries is reached.
 * @param fn function to retry
 * @param opts options
 * @returns
 */
export const retry = async <T extends AnyFunc>(
    fn: T,
    opts: {

        /**
         * Number of retries
         *
         * @default 3
         */
        retries: number,

        /**
         * Delay between retries
         *
         * @default 0
         */
        delay?: number,

        /**
         * Multiplier for the delay between retries
         *
         * @default 1
         */
        backoff?: number,

        /**
         * Function to determine if the function should be retried
         *
         * @param error error to check
         * @returns true if the function should be retried
         */
        shouldRetry?: (error: Error) => boolean
    }
) => {

    const {
        delay = 0,
        retries = 3,
        backoff = 1,
        shouldRetry = () => true
    } = opts;

    let attempts = 0;

    while (attempts < retries) {

        const [result, error] = await attempt(fn);

        if (result) {
            return result;
        }

        if (error && shouldRetry(error)) {

            await wait(delay * backoff);
            attempts++;

            continue;
        }

        throw error;
    }

    throw new Error('Max retries reached');
}