import { FetchError } from './helpers.ts';

export type _InternalHttpMethods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'PATCH';
export type HttpMethods = _InternalHttpMethods | string;

export type HttpMethodOpts<T> = Partial<Record<_InternalHttpMethods, T>>;

export type RawRequestOptions = Omit<RequestInit, 'headers'>
export type HeaderObj<T> = Record<string, string> & Partial<T>;
export type MethodHeaders<T> = HttpMethodOpts<HeaderObj<T>>;

export namespace LogosUiFetch {

    export type Type = 'arrayBuffer' | 'blob' | 'formData' | 'json' | 'text';

    /**
     * Override this interface with the headers you intend
     * to use and set throughout your app.
     */
    export interface InstanceHeaders {
        Authorization?: string;
        'Content-Type'?: string;
    };


    export type Headers<T = InstanceHeaders> = HeaderObj<T>;

    export type HeaderKeys = keyof Headers;

    export interface DetermineTypeFn {
        (response: Response): Type;
    }

    export interface FormatHeadersFn {
        (headers: Headers): Headers;
    }

    export type Lifecycle = {
        onError?: (err: FetchError) => void | Promise<void>
        onBeforeReq?: (opts: LogosUiFetch.RequestOpts) => void | Promise<void>
        onAfterReq?: (response: Response, opts: LogosUiFetch.RequestOpts) => void | Promise<void>
    };


    export type RequestOpts<T = InstanceHeaders> = RawRequestOptions & {
        controller: AbortController,
        headers?: Headers<T>,
        timeout?: number
        determineType?: DetermineTypeFn,
        formatHeaders?: boolean | 'lowercase' | 'uppercase' | FormatHeadersFn
    };

    export type Options<
        H = Headers,
        S = {},
    > = (

        Omit<
            RequestOpts<H>,
            'method' | 'body' | 'integrity' | 'controller'
        > &

        {
            /**
             * The base URL for all requests
             */
            baseUrl: string,

            /**
             * The default type of response expected from the server.
             * This will be used to determine how to parse the
             * response from the server when content-type headers
             * are not present or fail to do so.
             */
            defaultType?: Type,

            /**
             * The headers to be set on all requests
             */
            headers?: HeaderObj<H>,

            /**
             * The headers to be set on requests of a specific method
             * @example
             * {
             *     GET: { 'content-type': 'application/json' },
             *     POST: { 'content-type': 'application/x-www-form-urlencoded'
             * }
             */
            methodHeaders?: MethodHeaders<H>,

            // Applies to requests of a specific method
            /**
             *
             * @param opts
             * @param state
             * @returns
             */
            modifyOptions?: (opts: RequestOpts<H>, state: S) => RequestOpts<H>
            modifyMethodOptions?: HttpMethodOpts<
                Options<
                    H,
                    S
                >['modifyOptions']
            >,

            timeout?: number,
            validate?: {
                headers?: (headers: Headers<H>, method?: _InternalHttpMethods) => void
                state?: (state: S) => void

                perRequest?: {
                    headers?: boolean
                }
            },

            determineType?: DetermineTypeFn,

            formatHeaders?: false | 'lowercase' | 'uppercase' | FormatHeadersFn
        }
    );

    export interface AbortablePromise<T> extends Promise<T> {

        isFinished: boolean
        isAborted: boolean
        abort(reason?: string): void
    }

    export type CallOptions<H = InstanceHeaders> = (
        Lifecycle &
        Omit<RequestOpts, 'body' | 'method' | 'controller'> &
        { headers?: HeaderObj<H>}
    );

}
