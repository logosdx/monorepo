/**
 * Properties module for FetchEngine.
 *
 * Provides property management for headers and URL parameters
 * with CRUD operations, method-specific overrides, and event emission.
 */

export { PropertyStore, type PropertyStoreOptions, type PropertyValidateFn, type MethodOverrides } from './store.ts';
export { HeadersManager } from './headers.ts';
export { ParamsManager } from './params.ts';
