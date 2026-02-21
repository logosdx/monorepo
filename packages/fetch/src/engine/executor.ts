import {
    attempt,
    wait,
    assert,
    generateId,
} from '@logosdx/utils';

import type {
    HttpMethods,
    _InternalHttpMethods,
    FetchResponse,
    RetryConfig,
    DictAndT,
    FetchConfig,
} from '../types.ts';

import type { EngineRequestConfig, CallConfig } from '../options/types.ts';

import { FetchError, DEFAULT_RETRY_CONFIG } from '../helpers/index.ts';

import type { FetchEngineCore, InternalReqOptions } from './types.ts';

import { FetchPromise } from './fetch-promise.ts';
import type { ResponseDirective } from './fetch-promise.ts';

import { HookScope } from '@logosdx/hooks';

/**
 * Handles request execution with the hook-based pipeline.
 *
 * The RequestExecutor builds normalized request options and runs them
 * through the 3-phase pipeline:
 * 1. `beforeRequest` (run) - plugins can modify args or short-circuit
 * 2. `execute` (pipe) - onion-wrapped execution (retry, dedupe, etc.)
 * 3. `afterRequest` (run) - plugins can modify or cache the response
 *
 * @template S - Instance state type
 * @template H - Headers type
 * @template P - Params type
 */
export class RequestExecutor<
    H = unknown,
    P = unknown,
    S = unknown
> {

    /** Reference to the FetchEngine instance */
    engine: FetchEngineCore<H, P, S>;

    constructor(engine: FetchEngineCore<H, P, S>) {

        this.engine = engine;
    }

    /**
     * Get retry configuration from engine options.
     */
    get retryConfig(): Required<RetryConfig> {

        const config = this.engine.config.get('retry');

        if (config === false) {

            return { ...DEFAULT_RETRY_CONFIG, maxAttempts: 0 };
        }

        if (!config || config === true) {

            return DEFAULT_RETRY_CONFIG;
        }

        return { ...DEFAULT_RETRY_CONFIG, ...(config as RetryConfig) } as Required<RetryConfig>;
    }

    /**
     * Get base URL from engine options.
     */
    get baseUrl(): string {

        return this.engine.config.get('baseUrl');
    }

    /**
     * Get default type from engine options.
     */
    get defaultType(): 'json' | 'text' | 'blob' | 'arrayBuffer' {

        return (this.engine.config.get('defaultType') as string || 'json') as 'json' | 'text' | 'blob' | 'arrayBuffer';
    }

    // =====================================================================
    // PUBLIC API - Entry points for FetchEngine HTTP methods
    // =====================================================================

    /**
     * Execute a request with the full lifecycle: timeout, options building, pipeline.
     *
     * This is the main entry point called by FetchEngine HTTP methods.
     */
    execute<Res = unknown, Data = unknown, ResHdr = unknown>(
        method: HttpMethods,
        path: string,
        payloadOrOptions?: Data | CallConfig<H, P>,
        options?: CallConfig<H, P>
    ): FetchPromise<Res, DictAndT<H>, DictAndT<P>, ResHdr> {

        let payload: Data | undefined;
        let opts: CallConfig<H, P>;

        if (options !== undefined) {

            payload = payloadOrOptions as Data;
            opts = options;
        }
        else if (payloadOrOptions && typeof payloadOrOptions === 'object' && !Array.isArray(payloadOrOptions)) {

            const hasCallOptionKeys = 'headers' in payloadOrOptions ||
                'params' in payloadOrOptions ||
                'timeout' in payloadOrOptions ||
                'retry' in payloadOrOptions ||
                'abortController' in payloadOrOptions ||
                'onError' in payloadOrOptions ||
                'onBeforeReq' in payloadOrOptions ||
                'onAfterReq' in payloadOrOptions;

            if (hasCallOptionKeys && !/POST|PUT|PATCH|DELETE/i.test(method)) {

                opts = payloadOrOptions as CallConfig<H, P>;
            }
            else {

                payload = payloadOrOptions as Data;
                opts = {};
            }
        }
        else {

            payload = payloadOrOptions as Data;
            opts = {};
        }

        const controller = opts.abortController ?? new AbortController();

        const totalTimeoutMs = opts.totalTimeout ?? opts.timeout ?? this.engine.config.get('totalTimeout');
        const attemptTimeoutMs = opts.attemptTimeout ?? this.engine.config.get('attemptTimeout');

        if (typeof totalTimeoutMs === 'number') {

            assert(totalTimeoutMs >= 0, 'totalTimeout must be non-negative number');
        }

        if (typeof attemptTimeoutMs === 'number') {

            assert(attemptTimeoutMs >= 0, 'attemptTimeout must be non-negative number');
        }

        let totalTimeoutFired = false;

        const totalTimeout = typeof totalTimeoutMs === 'number' ? wait(totalTimeoutMs) : undefined;

        totalTimeout?.then(() => {

            totalTimeoutFired = true;
            controller.abort();
        });

        const fetchPromise: FetchPromise<Res, DictAndT<H>, DictAndT<P>, ResHdr> = FetchPromise.create<Res, DictAndT<H>, DictAndT<P>, ResHdr>(
            (): Promise<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>> => this.#executeWithOptions<Res, ResHdr>(
                method,
                path,
                payload,
                opts,
                controller,
                totalTimeout,
                attemptTimeoutMs,
                () => totalTimeoutFired,
                () => fetchPromise.directive
            ),
            controller
        );

        return fetchPromise;
    }

    /**
     * Internal method that builds options and executes the request.
     */
    async #executeWithOptions<Res, ResHdr>(
        method: HttpMethods,
        path: string,
        payload: unknown,
        options: CallConfig<H, P>,
        controller: AbortController,
        totalTimeout: ReturnType<typeof wait> | undefined,
        attemptTimeoutMs: number | undefined,
        getTotalTimeoutFired: () => boolean,
        getDirective?: () => ResponseDirective | undefined
    ): Promise<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>> {

        const onAfterReq = (...args: any[]) => {

            totalTimeout?.clear();
            options.onAfterReq?.apply(this, args as never);
        };

        const onError = (...args: any[]) => {

            totalTimeout?.clear();
            options.onError?.apply(this, args as never);
        };

        const normalizedOpts = this.makeRequestOptions(
            method,
            path,
            {
                ...options,
                payload,
                controller,
                onAfterReq,
                onError,
                attemptTimeout: attemptTimeoutMs,
                getTotalTimeoutFired
            }
        );

        normalizedOpts.getDirective = getDirective;

        return this.executeRequest<Res, ResHdr>(normalizedOpts, totalTimeout);
    }

    /**
     * Build normalized request options from method/path/options.
     */
    makeRequestOptions(
        _method: HttpMethods,
        path: string,
        options: CallConfig<H, P> & {
            payload?: unknown;
            controller: AbortController;
            attemptTimeout?: number | undefined;
            getTotalTimeoutFired?: (() => boolean) | undefined;
        }
    ): InternalReqOptions<H, P, S> {

        const {
            payload,
            controller,
            onAfterReq: onAfterRequest,
            onBeforeReq: onBeforeRequest,
            onError,
            timeout = this.engine.config.get('totalTimeout') as number | undefined,
            attemptTimeout,
            getTotalTimeoutFired,
            params: requestParams,
            signal,
            determineType,
            retry,
            requestId: perRequestId,
            headers: requestHeaders,
            ...perRequestInit
        } = options;

        const method = _method.toUpperCase() as _InternalHttpMethods;
        const state = this.engine.state.get();

        const url = this.#makeUrl(path, requestParams, method);

        let headers = this.engine.headerStore.resolve(method, requestHeaders) as DictAndT<H>;

        let body: BodyInit | undefined;
        const type = this.defaultType;

        if (/put|post|patch|delete/i.test(method)) {

            const isValidBodyInit = (
                payload === null ||
                payload === undefined ||
                typeof payload === 'string' ||
                payload instanceof Blob ||
                payload instanceof ArrayBuffer ||
                payload instanceof FormData ||
                payload instanceof URLSearchParams ||
                payload instanceof ReadableStream ||
                ArrayBuffer.isView(payload)
            );

            if (type === 'json' && !isValidBodyInit) {

                body = JSON.stringify(payload);
            }
            else if (payload !== null && payload !== undefined) {

                body = payload as BodyInit;
            }
        }

        const config = this.engine.config.get();

        let opts: EngineRequestConfig<H, P> = {
            ...config,
            ...perRequestInit,
            method,
            signal: signal || controller.signal,
            controller,
            headers,
            body: body ?? null,
            totalTimeout: timeout,
            retry,
        };

        const validate = this.engine.config.get('validate');

        if (validate?.perRequest?.headers && validate.headers) {

            validate.headers(headers, method);
        }

        const normalizedRetry = opts.retry === true
            ? {}
            : (opts.retry === false ? { maxAttempts: 0 } : opts.retry);

        const generateRequestId = this.engine.config.get('generateRequestId');
        const requestId = perRequestId || (generateRequestId ? generateRequestId() : generateId());

        const requestIdHeader = this.engine.config.get('requestIdHeader');

        if (requestIdHeader) {

            headers = { ...headers, [requestIdHeader]: requestId } as DictAndT<H>;
        }

        return {
            ...opts,
            requestId,
            method,
            path,
            payload,
            headers,
            params: Object.fromEntries(url.searchParams.entries()) as DictAndT<P>,
            state,
            url,
            signal: opts.signal || controller.signal,
            controller,
            body,
            timeout: opts.totalTimeout,
            attemptTimeout,
            getTotalTimeoutFired,
            retry: normalizedRetry,
            determineType: determineType as InternalReqOptions<H, P, S>['determineType'],
            onBeforeRequest: onBeforeRequest as InternalReqOptions<H, P, S>['onBeforeRequest'],
            onAfterRequest: onAfterRequest as InternalReqOptions<H, P, S>['onAfterRequest'],
            onError: onError as InternalReqOptions<H, P, S>['onError'],
        };
    }

    /**
     * Build URL from path and params.
     */
    #makeUrl(path: string, requestParams?: DictAndT<P>, method?: HttpMethods): URL {

        const params = this.engine.paramStore.resolve(
            method || 'GET',
            requestParams
        ) as DictAndT<P>;

        if (path.startsWith('http')) {

            const url = new URL(path);

            Object.entries(params).forEach(([key, value]) => {

                url.searchParams.set(key, value as string);
            });

            return url;
        }

        path = path?.replace(/^\/{1,}/, '');

        if (path[0] !== '/') {

            path = `/${path}`;
        }

        const baseUrl = this.baseUrl.replace(/\/$/, '');
        const url = new URL(baseUrl + path);

        for (const [key, value] of Object.entries(params)) {

            url.searchParams.set(key, value as string);
        }

        const validate = this.engine.config.get('validate');

        if (validate?.perRequest?.params && validate.params) {

            validate.params(
                Object.fromEntries(url.searchParams.entries()) as DictAndT<P>,
                method as _InternalHttpMethods | undefined
            );
        }

        return url;
    }

    // =====================================================================
    // INTERNAL METHODS
    // =====================================================================

    /**
     * Determine response type based on content-type header.
     */
    determineType(response: Response): { type: 'json' | 'text' | 'blob' | 'arrayBuffer'; isJson: boolean; isRecognized: boolean } {

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {

            return { type: 'json', isJson: true, isRecognized: true };
        }

        if (contentType.includes('text/')) {

            return { type: 'text', isJson: false, isRecognized: true };
        }

        return { type: this.defaultType, isJson: false, isRecognized: false };
    }

    /**
     * Handle errors with proper event emission and error formatting.
     */
    #handleError(
        normalizedOpts: InternalReqOptions<H, P, S>,
        errorOpts: {
            error: FetchError | Error,
            step: 'fetch' | 'parse' | 'response',
            status?: number,
            data?: unknown
        }
    ) {

        const {
            method,
            path,
            headers,
            controller,
            onError,
            attempt: attemptNum
        } = normalizedOpts;

        const {
            error,
            step,
            status,
            data
        } = errorOpts;

        const aborted = controller.signal.aborted;

        let err = error as FetchError<{}, DictAndT<H>>;

        if (step === 'fetch') {

            err = new FetchError(err.message) as FetchError<{}, DictAndT<H>>;

            err.status = 499;
            err.message = err.message || 'Fetch error';
        }

        if (step === 'parse') {

            err = new FetchError(err.message) as FetchError<{}, DictAndT<H>>;

            err.status = status || 999;
            err.message = err.message || 'Parse error';
        }

        if (step === 'response') {

            const asAgg = error as AggregateError;
            let errors = asAgg.errors as Error[];
            let errCode = '';

            if (
                !errors ||
                errors.length === 0 &&
                error.cause instanceof AggregateError
            ) {

                errors = (error.cause as AggregateError)?.errors as Error[];
            }

            if ((error as any)?.code) {
                errCode = (error as any).code;
            }

            if (errors && errors.length > 0) {

                const msgs = errors.map((e) => e.message).join('; ');

                err = new FetchError(`${errCode}: ${msgs}`) as FetchError<{}, DictAndT<H>>;
            }
            else {

                err = new FetchError(error.message) as FetchError<{}, DictAndT<H>>;
            }
        }

        err.requestId = normalizedOpts.requestId;
        err.attempt = attemptNum;
        err.status = err.status || status!;
        err.method = err.method || method!;
        err.path = err.path || path!;
        err.aborted = err.aborted || aborted;
        err.data = err.data || data as null;
        err.step = err.step || step;
        err.headers = err.headers || headers;

        const eventData = {
            ...normalizedOpts,
            error: err,
            step,
            status,
            aborted,
            data,
            requestEnd: Date.now()
        };

        if (aborted) {

            this.engine.emit('abort', eventData);
        }
        else {

            this.engine.emit('error', eventData);
        }

        onError && onError(err);

        throw err;
    }

    /**
     * Makes an API call using fetch and returns enhanced response object.
     */
    async makeCall<Res, ResHdr = unknown>(
        options: InternalReqOptions<H, P, S>
    ): Promise<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>> {

        const {
            method,
            headers: reqHeaders,
            params,
            url,
            signal,
            controller,
            body,
            timeout,
            retry,
            determineType,
            onBeforeRequest,
            onAfterRequest,
            ...requestInit
        } = options;

        this.engine.emit('before-request', options);

        const callbackOpts = {
            method,
            signal,
            controller,
            headers: reqHeaders,
            body: body ?? null,
            timeout,
            retry,
            determineType
        };

        onBeforeRequest && await onBeforeRequest(callbackOpts);

        const fetchOpts: RequestInit = {
            ...requestInit,
            method,
            signal,
            headers: reqHeaders as HeadersInit,
            body: body ?? null,
        };

        const [response, resErr] = await attempt(async () => {

            return await fetch(url, fetchOpts) as Response;
        });

        if (resErr) {

            this.#handleError(options, {
                error: resErr,
                step: 'fetch'
            });

            throw resErr;
        }

        this.engine.emit('after-request', {
            ...options,
            response: (
                this.engine.$has('after-request') ?
                response.clone() :
                response
            ),
        });

        onAfterRequest && await onAfterRequest(response.clone(), callbackOpts);

        const directive = options.getDirective?.();

        if (directive === 'stream' || directive === 'raw') {


            const responseHeaders = {} as Partial<ResHdr>;

            response.headers.forEach((value, key) => {

                responseHeaders[key as keyof ResHdr] = value as ResHdr[keyof ResHdr];
            });

            this.engine.emit('response', {
                ...options,
                response,
                data: response,
                status: response.status,
                requestEnd: Date.now()
            });

            const config: FetchConfig<DictAndT<H>, DictAndT<P>> = {
                baseUrl: this.baseUrl.toString(),
                attemptTimeout: options.attemptTimeout,
                method,
                headers: reqHeaders,
                params,
                retry: this.retryConfig,
                determineType,
            };

            return {
                data: response as unknown as Res,
                headers: responseHeaders,
                status: response.status,
                request: new Request(url, fetchOpts),
                config
            };
        }

        if (directive && directive !== 'json') {

            const [data, parseErr] = await attempt(async () => {

                if (response.status === 204) {

                    return null;
                }

                return await response[directive]() as Res;
            });

            if (parseErr) {

                this.#handleError(options, {
                    error: parseErr,
                    step: 'parse',
                    status: response.status,
                    data
                });

                throw parseErr;
            }

            if (response.ok === false) {

                this.#handleError(options, {
                    error: new FetchError(response.statusText),
                    step: 'response',
                    status: response.status,
                    data
                });

                throw new FetchError(response.statusText);
            }

            this.engine.emit('response', {
                ...options,
                response,
                data,
                requestEnd: Date.now()
            });

            const config: FetchConfig<DictAndT<H>, DictAndT<P>> = {
                baseUrl: this.baseUrl.toString(),
                attemptTimeout: options.attemptTimeout,
                method,
                headers: reqHeaders,
                params,
                retry: this.retryConfig,
                determineType,
            };

            const responseHeaders = {} as Partial<ResHdr>;

            response.headers.forEach((value, key) => {

                responseHeaders[key as keyof ResHdr] = value as ResHdr[keyof ResHdr];
            });

            return {
                data: data!,
                headers: responseHeaders,
                status: response.status,
                request: new Request(url, fetchOpts),
                config
            };
        }

        const [data, parseErr] = await attempt(async () => {

            const typeResult = determineType
                ? determineType(response)
                : this.determineType(response);

            const { type, isJson } = typeResult;

            const isRecognized = 'isRecognized' in typeResult ? (typeResult as any).isRecognized : true;

            if (response.status === 204) {

                return null;
            }

            if (isJson) {

                const text = await response.text();

                if (text) {

                    return JSON.parse(text) as Res;
                }

                return null;
            }
            else if (isRecognized) {

                return await response[type]() as Res;
            }
            else {

                const text = await response.text();

                if (text) {

                    if (type === 'json') {

                        return JSON.parse(text) as Res;
                    }

                    return text as Res;
                }

                throw new Error(`Unknown content-type: ${response.headers.get('content-type')}`);
            }
        });

        if (parseErr) {

            this.#handleError(options, {
                error: parseErr,
                step: 'parse',
                status: response.status,
                data
            });

            throw parseErr;
        }

        if (response.ok === false) {

            this.#handleError(options, {
                error: new FetchError(response.statusText),
                step: 'response',
                status: response.status,
                data
            });

            throw new FetchError(response.statusText);
        }

        this.engine.emit('response', {
            ...options,
            response,
            data,
            requestEnd: Date.now()
        });

        const config: FetchConfig<DictAndT<H>, DictAndT<P>> = {
            baseUrl: this.baseUrl.toString(),
            attemptTimeout: options.attemptTimeout,
            method,
            headers: reqHeaders,
            params: params,
            retry: this.retryConfig,
            determineType: determineType,
        };

        const request = new Request(url, fetchOpts);

        const responseHeaders = {} as Partial<ResHdr>;

        response.headers.forEach((value, key) => {

            responseHeaders[key as keyof ResHdr] = value as ResHdr[keyof ResHdr];
        });

        return {
            data: data!,
            headers: responseHeaders,
            status: response.status,
            request,
            config
        };
    }

    /**
     * Executes a request through the 3-phase hook pipeline.
     *
     * 1. beforeRequest (run) - plugins can modify args or short-circuit with cached response
     * 2. execute (pipe) - onion-wrapped execution (retry wraps dedupe wraps makeCall)
     * 3. afterRequest (run) - plugins can modify response or store in cache
     */
    async executeRequest<Res, ResHdr = unknown>(
        normalizedOpts: InternalReqOptions<H, P, S>,
        totalTimeout: ReturnType<typeof wait> | undefined
    ): Promise<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>> {

        normalizedOpts.requestStart = Date.now();

        const scope = new HookScope();

        // Phase 1: beforeRequest (run)
        const pre = await this.engine.hooks.run(
            'beforeRequest',
            normalizedOpts.url,
            normalizedOpts as any,
            { scope }
        );

        if (pre.returned) {

            totalTimeout?.clear();
            return pre.result as FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>;
        }

        // Use potentially-modified opts from hooks
        const finalOpts = (pre.args[1] ?? normalizedOpts) as InternalReqOptions<H, P, S>;

        // Phase 2: execute (pipe)
        const response = await this.engine.hooks.pipe<'execute', FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>>(
            'execute',
            () => this.makeCall<Res, ResHdr>(finalOpts),
            finalOpts,
            { scope }
        );

        totalTimeout?.clear();

        // Phase 3: afterRequest (run)
        const post = await this.engine.hooks.run(
            'afterRequest',
            response as any,
            finalOpts.url,
            finalOpts as any,
            { scope }
        );

        if (post.returned) {

            return post.result as FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>;
        }

        return response;
    }
}
