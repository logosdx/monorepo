import type { FetchResponse } from '../types.ts';


/**
 * Directive that determines how the response body is parsed.
 *
 * Controls the response extraction method applied after the fetch resolves,
 * allowing callers to declaratively specify their expected format.
 */
export type ResponseDirective = 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData' | 'raw' | 'stream';


/**
 * A stream-mode FetchPromise that also supports async iteration over chunks.
 *
 * Returned by `.stream()` to signal that the caller wants raw streaming
 * access to the response body as `Uint8Array` chunks.
 */
export interface FetchStreamPromise<H, P, RH>
    extends FetchPromise<Response, H, P, RH>, AsyncIterable<Uint8Array> {}


/**
 * Extended Promise that carries a response directive for the fetch engine.
 *
 * Enables a fluent API where callers declare their expected response type
 * (e.g. `.json()`, `.text()`, `.blob()`) before awaiting. The directive is
 * read by the executor to determine how to parse the response body.
 *
 * An override guard prevents setting the directive more than once, catching
 * accidental double-calls that would silently discard the first directive.
 *
 * @template T - Type of the parsed response data
 * @template H - Type of request headers
 * @template P - Type of request params
 * @template RH - Type of response headers
 *
 * @example
 *     const user = await api.get('/users/1').json();
 *     const html = await api.get('/page').text();
 *     const file = await api.get('/file').blob();
 */
export class FetchPromise<
    T = unknown,
    H = unknown,
    P = unknown,
    RH = unknown
> extends Promise<FetchResponse<T, H, P, RH>> {

    #overrideSet = false;
    #directive: ResponseDirective | undefined;

    /**
     * The active response directive, if any.
     */
    get directive(): ResponseDirective | undefined {

        return this.#directive;
    }

    /**
     * Whether stream mode is active.
     */
    get isStream(): boolean {

        return this.#directive === 'stream';
    }

    /**
     * Guard that throws if a directive has already been set.
     *
     * Prevents silent overrides where a second call would discard
     * the first directive without any indication to the caller.
     */
    #guardOverride(): void {

        if (this.#overrideSet) {

            throw new Error('Response type already set');
        }

        this.#overrideSet = true;
    }

    /**
     * Parse the response body as JSON.
     */
    json(): FetchPromise<T, H, P, RH> {

        this.#guardOverride();
        this.#directive = 'json';
        return this;
    }

    /**
     * Parse the response body as plain text.
     */
    text(): FetchPromise<string, H, P, RH> {

        this.#guardOverride();
        this.#directive = 'text';
        return this as unknown as FetchPromise<string, H, P, RH>;
    }

    /**
     * Parse the response body as a Blob.
     */
    blob(): FetchPromise<Blob, H, P, RH> {

        this.#guardOverride();
        this.#directive = 'blob';
        return this as unknown as FetchPromise<Blob, H, P, RH>;
    }

    /**
     * Parse the response body as an ArrayBuffer.
     */
    arrayBuffer(): FetchPromise<ArrayBuffer, H, P, RH> {

        this.#guardOverride();
        this.#directive = 'arrayBuffer';
        return this as unknown as FetchPromise<ArrayBuffer, H, P, RH>;
    }

    /**
     * Parse the response body as FormData.
     */
    formData(): FetchPromise<FormData, H, P, RH> {

        this.#guardOverride();
        this.#directive = 'formData';
        return this as unknown as FetchPromise<FormData, H, P, RH>;
    }

    /**
     * Return the raw Response object without parsing.
     */
    raw(): FetchPromise<Response, H, P, RH> {

        this.#guardOverride();
        this.#directive = 'raw';
        return this as unknown as FetchPromise<Response, H, P, RH>;
    }

    /**
     * Enable streaming mode for the response.
     *
     * Returns the raw Response and marks the promise for async iteration
     * over response body chunks.
     */
    stream(): FetchStreamPromise<H, P, RH> {

        this.#guardOverride();
        this.#directive = 'stream';
        return this as unknown as FetchStreamPromise<H, P, RH>;
    }
}
