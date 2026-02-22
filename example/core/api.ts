import { FetchEngine } from '@logosdx/fetch';

export const api = new FetchEngine({
    baseUrl: `${globalThis.location?.origin ?? 'http://localhost:3001'}/api`,
    defaultType: 'json',
    retry: false,
    headers: {
        'Content-Type': 'application/json',
    },
});
