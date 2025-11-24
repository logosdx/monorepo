import { FetchEngine } from './engine.ts';

export {
    FetchError,
    isFetchError
} from './helpers.ts';

export type {
    FetchResponse,
    FetchConfig
} from './types.ts';

export {
    FetchEngine
} from './engine.ts';

const baseEngine = new FetchEngine({
    baseUrl: globalThis?.location?.origin ?? 'https://logosdx.dev',
});

/** See {@link FetchEngine.request}. */
export const request = baseEngine.request.bind(baseEngine);

/** See {@link FetchEngine.options}. */
export const options = baseEngine.options.bind(baseEngine);

/** See {@link FetchEngine.get}. */
export const get = baseEngine.get.bind(baseEngine);

/** See {@link FetchEngine.delete}. */
export const del = baseEngine.delete.bind(baseEngine);

/** See {@link FetchEngine.post}. */
export const post = baseEngine.post.bind(baseEngine);

/** See {@link FetchEngine.put}. */
export const put = baseEngine.put.bind(baseEngine);

/** See {@link FetchEngine.patch}. */
export const patch = baseEngine.patch.bind(baseEngine);




/** See {@link FetchEngine.removeHeader}. */
export const removeHeader = baseEngine.removeHeader.bind(baseEngine);

/** See {@link FetchEngine.removeParam}. */
export const removeParam = baseEngine.removeParam.bind(baseEngine);



/** See {@link FetchEngine.addHeader}. */
export const addHeader = baseEngine.addHeader.bind(baseEngine);

/** See {@link FetchEngine.addParam}. */
export const addParam = baseEngine.addParam.bind(baseEngine);



/** See {@link FetchEngine.hasHeader}. */
export const hasHeader = baseEngine.hasHeader.bind(baseEngine);

/** See {@link FetchEngine.hasParam}. */
export const hasParam = baseEngine.hasParam.bind(baseEngine);



/** See {@link FetchEngine.setState}. */
export const setState = baseEngine.setState.bind(baseEngine);

/** See {@link FetchEngine.resetState}. */
export const resetState = baseEngine.resetState.bind(baseEngine);



/** See {@link FetchEngine.getState}. */
export const getState = baseEngine.getState.bind(baseEngine);

/** See {@link FetchEngine.changeBaseUrl}. */
export const changeBaseUrl = baseEngine.changeBaseUrl.bind(baseEngine);

/** See {@link FetchEngine.changeModifyOptions}. */
export const changeModifyOptions = baseEngine.changeModifyOptions.bind(baseEngine);

/** See {@link FetchEngine.changeModifyMethodOptions}. */
export const changeModifyMethodOptions = baseEngine.changeModifyMethodOptions.bind(baseEngine);



/** See {@link FetchEngine.on}. */
export const on = baseEngine.on.bind(baseEngine);

/** See {@link FetchEngine.off}. */
export const off = baseEngine.off.bind(baseEngine);



/** See {@link FetchEngine}. */
export default baseEngine;