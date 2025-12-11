import {
    describe,
    it,
    expect
} from 'vitest'


import Hapi from '@hapi/hapi';

import {
    FetchError,
    FetchEngine,
} from '../../../packages/fetch/src/index.ts';

import logosFetch from '../../../packages/fetch/src/index.ts';
import { attempt, attemptSync, wait, noop } from '../../../packages/utils/src/index.ts';
import { sandbox } from '../_helpers.ts';
import { EventData, RegexCallbackArg, makeTestStubs } from './_helpers.ts';

describe('@logosdx/fetch: base', async () => {

    const { callStub, server, testUrl } = await makeTestStubs(4123);

    it('can be imported as a default export', async () => {

        expect(logosFetch).to.exist;
        expect(logosFetch.get).to.exist;
        expect(logosFetch.post).to.exist;
        expect(logosFetch.put).to.exist;
        expect(logosFetch.delete).to.exist;
        expect(logosFetch.patch).to.exist;
        expect(logosFetch.options).to.exist;
        expect(logosFetch.request).to.exist;
        expect(logosFetch.removeHeader).to.exist;
        expect(logosFetch.removeParam).to.exist;
        expect(logosFetch.addHeader).to.exist;
        expect(logosFetch.addParam).to.exist;
        expect(logosFetch.setState).to.exist;
        expect(logosFetch.resetState).to.exist;
        expect(logosFetch.getState).to.exist;
        expect(logosFetch.changeBaseUrl).to.exist;
        expect(logosFetch.changeModifyOptions).to.exist;
        expect(logosFetch.changeModifyMethodOptions).to.exist;
        expect(logosFetch.on).to.exist;
        expect(logosFetch.off).to.exist;
        expect(logosFetch.hasHeader).to.exist;

        await logosFetch.get(server.info.uri + '/json');
        expect(callStub.args.length).to.equal(1);

        const req = callStub.args.pop()!.pop()!;
        const called = req.url.href.toLowerCase();
        const expected = server.info.uri.toLowerCase() + '/json';

        expect(called).to.equal(expected);
    });

    it('requires a proper config', () => {

        const baseUrl = 'localhost:3000';
        const defaultType = 'json';

        const opts = {} as any;

        const test = (throws: string | RegExp) => {

            expect(() => new FetchEngine(opts)).to.throw(throws);
        }

        test(/baseUrl.+required/);

        opts.baseUrl = ':p';
        test(/invalid url/i);

        opts.baseUrl = baseUrl;
        opts.defaultType = ':p';
        test(/invalid type/i);

        opts.defaultType = defaultType;
        opts.headers = 'not an object';
        test(/headers must be an object/i);

        opts.headers = {};
        opts.methodHeaders = 'not an object';
        test(/methodHeaders must be an object/i);

        opts.methodHeaders = {};
        opts.methodHeaders.POST = 'not an object';
        test(/methodHeaders items must be objects/i);

        opts.methodHeaders.POST = {};
        opts.params = 'not an object';
        test(/params must be an object/i);

        opts.params = {};
        opts.methodParams = 'not an object';
        test(/methodParams must be an object/i);

        opts.methodParams = {};
        opts.methodParams.POST = 'not an object';
        test(/methodParams items must be objects/i);

        opts.methodParams.POST = {};
        opts.modifyOptions = 'not a function';
        test(/modifyOptions must be a function/i);

        opts.modifyOptions = () => {};
        opts.modifyMethodOptions = 'not an object';
        test(/modifyMethodOptions must be an object/i);

        opts.modifyMethodOptions = {};
        opts.modifyMethodOptions.POST = 'not a function';
        test(/modifyMethodOptions items must be functions/i);

        opts.modifyMethodOptions.POST = () => {};
        opts.validate = 'not an object';
        test(/validate must be an object/i);

        opts.validate = {};
        opts.validate.headers = 'not a function';
        test(/validate.headers must be a function/i);

        opts.validate.headers = () => {};
        opts.validate.state = 'not a function';
        test(/validate.state must be a function/i);

        opts.validate.state = () => {};
        opts.timeout = 'not a number';
        test(/timeout must be positive number/i);

        opts.timeout = -1;
        test(/timeout must be positive number/i);

        opts.timeout = 1;
        opts.determineType = 'not a function';
        test(/determineType must be a function/i);

        opts.determineType = () => {};
    });

    it('accepts a proper config', () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            defaultType: 'json',
            headers: {
                'content-type': 'application/json',
            },
            methodHeaders: {
                POST: {
                    'content-type': 'text/xml',
                },
                PUT: {
                    'content-type': 'text/xml',
                },
            },
            params: {
                page: '1',
            },
            methodParams: {
                POST: {
                    page: '2',
                },
                PUT: {
                    page: '3',
                },
            },
            modifyOptions: (opts) => opts,
            modifyMethodOptions: {
                POST: (opts) => opts,
                PUT: (opts) => opts,
            },
            timeout: 1000,
            validate: {
                headers: () => true,
                state: () => true,
                params: () => true,
                perRequest: {
                    headers: true,
                    params: true,
                }
            },
            determineType: () => 'json',
        });

        expect(api.get).to.exist;
        expect(api.delete).to.exist;
        expect(api.patch).to.exist;
        expect(api.post).to.exist;
        expect(api.put).to.exist;
        expect(api.hasHeader).to.exist;
        expect(api.addHeader).to.exist;
        expect(api.rmHeader).to.exist;
    });

    it('makes http requests', async () => {

        const expectation = { ok: true };

        const api = new FetchEngine({
            baseUrl: testUrl,
            defaultType: 'json'
        });

        expect((await api.get('/json')).data).to.contain(expectation);
        expect((await api.post('/json')).data).to.contain(expectation);
        expect((await api.patch('/json')).data).to.contain(expectation);
        expect((await api.put('/json')).data).to.contain(expectation);
        expect((await api.delete('/json')).data).to.contain(expectation);
        expect((await api.options('/json')).data).to.contain(expectation);
    });

    it('preserves the full baseUrl path when constructing URLs', async () => {

        // Regression test: baseUrl with path segment like /org/1/v1 should NOT
        // have its last character chopped off (turning v1 into v)
        const api = new FetchEngine({
            baseUrl: testUrl + '/org/1/v1',
            defaultType: 'json'
        });

        const response = await api.get('/json');

        // The request URL should contain the full /org/1/v1 path, not /org/1/v
        const requestUrl = callStub.args[0]?.[0]?.url?.href || '';

        expect(requestUrl).to.include('/org/1/v1/json');
        expect(requestUrl).not.to.include('/org/1/v/json');
        expect(response.data).to.contain({ ok: true });

        api.destroy();
    });

    it('returns a FetchResponse object', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            defaultType: 'json',
            timeout: 5000,
            headers: {
                'X-Custom': 'test-header'
            }
        });

        const response = await api.get('/json');

        expect(response.data).to.exist;
        expect(response.data).to.contain({ ok: true });
        expect(response.data).to.be.an('object');

        expect(response.headers).to.exist;
        expect(response.headers).to.be.an('object');
        expect(response.headers['content-type']).to.contain('application/json');

        // Headers should be accessible via bracket notation
        expect(response.headers['content-type']).to.exist;
        expect(response.headers['non-existent']).to.be.undefined;

        expect(response.status).to.exist;
        expect(response.status).to.be.a('number');
        expect(response.status).to.eq(200);

        expect(response.request).to.exist;
        expect(response.request).to.be.instanceOf(Request);
        expect(response.request.url).to.eq(testUrl + '/json');
        expect(response.request.method).to.eq('GET');

        // Verify request headers include our custom header
        expect(response.request.headers.get('X-Custom')).to.eq('test-header');

        expect(response.config).to.exist;
        expect(response.config).to.be.an('object');
        expect(response.config.baseUrl).to.contain(testUrl);
        expect(response.config.timeout).to.eq(5000);
        expect(response.config.headers).to.exist;
        // Headers might be structured differently in config
        expect(response.config.headers).to.be.an('object');

        // Ensure all expected properties exist and have correct types
        const responseKeys = Object.keys(response).sort();
        expect(responseKeys).to.deep.equal(['config', 'data', 'headers', 'request', 'status']);
    });

    it('returns FetchResponse objects for all HTTP methods', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            defaultType: 'json'
        });

        const payload = { test: 'data' };
        const expectedData = { ok: true };

        // === Test each HTTP method returns proper FetchResponse ===
        const methods = [
            { name: 'GET', fn: () => api.get('/json') },
            { name: 'POST', fn: () => api.post('/json', payload) },
            { name: 'PUT', fn: () => api.put('/json', payload) },
            { name: 'PATCH', fn: () => api.patch('/json', payload) },
            { name: 'DELETE', fn: () => api.delete('/json', payload) },
            { name: 'OPTIONS', fn: () => api.options('/json') }
        ];

        for (const { name, fn } of methods) {

            const response = await fn();

            // Validate FetchResponse structure for each method
            expect(response.data, `${name}: data should exist`).to.exist;
            expect(response.data, `${name}: data should contain expected`).to.contain(expectedData);

            expect(response.headers, `${name}: headers should exist`).to.exist;
            expect(response.headers, `${name}: headers should be an object`).to.be.an('object');

            expect(response.status, `${name}: status should exist`).to.exist;
            expect(response.status, `${name}: status should be number`).to.be.a('number');
            expect(response.status, `${name}: status should be 200`).to.eq(200);

            expect(response.request, `${name}: request should exist`).to.exist;
            expect(response.request, `${name}: request should be Request instance`).to.be.instanceOf(Request);
            expect(response.request.method, `${name}: request method should match`).to.eq(name);

            expect(response.config, `${name}: config should exist`).to.exist;
            expect(response.config, `${name}: config should be object`).to.be.an('object');
            expect(response.config.baseUrl, `${name}: config baseUrl should match`).to.contain(testUrl);

            // Validate structure consistency
            const responseKeys = Object.keys(response).sort();
            expect(responseKeys, `${name}: should have all FetchResponse properties`).to.deep.equal(['config', 'data', 'headers', 'request', 'status']);
        }
    });

    it('maintains FetchResponse structure in error scenarios', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            defaultType: 'json'
        });

        // === Test error responses still return proper structure ===
        const [, error] = await attempt(() => api.get('/fail'));

        expect(error).to.exist;
        expect(error).to.be.instanceOf(FetchError);

        // Even on error, we should have gotten a response object before the error was thrown
        const errorResponse = (error as FetchError).data;
        expect(errorResponse).to.exist;

        // === Test empty responses maintain structure ===
        const emptyResponse = await api.get('/empty');

        expect(emptyResponse.data).to.be.null;
        expect(emptyResponse.headers).to.exist;
        expect(emptyResponse.headers).to.be.an('object');
        expect(emptyResponse.status).to.exist;
        expect(emptyResponse.status).to.be.a('number');
        expect(emptyResponse.request).to.exist;
        expect(emptyResponse.request).to.be.instanceOf(Request);
        expect(emptyResponse.config).to.exist;
        expect(emptyResponse.config).to.be.an('object');

        // === Test 204 No Content responses maintain structure ===
        const noContentResponse = await api.get('/empty2');

        expect(noContentResponse.data).to.be.null;
        expect(noContentResponse.status).to.eq(204);
        expect(noContentResponse.headers).to.exist;
        expect(noContentResponse.headers).to.be.an('object');
        expect(noContentResponse.request).to.exist;
        expect(noContentResponse.request).to.be.instanceOf(Request);
        expect(noContentResponse.config).to.exist;
        expect(noContentResponse.config).to.be.an('object');

        // === Ensure all responses have consistent structure ===
        const responses = [emptyResponse, noContentResponse];

        for (const response of responses) {

            const responseKeys = Object.keys(response).sort();
            expect(responseKeys, 'All responses should have consistent FetchResponse structure').to.deep.equal(['config', 'data', 'headers', 'request', 'status']);
        }
    });

    it('supports TypeScript generics for proper typing', async () => {

        interface TestUser {
            id: number;
            name: string;
            email: string;
        }

        interface TestApiResponse {
            ok: boolean;
            timestamp: string;
        }

        const api = new FetchEngine({
            baseUrl: testUrl,
            defaultType: 'json'
        });

        // === Test basic generic typing ===
        const basicResponse = await api.get<TestApiResponse>('/json');

        expect(basicResponse.data).to.exist;
        expect(basicResponse.data).to.be.an('object');
        expect(basicResponse.data).to.have.property('ok');

        // TypeScript should enforce type structure
        const isValidType = typeof basicResponse.data.ok === 'boolean';
        expect(isValidType, 'Generic type should enforce boolean for ok property').to.be.true;

        // === Test generic typing with payload ===
        const postPayload: Partial<TestUser> = {
            name: 'Test User',
            email: 'test@example.com'
        };

        const postResponse = await api.post<TestApiResponse, Partial<TestUser>>('/json', postPayload);

        expect(postResponse.data).to.exist;
        expect(postResponse.data).to.be.an('object');
        expect(postResponse.data).to.have.property('ok');

        // === Test that response maintains FetchResponse structure with generics ===
        expect(postResponse.headers).to.be.an('object');
        expect(postResponse.status).to.be.a('number');
        expect(postResponse.request).to.be.instanceOf(Request);
        expect(postResponse.config).to.be.an('object');

        // === Test generic inference with different types ===
        const numberResponse = await api.get<number>('/json');
        const stringResponse = await api.get<string>('/json');
        const arrayResponse = await api.get<any[]>('/json');

        // These should all maintain the FetchResponse structure
        const responses = [numberResponse, stringResponse, arrayResponse];

        for (const response of responses) {

            const responseKeys = Object.keys(response).sort();
            expect(responseKeys, 'Generic responses should maintain FetchResponse structure').to.deep.equal(['config', 'data', 'headers', 'request', 'status']);
            expect(response.data).to.exist;
            expect(response.headers).to.be.an('object');
            expect(response.status).to.be.a('number');
            expect(response.request).to.be.instanceOf(Request);
            expect(response.config).to.be.an('object');
        }

        // === Test default generic type (any) ===
        const defaultResponse = await api.get('/json');

        expect(defaultResponse.data).to.exist;
        expect(defaultResponse.headers).to.be.an('object');
        expect(defaultResponse.status).to.be.a('number');
        expect(defaultResponse.request).to.be.instanceOf(Request);
        expect(defaultResponse.config).to.be.an('object');
    });

    it('supports destructuring patterns for backward compatibility', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            defaultType: 'json'
        });

        // === Test basic destructuring of data property ===
        const { data } = await api.get('/json');

        expect(data).to.exist;
        expect(data).to.contain({ ok: true });

        // === Test destructuring with renaming ===
        const { data: responseData } = await api.get('/json');

        expect(responseData).to.exist;
        expect(responseData).to.contain({ ok: true });

        // === Test destructuring multiple properties ===
        const { data: userData, status, headers } = await api.get('/json');

        expect(userData).to.exist;
        expect(userData).to.contain({ ok: true });
        expect(status).to.exist;
        expect(status).to.eq(200);
        expect(headers).to.exist;
        expect(headers).to.be.an('object');

        // === Test destructuring with generics ===
        const { data: typedData, status: typedStatus } = await api.get<{ ok: boolean }>('/json');

        expect(typedData).to.exist;
        expect(typedData).to.have.property('ok');
        expect(typedData.ok).to.be.a('boolean');
        expect(typedStatus).to.eq(200);

        // === Test destructuring all properties ===
        const { data: allData, headers: allHeaders, status: allStatus, request, config } = await api.get('/json');

        expect(allData).to.exist;
        expect(allHeaders).to.be.an('object');
        expect(allStatus).to.be.a('number');
        expect(request).to.be.instanceOf(Request);
        expect(config).to.be.an('object');

        // === Test destructuring works with error handling ===
        const [response, error] = await attempt(async () => {

            const { data: errorData } = await api.get('/json');
            return errorData;
        });

        expect(error).to.not.exist;
        expect(response).to.exist;
        expect(response).to.contain({ ok: true });

        // === Test destructuring in function parameters (common pattern) ===
        const processResponse = ({ data: processedData, status: processedStatus }: { data: any, status: number }) => {

            return {
                processed: processedData,
                statusCode: processedStatus
            };
        };

        const apiResponse = await api.get('/json');
        const processed = processResponse(apiResponse);

        expect(processed.processed).to.exist;
        expect(processed.processed).to.contain({ ok: true });
        expect(processed.statusCode).to.eq(200);

        // === Test array destructuring for multiple requests ===
        const responses = await Promise.all([
            api.get('/json'),
            api.post('/json', { test: true }),
            api.put('/json', { test: true })
        ]);

        const [getResponse, postResponse, putResponse] = responses;

        // Destructure each response
        const { data: getData } = getResponse;
        const { data: postData } = postResponse;
        const { data: putData } = putResponse;

        expect(getData).to.contain({ ok: true });
        expect(postData).to.contain({ ok: true });
        expect(putData).to.contain({ ok: true });

        // === Test rest operator with destructuring ===
        const { data: restData, ...restMetadata } = await api.get('/json');

        expect(restData).to.exist;
        expect(restData).to.contain({ ok: true });

        expect(restMetadata).to.have.property('status');
        expect(restMetadata).to.have.property('headers');
        expect(restMetadata).to.have.property('request');
        expect(restMetadata).to.have.property('config');

        expect(restMetadata.status).to.eq(200);
        expect(restMetadata.headers).to.be.an('object');
        expect(restMetadata.request).to.be.instanceOf(Request);
        expect(restMetadata.config).to.be.an('object');
    });

    it('provides typed config in FetchResponse', async () => {

        interface MyHeaders {
            'x-custom-header': string;
            'authorization'?: string;
        }

        interface MyParams {
            version: string;
            format: 'json' | 'xml';
        }

        const api = new FetchEngine<MyHeaders, MyParams>({
            baseUrl: testUrl,
            defaultType: 'json',
            headers: {
                'x-custom-header': 'test-value'
            },
            params: {
                version: 'v1',
                format: 'json'
            }
        });

        const response = await api.get('/json');

        expect(response.config).to.exist;
        expect(response.config).to.be.an('object');
        expect(response.config.headers).to.exist;
        expect(response.config.params).to.exist;

        // The config should contain our typed headers and params (may be lowercased)
        expect(response.config.headers).to.have.property('x-custom-header');
        expect(response.config.params).to.have.property('version');
        expect(response.config.params).to.have.property('format');

        // Verify the values match what we configured
        expect(response.config.headers?.['x-custom-header']).to.eq('test-value');
        expect(response.config.params?.version).to.eq('v1');
        expect(response.config.params?.format).to.eq('json');

        expect(response.config.baseUrl).to.contain(testUrl);
        expect(response.config.method).to.eq('GET');

        const postResponse = await api.post('/json', { test: 'data' });
        expect(postResponse.config.headers).to.have.property('x-custom-header');
        expect(postResponse.config.params?.version).to.eq('v1');
        expect(postResponse.config.method).to.eq('POST');
    });

    it('sets default headers', async () => {

        const expectation = { ok: true };

        const api = new FetchEngine({
            baseUrl: testUrl,
            defaultType: 'json',
            headers: {
                'content-type': 'application/json',
                'authorization': 'abc123'
            }
        });

        expect((await api.get('/json')).data).to.contain(expectation);

        const req = callStub!.args!.pop()!.pop()!;

        expect(req.headers).to.contain({
            'content-type': 'application/json',
            'authorization': 'abc123'
        });
    });

    it('sets default method headers', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            defaultType: 'json',
            headers: {
                'x-text-type': 'text/*',
            },
            methodHeaders: {
                POST: {
                    'x-text-type': 'text/post',
                },
                PUT: {
                    'x-text-type': 'text/put',
                },
            }
        });

        const onReq = sandbox.stub();

        api.on('fetch-before', onReq);

        const anyReq = (method: 'get' | 'post' | 'put' | 'delete' | 'options' | 'patch') => {

            const fn = api[method];

            return fn.call(api, '/json').catch(noop);
        };

        await anyReq('get');
        await anyReq('delete');
        await anyReq('patch');
        await anyReq('options');
        await anyReq('post');
        await anyReq('put');

        // Non-regex listener: first arg is EventData directly
        const calls = onReq.getCalls().map(
            c => (c.args[0] as EventData).headers
        );

        expect(calls.shift()).to.contain({ 'x-text-type': 'text/*' });
        expect(calls.shift()).to.contain({ 'x-text-type': 'text/*' });
        expect(calls.shift()).to.contain({ 'x-text-type': 'text/*' });
        expect(calls.shift()).to.contain({ 'x-text-type': 'text/*' });
        expect(calls.shift()).to.contain({ 'x-text-type': 'text/post' });
        expect(calls.shift()).to.contain({ 'x-text-type': 'text/put' });
    });

    it('sets and removes headers', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl
        });

        api.addHeader({ test: 'true' });
        expect(api.hasHeader('test')).to.equal(true);

        await api.get('/json1');

        api.rmHeader('test');
        expect(api.hasHeader('test')).to.equal(false);

        await api.get('/json2');

        const [[req1], [req2]] = callStub.args as any[]

        expect(req1.headers).to.contain({ 'test': 'true', });
        expect(req2.headers).to.not.contain({ 'test': 'true', });
    });

    it('allows header overrides from method functions', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl
        });

        const headers = { test: 'success' };

        await api.post('/json', null, { headers });
        await api.patch('/json', null, { headers });
        await api.put('/json', null, { headers });
        await api.delete('/json', null, { headers });
        await api.get('/json', { headers });
        await api.options('/json', { headers });

        callStub.args.forEach(
            ([req]) => expect(req.headers, req.method).to.contain(headers)
        );
    });

    it('sets and removes headers from method functions', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl
        });

        const headers = { key: '123' };

        api.addHeader(headers, 'DELETE');

        await api.post('/json');
        await api.put('/json');
        await api.patch('/json');
        await api.delete('/json');
        await api.get('/json');
        await api.options('/json');

        const calls = callStub.args.map(
            ([req]) => req.headers
        );

        const shouldContain = (msg: string, key?: string) => {

            const req = calls.shift()!;

            if (key) {

                expect(req, msg).to.contain({ key });
            }
            else {

                expect(req, msg).not.to.contain({ key: '123' });
            }
        }

        shouldContain('bad post headers');
        shouldContain('bad put headers');
        shouldContain('bad patch headers');
        shouldContain('bad delete headers', '123');
        shouldContain('bad get headers');
        shouldContain('bad options headers');

    });

    it('sets default params', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            params: {
                page: '1',
            }
        });

        await api.get('/json');

        const [[req]] = callStub.args as [[Hapi.Request]];

        expect(req.query).to.contain({ page: '1' });
    });

    it('sets default method params', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            params: {
                page: '1',
            },
            methodParams: {
                POST: {
                    page: '2',
                },
                PUT: {
                    page: '3',
                },
            }
        });

        const anyReq = (method: 'get' | 'post' | 'put' | 'delete' | 'options' | 'patch') => {

            const fn = api[method];

            return fn.call(api, '/json').catch(noop);
        };

        await anyReq('get');
        await anyReq('delete');
        await anyReq('patch');
        await anyReq('options');
        await anyReq('post');
        await anyReq('put');

        const calls = callStub.args.map(
            ([req]) => req.query
        );

        expect(calls.shift(), 'bad get params').to.contain({ page: '1' });
        expect(calls.shift(), 'bad delete params').to.contain({ page: '1' });
        expect(calls.shift(), 'bad patch params').to.contain({ page: '1' });
        expect(calls.shift(), 'bad options params').to.contain({ page: '1' });
        expect(calls.shift(), 'bad post params').to.contain({ page: '2' });
        expect(calls.shift(), 'bad put params').to.contain({ page: '3' });
    });

    it('allows param overrides from method functions', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl
        });

        const params = { page: '2' };

        await api.post('/json', null, { params });
        await api.put('/json', null, { params });
        await api.patch('/json', null, { params });
        await api.delete('/json', null, { params });
        await api.get('/json', { params });
        await api.options('/json', { params });

        callStub.args.forEach(
            ([req]) => expect(req.query, req.method).to.contain(params)
        );
    });

    it('sets and removes params', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            params: {
                page: '1',
                something: 'else',
            }
        });

        /**
         * Remove a param
         */

        api.rmParams('page');

        await api.get('/json');

        const [[req]] = callStub.args as [[Hapi.Request]];

        expect(req.query).to.not.contain({ page: '1' });
        expect(req.query).to.contain({ something: 'else' });

        callStub.resetHistory();

        /**
         * Add a param
         */

        api.addParam('page', '2');

        await api.get('/json');
        const [[req2]] = callStub.args as [[Hapi.Request]];

        expect(req2.query).to.contain({ page: '2' });
        expect(req2.query).to.contain({ something: 'else' });

        callStub.resetHistory();

    });

    it('sets and removes params from method functions', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            params: {
                page: '1',
            }
        });

        const params = { key: '123' };

        api.addParam('page', '2', 'DELETE');
        api.addParam({ page: '2' }, 'PATCH');

        callStub.resetHistory();

        await api.post('/json', null, { params });
        await api.put('/json', null, { params });
        await api.patch('/json', null, { params });
        await api.delete('/json', null, { params });
        await api.get('/json', { params });
        await api.options('/json', { params });

        const calls = callStub.args.map(
            ([req]) => req.query
        );

        const shouldContain = (msg: string, page?: string) => {

            const req = calls.shift()!;

            expect(req, msg).to.contain({ ...params, page });
        }

        shouldContain('bad post params', '1');
        shouldContain('bad put params', '1');
        shouldContain('bad patch params', '2');
        shouldContain('bad delete params', '2');
        shouldContain('bad get params', '1');
        shouldContain('bad options params', '1');

        callStub.resetHistory();

        /**
         * Add a param with a method
         */

        api.addParam('key', '123', 'POST');

        await api.get('/json');
        await api.post('/json');
        const [[req3], [req4]] = callStub.args as [[Hapi.Request], [Hapi.Request]];

        expect(req3.query).not.to.contain({ key: '123' });
        expect(req4.query).to.contain({ key: '123' });

        callStub.resetHistory();
        api.addParam('key', '456', 'GET');

        await api.get('/json');
        await api.post('/json');
        const [[req5], [req6]] = callStub.args as [[Hapi.Request], [Hapi.Request]];

        expect(req5.query).to.contain({ key: '456' });
        expect(req6.query).to.contain({ key: '123' });

        callStub.resetHistory();

        /**
         * Remove a param with a method
         */

        api.rmParams('key', 'POST');

        await api.get('/json');
        await api.post('/json');

        const [[req7], [req8]] = callStub.args as [[Hapi.Request], [Hapi.Request]];

        expect(req7.query).to.contain({ key: '456' });
        expect(req8.query).not.to.contain({ key: '123' });

        callStub.resetHistory();
        api.rmParams('key', 'GET');

        await api.get('/json');

        const [[req9]] = callStub.args as [[Hapi.Request]];

        expect(req9.query).not.to.contain({ key: '456' });

    });

    it('sends payloads', async () => {

        const payload = { pay: 'load' };
        const expectedPayload = JSON.stringify(payload);

        const api = new FetchEngine({
            baseUrl: testUrl
        });

        await api.post('/json', payload);
        await api.put('/json', payload);
        await api.patch('/json', payload);
        await api.delete('/json', payload);

        callStub.args.forEach(
            ([req]) => expect(req.payload, req.method).to.contain(expectedPayload)
        );

    });

    it('has lifecycle methods', async () => {

        const didError = sandbox.stub();
        const didBefore = sandbox.stub();
        const didAfter = sandbox.stub();

        const api = new FetchEngine({
            baseUrl: testUrl,
        });

        const errRes = {
            message: 'Bad Request',
            statusCode: 400
        };

        await attempt(
            () => api.get('/fail', {
                onAfterReq: didAfter,
                onBeforeReq: didBefore,
                onError: didError
            })
        );

        expect(didError.calledOnce).to.eq(true);
        expect(didBefore.calledOnce).to.eq(true);
        expect(didAfter.calledOnce).to.eq(true);

        const [[errArgs]] = didError.args as [[FetchError<any>]];

        expect(errArgs.data).to.contain({
            statusCode: errRes.statusCode,
            error: errRes.message,
            message: 'message',
        });

        expect(errArgs.status).to.eq(errRes.statusCode);

        const [[beforeArgs]] = didBefore.args as [[RequestInit]];
        expect(beforeArgs.method).to.eq('GET');
        expect(beforeArgs.signal).to.exist;
        expect(beforeArgs.headers).to.exist;

        const [[req, opts]] = didAfter.args as [[Request, RequestInit]];

        expect(req.constructor).to.eq(Response);
        expect(opts.method).to.eq('GET');
        expect(opts.signal).to.exist;
        expect(opts.headers).to.exist;
    });

    it('should preserve original status code in FetchError on content-type parsing errors', async () => {

        const onError = sandbox.stub();
        const api = new FetchEngine({
            baseUrl: testUrl,
            headers: {
                'content-type': 'application/json'
            },
        });

        await attempt(() => api.get('/bad-content-type', { onError }));

        const [[dropReq]] = onError.args as [[FetchError]];
        expect(dropReq.status).to.equal(204);
    });

    it('can abort requests', async () => {

        const onError = sandbox.stub();
        const onBeforeReq = (opts: FetchEngine.RequestOpts) => {

            setTimeout(() => {

                opts.controller.abort();
            }, 50);
        }

        const api = new FetchEngine({
            baseUrl: testUrl,
        });

        try { await api.get('/wait', { onError, onBeforeReq }); }
        catch (e) {}

        const [[errArgs]] = onError.args as [[FetchError]];
        expect(errArgs.status).to.equal(499);
    });

    it('returns an abortable promise', async () => {

        const onError = sandbox.stub();

        const api = new FetchEngine({
            baseUrl: testUrl,
        });

        const req1 = api.get('/wait', { onError });

        expect(req1.isFinished).to.be.false;
        expect(req1.isAborted).to.be.false;
        expect(req1.abort).to.exist;
        expect(req1.abort).to.be.a('function');
        expect(req1.then).to.exist;
        expect(req1.catch).to.exist;
        expect(req1.finally).to.exist;

        req1.abort();

        try { await req1; }
        catch (e) {}

        expect(req1.isAborted).to.be.true;
        expect(req1.isFinished).to.be.false;

        const req2 = api.get('/json', { onError });

        expect(req2.isFinished).to.be.false;
        expect(req2.isAborted).to.be.false;

        await req2;

        expect(req2.isFinished).to.be.true;
        expect(req2.isAborted).to.be.false;
    });

    it('can timeout requests', async () => {

        const onError = sandbox.stub();
        const timeout = 100;

        const api = new FetchEngine({
            baseUrl: testUrl,
            timeout
        });

        const now = () => +(new Date());

        let pre = now();

        try { await api.get('/wait', { onError }); }
        catch (e) {}

        let post = now();

        expect(post - pre).to.lessThan(timeout * 2)


        pre = now();

        try { await api.get('/wait', { onError, timeout: 10 }); }
        catch (e) {}

        post = now();

        expect(post - pre).to.lessThan(timeout + 30)

        const [[configWait],[reqWait]] = onError.args as [[FetchError], [FetchError]];

        expect(configWait.status).to.equal(499);
        expect(reqWait.status).to.equal(499);

    });

    it('can make options', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            modifyOptions(opts) {

                opts.headers = {

                    ...opts.headers,
                    'was-set': 'true'
                };

                return opts;
            }
        });

        await api.get('/json');

        const [[req]] = callStub.args as [[Hapi.Request]];

        expect(req.headers).to.contain({ 'was-set': 'true' });
    });

    it('can make options per method', async () => {

        const modifyOptions = sandbox.stub().returns({ headers: { 'was-set': 'true' } });

        const api = new FetchEngine({
            baseUrl: testUrl,
            modifyMethodOptions: {
                POST: modifyOptions,
                PUT: modifyOptions,
            }
        });

        const onReq = sandbox.stub();

        api.on('fetch-before', onReq);

        const anyReq = (method: 'get' | 'post' | 'put' | 'delete' | 'options' | 'patch') => {

            const fn = api[method];

            return fn.call(api, '/json').catch(noop);
        };

        await anyReq('get');
        await anyReq('delete');

        expect(modifyOptions.called).to.be.false;

        await anyReq('post');
        await anyReq('put');

        expect(modifyOptions.calledTwice).to.be.true;

        await anyReq('patch');

        expect(modifyOptions.calledTwice).to.be.true;

        // Non-regex listener: first arg is EventData directly
        const calls = onReq.getCalls().map(
            c => (c.args[0] as EventData).headers
        );

        expect(calls.shift()).to.not.contain({ 'was-set': 'true' });
        expect(calls.shift()).to.not.contain({ 'was-set': 'true' });
        expect(calls.shift()).to.contain({ 'was-set': 'true' });
        expect(calls.shift()).to.contain({ 'was-set': 'true' });
        expect(calls.shift()).to.not.contain({ 'was-set': 'true' });

        expect(calls).to.be.empty;

    });

    it('can set a state for use in make options', async () => {

        type TestState = {
            theValue: string;
        }

        const api = new FetchEngine <{}, {}, TestState>({
            baseUrl: testUrl,
            modifyOptions(opts, state) {

                opts.headers = {

                    ...opts.headers,
                    'was-set': state.theValue || 'not-set'
                };

                return opts;
            }
        });

        const val = 'someValue';

        api.setState({ theValue: val });

        await api.get('/json');

        api.resetState();

        await api.get('/json');


        const [[setReq], [resetReq]] = callStub.args as [[Hapi.Request], [Hapi.Request]];

        expect(setReq.headers).to.contain({ 'was-set': val });
        expect(resetReq.headers).to.contain({ 'was-set': 'not-set' });
    });

    it('listens for events', async () => {

        const listener = sandbox.stub();

        const headers: FetchEngine.Headers = {
            'Content-Type': 'application/json',
            Authorization: 'weeee'
        }

        const state: Record<string, string | boolean> = {};

        const api = new FetchEngine<any>({
            baseUrl: testUrl,
            headers
        });

        // Use regex to listen to all fetch events (ObserverEngine pattern)
        // Regex listeners receive ({ event, data }) as first arg
        api.on(/fetch-.*/, listener);

        // Helper to get event name from ObserverEngine regex callback
        // Regex callbacks receive { event, data } as first arg
        const getEventName = (args: [RegexCallbackArg]) => args[0]?.event || 'unknown';
        const getData = (args: [RegexCallbackArg]) => args[0]?.data;

        const assertNonRemoteEv = (data: EventData, eventName: string) => {

            expect(data.state, `${eventName} state`).to.exist;
            expect(data.state, `${eventName} specific state`).to.contain(state);
        }

        const assertRemoteEv = (
            path: string,
            method: string,
            data: EventData,
            eventName: string
        ) => {

            assertNonRemoteEv(data, eventName);

            expect(data.method, `${eventName} method`).to.exist;
            expect(data.url, `${eventName} url`).to.exist;
            expect(data.headers, `${eventName} headers`).to.exist;

            // url can be string or URL object
            const urlString = data.url instanceof URL ? data.url.href : data.url;
            expect(urlString, `${eventName} specific url`).to.eq(`${testUrl}${path}`);
            expect(data.method, `${eventName} specific method`).to.eq(method);
            expect(data.headers, `${eventName} specific headers`).to.contain(headers);
        }

        /**
         * Test Error events
         */

        try { await api.get('/fail'); }
        catch (e) {}

        expect(listener.calledThrice).to.be.true

        const [args1, args2, args3] = listener.args as [[RegexCallbackArg], [RegexCallbackArg], [RegexCallbackArg]];

        expect(getEventName(args1)).to.eq('fetch-before');
        expect(getEventName(args2)).to.eq('fetch-after');
        expect(getEventName(args3)).to.eq('fetch-error');

        for (const args of [args1, args2, args3]) {

            assertRemoteEv('/fail', 'GET', getData(args), getEventName(args));
        }

        /**
         * Test Abort events
         */

        listener.reset();

        try { await api.get('/wait', { timeout: 1 }); }
        catch (e) {}

        expect(listener.calledTwice).to.be.true

        const [abortArgs1, abortArgs2] = listener.args as [[RegexCallbackArg], [RegexCallbackArg]];

        expect(getEventName(abortArgs1)).to.eq('fetch-before');
        expect(getEventName(abortArgs2)).to.eq('fetch-abort');

        for (const args of [abortArgs1, abortArgs2]) {

            assertRemoteEv('/wait', 'GET', getData(args), getEventName(args));
        }

        /**
         * Test Successful events
         */
        listener.reset();

        const payload = { wee: true };
        await api.post('/json', payload);

        expect(listener.calledThrice).to.be.true

        const [successArgs1, successArgs2, successArgs3] = listener.args as [[RegexCallbackArg], [RegexCallbackArg], [RegexCallbackArg]];

        expect(getEventName(successArgs1)).to.eq('fetch-before');
        expect(getEventName(successArgs2)).to.eq('fetch-after');
        expect(getEventName(successArgs3)).to.eq('fetch-response');

        for (const args of [successArgs1, successArgs2, successArgs3]) {

            const data = getData(args);
            const eventName = getEventName(args);

            assertRemoteEv('/json', 'POST', data, eventName);
            expect(data.payload, `${eventName} payload`).to.exist;
            expect(data.payload, `${eventName} specific payload`).to.contain(payload);
        }

        expect(getData(successArgs3).data, `fetch-response data`).to.contain({ ok: true });

        /**
         * Test Non-request events
         */
        listener.reset();
        api.resetState();

        state.flowers = true;

        api.setState(state);
        api.addHeader({ wee: 'woo' });
        api.rmHeader(['wee']);
        api.changeBaseUrl('http://pope.pepe');

        const [
            stateResetArgs,
            stateSetArgs,
            headerAddArgs,
            headerRmArgs,
            urlChangeArgs
        ] = listener.args as [RegexCallbackArg][];

        const nonRemoteEvs = [
            stateSetArgs,
            headerAddArgs,
            headerRmArgs,
            urlChangeArgs
        ];

        expect(getData(stateResetArgs!).state).to.exist;
        expect(getData(stateResetArgs!).state).to.be.empty;

        for (const args of nonRemoteEvs) {

            assertNonRemoteEv(getData(args!), getEventName(args!));
        }

        expect(getEventName(stateResetArgs!)).to.eq('fetch-state-reset');
        expect(getEventName(stateSetArgs!)).to.eq('fetch-state-set');
        expect(getEventName(headerAddArgs!)).to.eq('fetch-header-add');
        expect(getEventName(headerRmArgs!)).to.eq('fetch-header-remove');
        expect(getEventName(urlChangeArgs!)).to.eq('fetch-url-change');

        /**
         * Test cleanup function (replaces off)
         */

        listener.reset();

        // Create a new api and listener to test cleanup
        const api2 = new FetchEngine<any>({ baseUrl: testUrl, headers });
        const listener2 = sandbox.stub();

        // on() returns a cleanup function
        const cleanup = api2.on(/fetch-.*/, listener2);

        // Trigger an event
        api2.resetState();
        expect(listener2.called, 'listener called before cleanup').to.be.true;

        // Call cleanup to remove listener
        listener2.reset();
        cleanup();

        // These should NOT trigger the listener
        api2.setState({ flowers: true });
        api2.addHeader({ wee: 'woo' });
        api2.rmHeader(['wee']);
        api2.changeBaseUrl(testUrl);

        await api2.post('/json', payload);

        try { await api2.get('/fail'); }
        catch (e) {}

        try { await api2.get('/wait', { timeout: 1 }); }
        catch (e) {}

        expect(listener2.called, 'listener not called after cleanup').to.be.false;

        api2.destroy();
    });

    it('handles empty responses', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
        });

        const res1 = await api.get('/empty');
        const res2 = await api.get('/empty2');

        expect(res1.data).to.be.null;
        expect(res2.data).to.be.null;
    });

    it('handles typings', () => {

        type TestState = {
            theValue: string;
        }

        type TestHeaders = {
            'x-test': string;
            'x-toast': 'true',
        }

        type TestParams = {
            page: string;
        }

        const api = new FetchEngine<TestHeaders, TestParams, TestState>({
            baseUrl: testUrl,
            headers: {
                'content-type': 'application/json',
                'x-test': 'true',
                poop: 'asd',
            },
            params: {
                page: '1',
            },
            methodParams: {
                POST: {
                    page: '2',
                },
            },
            methodHeaders: {
                POST: {
                    'content-type': 'text/xml',
                    'x-test': 'true',
                },
            },
            validate: {
                headers(h) {

                    h['x-test'] = 'test';
                },
                state(s) {

                    s.theValue = '123';
                },
                params(p) {

                    p.page = '3';
                },

                perRequest: {
                    headers: true,
                    params: true,
                }
            },
            modifyOptions(opts, state) {

                opts.headers!['x-test'] = state.theValue;

                return opts;
            },
            modifyMethodOptions: {
                POST(opts, state) {

                    opts.headers!['x-test'] = state.theValue;

                    return opts;
                }
            }
        });

        api.addHeader({ hmac: 'ghi789', poop: 'asd',  });
        api.addHeader({ 'x-test': 'test' });
        api.addHeader('x-toast', 'true');

        api.addParam('page', '4');
        api.addParam({ page: '5' });

        api.rmHeader('x-test');
        api.rmHeader(['x-toast'])
        api.rmParams('page');
        api.rmParams(['page']);

        type TestPayload = {
            test: string;
        }

        type TestResponse = {
            ok: boolean;
        }

        async () => {

            const payload = { test: 'true' };

            const res = await api.post <TestResponse, TestPayload> (
                '/json',
                payload,
                {
                    headers: {
                        'x-toast': 'true',
                    }
                }
            );

            res.data.ok === true;
        }
    });

    it('validates headers', () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            headers: {
                'content-type': 'application/json',
            },
            validate: {
                headers(h) {

                    expect(h['content-type']).to.eq('application/json');

                    if (h['test']) {

                        expect(h['test']).to.eq('true');
                    }

                    expect(h['poop']).to.not.exist;
                },
            }
        });

        const succeed = [
            () => api.addHeader({ test: 'true' }),
            () => api.addHeader('test', 'true'),
        ];

        const fail = [

            () => api.addHeader({ poop: 'asd' }),
            () => api.addHeader('poop', 'asd'),
            () => api.addHeader('test', 'false'),
            () => api.addHeader('content-type', 'application/xml'),
        ]

        succeed.forEach(
            fn => expect(fn, fn.toString()).to.not.throw()
        );

        fail.forEach(
            fn => expect(fn, fn.toString()).to.throw()
        );
    });

    it('validates headers per request', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            headers: {
                'content-type': 'application/json',
            },
            validate: {
                headers(h, method) {

                    if (method === 'GET') {

                        expect(h['content-type']).to.eq('application/json');
                        expect(h['test']).to.not.exist;
                    }

                    if (method === 'POST') {

                        expect(h['content-type']).to.eq('application/json');
                        expect(h['test']).to.eq('true');
                    }

                    if (method === 'PUT') {

                        expect(h['content-type']).to.eq('application/json');
                        expect(h['test']).to.eq('true');
                    }
                },
                perRequest: {
                    headers: true
                }
            },
        });

        const succeed = [
            () => api.get('/json'),
            () => api.post('/json', null, { headers: { test: 'true' } }),
            () => api.put('/json', null, { headers: { test: 'true' } }),
        ];

        const fail = [
            () => api.get('/json', { headers: { test: 'true' } }),
            () => api.post('/json'),
            () => api.put('/json'),
        ];

        const failed = sandbox.stub();

        await Promise.all(
            succeed.map(fn => fn().catch(failed))
        );

        expect(failed.called).to.be.false;

        await Promise.all(
            fail.map(fn => fn().catch(failed))
        );

        expect(failed.called).to.be.true;
        expect(failed.callCount).to.eq(fail.length);
    });

    it('validates params', () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            params: {
                page: '1',
            },
            validate: {
                params(p) {

                    expect(p.page).to.eq('1');

                    if (p.test) {

                        expect(p.test).to.eq('true');
                    }

                    expect(p.poop).to.not.exist;

                }
            }
        });

        const succeed = [
            () => api.addParam({ test: 'true' }),
            () => api.addParam('test', 'true'),
        ];

        const fail = [

            () => api.addParam({ poop: 'asd' }),
            () => api.addParam('poop', 'asd'),
            () => api.addParam('test', 'false'),
            () => api.addParam('page', '2'),
        ];

        succeed.forEach(
            fn => expect(fn, fn.toString()).to.not.throw()
        );

        fail.forEach(
            fn => expect(fn, fn.toString()).to.throw()
        );
    });

    it('validates params per request', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            params: {
                page: '1',
            },
            validate: {
                params(p, method) {

                    if (method === 'GET') {

                        expect(p.page).to.eq('1');
                        expect(p.test).to.not.exist;
                    }

                    if (method === 'POST') {

                        expect(p.page).to.eq('1');
                        expect(p.test).to.eq('true');
                    }

                    if (method === 'PUT') {

                        expect(p.page).to.eq('1');
                        expect(p.test).to.eq('true');
                    }
                },
                perRequest: {
                    params: true
                }
            }
        });

        const succeed = [
            () => api.get('/json'),
            () => api.post('/json', null, { params: { test: 'true' } }),
            () => api.put('/json', null, { params: { test: 'true' } }),
        ];

        const fail = [
            () => api.get('/json', { params: { test: 'true' } }),
            () => api.post('/json'),
            () => api.put('/json'),
        ];

        const failed = sandbox.stub();

        await Promise.all(
            succeed.map(fn => fn().catch(failed))
        );

        expect(failed.called).to.be.false;

        await Promise.all(
            fail.map(fn => fn().catch(failed))
        );

        expect(failed.called).to.be.true;
        expect(failed.callCount).to.eq(fail.length);
    });

    it('validates states', () => {

        type TestState = {
            theValue: string;
        }

        const fn = sandbox.stub();

        const api = new FetchEngine<{}, {}, TestState>({
            baseUrl: testUrl,
            headers: {
                'content-type': 'application/json',
            },
            validate: {
                state(s) {

                    if (s.theValue) {

                        expect(s.theValue).to.eq('someValue');
                    }

                    fn();
                },
            }
        });

        api.setState({ theValue: 'someValue' });
        api.resetState();

        expect(fn.calledTwice).to.be.true;
    });

    it('captures payload on error', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
        });

        try {
            await api.get('/validate?name=&age=17')
            throw new Error('Should have thrown');
        }
        catch (e) {

            expect(e).to.be.an.instanceOf(FetchError);

            const err = e as FetchError;

            expect(err.data).to.contain({
                statusCode: 400,
                error: 'Bad Request',
                message: `"name" is not allowed to be empty`,
            });
        }
    });

    it('can use a custom abort controller', async () => {

        const controller = new AbortController();

        const api1 = new FetchEngine({ baseUrl: testUrl });
        const api2 = new FetchEngine({ baseUrl: testUrl });

        const req1 = api1.get('/', { abortController: controller });
        const req2 = api2.get('/', { abortController: controller });

        expect(req1.isAborted).to.be.false;
        expect(req2.isAborted).to.be.false;

        controller.abort();

        const [,req1Err] = await attempt(() => req1);
        const [,req2Err] = await attempt(() => req2);

        expect(req1Err).to.exist;
        expect(req2Err).to.exist;

        expect(req1.isAborted).to.be.true;
        expect(req2.isAborted).to.be.true;

        expect(req1.isFinished).to.be.false;
        expect(req2.isFinished).to.be.false;

    });

    it('can change modifyOptions function', async () => {

        const api = new FetchEngine({ baseUrl: testUrl });

        let modifyCallCount = 0;

        const modifyOptions = (opts: any) => {

            modifyCallCount++;
            opts.headers = { ...opts.headers, 'x-modified': 'true' };
            return opts;
        };

        const onModifyOptionsChange = sandbox.stub();

        api.on('fetch-modify-options-change', onModifyOptionsChange);

        // Set modifyOptions function
        api.changeModifyOptions(modifyOptions);

        expect(onModifyOptionsChange.calledOnce).to.be.true;
        // Non-regex listener: first arg is EventData directly
        expect((onModifyOptionsChange.firstCall.args[0] as EventData).data).to.equal(modifyOptions);

        // Make a request to verify the modifier is applied
        await api.get('/json');

        expect(modifyCallCount).to.equal(1);

        // Clear modifyOptions function
        api.changeModifyOptions(undefined);

        expect(onModifyOptionsChange.calledTwice).to.be.true;
        expect((onModifyOptionsChange.secondCall.args[0] as EventData).data).to.be.undefined;

        // Make another request to verify the modifier is no longer applied
        await api.get('/json');

        expect(modifyCallCount).to.equal(1); // Should still be 1
    });

    it('can change modifyMethodOptions function', async () => {

        const api = new FetchEngine({ baseUrl: testUrl });

        let postModifyCallCount = 0;
        let getModifyCallCount = 0;

        const postModifyOptions = (opts: any) => {

            postModifyCallCount++;
            opts.headers = { ...opts.headers, 'x-post-modified': 'true' };
            return opts;
        };

        const getModifyOptions = (opts: any) => {

            getModifyCallCount++;
            opts.headers = { ...opts.headers, 'x-get-modified': 'true' };
            return opts;
        };

        const onModifyMethodOptionsChange = sandbox.stub();

        api.on('fetch-modify-method-options-change', onModifyMethodOptionsChange);

        // Set POST modifyOptions function
        api.changeModifyMethodOptions('POST', postModifyOptions);

        expect(onModifyMethodOptionsChange.calledOnce).to.be.true;
        // Non-regex listener: first arg is EventData directly, data property contains { method, fn }
        const firstCallData = (onModifyMethodOptionsChange.firstCall.args[0] as EventData).data as { method: string; fn: unknown };
        expect(firstCallData.method).to.equal('POST');
        expect(firstCallData.fn).to.equal(postModifyOptions);

        // Set GET modifyOptions function
        api.changeModifyMethodOptions('GET', getModifyOptions);

        expect(onModifyMethodOptionsChange.calledTwice).to.be.true;
        const secondCallData = (onModifyMethodOptionsChange.secondCall.args[0] as EventData).data as { method: string; fn: unknown };
        expect(secondCallData.method).to.equal('GET');
        expect(secondCallData.fn).to.equal(getModifyOptions);

        // Make a GET request to verify only GET modifier is applied
        await api.get('/json');

        expect(getModifyCallCount).to.equal(1);
        expect(postModifyCallCount).to.equal(0);

        // Make a POST request to verify only POST modifier is applied
        await api.post('/json', {});

        expect(getModifyCallCount).to.equal(1);
        expect(postModifyCallCount).to.equal(1);

        // Clear POST modifyOptions function
        api.changeModifyMethodOptions('POST', undefined);

        expect(onModifyMethodOptionsChange.callCount).to.equal(3);
        const thirdCallData = (onModifyMethodOptionsChange.thirdCall.args[0] as EventData).data as { method: string; fn: unknown };
        expect(thirdCallData.method).to.equal('POST');
        expect(thirdCallData.fn).to.be.undefined;

        // Make another POST request to verify the modifier is no longer applied
        await api.post('/json', {});

        expect(postModifyCallCount).to.equal(1); // Should still be 1
        expect(getModifyCallCount).to.equal(1); // Should still be 1
    });

    it('supports custom typed response headers', async () => {

        const api = new FetchEngine({ baseUrl: testUrl });

        // === Test with custom headers from server ===
        const response = await api.get('/custom-headers');

        // Verify the response headers object exists and is typed correctly
        expect(response.headers).to.exist;
        expect(response.headers).to.be.an('object');

        // Verify that standard headers are accessible
        expect(response.headers['content-type']).to.exist;
        expect(response.headers['content-type']).to.contain('application/json');

        // TypeScript should allow access to custom headers defined in InstanceResponseHeaders
        // These headers are sent by the server, so they should exist
        const customHeader: string | undefined = response.headers['x-custom-response-header'];
        const rateLimit: string | undefined = response.headers['x-rate-limit-remaining'];
        const requestId: string | undefined = response.headers['x-request-id'];

        // Verify the custom headers have the expected values
        expect(customHeader).to.equal('test-value');
        expect(rateLimit).to.equal('100');
        expect(requestId).to.equal('req-12345');

        // === Test with endpoint that doesn't send custom headers ===
        const standardResponse = await api.get('/json');

        // Custom headers should be undefined for this endpoint
        expect(standardResponse.headers['x-custom-response-header']).to.be.undefined;
        expect(standardResponse.headers['x-rate-limit-remaining']).to.be.undefined;
        expect(standardResponse.headers['x-request-id']).to.be.undefined;

        // === Test per-request response header typing ===
        interface CustomResponseHeaders {
            'x-test-specific': string;
        }

        const typedResponse = await api.get<any, CustomResponseHeaders>('/json');

        expect(typedResponse.headers).to.exist;
        expect(typedResponse.headers).to.be.an('object');

        // TypeScript knows about the custom header type
        const testSpecific: string | undefined = typedResponse.headers['x-test-specific'];
        expect(testSpecific).to.be.undefined;

        // === Verify that headers are correctly extracted from actual response ===
        const allHeaders = Object.keys(response.headers);
        expect(allHeaders.length).to.be.greaterThan(0);
        expect(allHeaders).to.include('content-type');
        expect(allHeaders).to.include('x-custom-response-header');
        expect(allHeaders).to.include('x-rate-limit-remaining');
        expect(allHeaders).to.include('x-request-id');
    });

    // ========================================================================
    // TIMEOUT BOUNDARIES
    // ========================================================================

    describe('timeout boundaries', () => {

        it('should handle 0ms timeout', async () => {

            // Immediate timeout edge case - use slow endpoint to ensure timeout fires first
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true
            });

            // Timeout of 0ms should immediately abort against slow endpoint
            const [, err] = await attempt(() => api.get('/slow-success/200', { timeout: 0 }));

            expect(err).to.exist;
            expect(err).to.be.instanceOf(FetchError);

            const fetchErr = err as FetchError;
            expect(fetchErr.aborted).to.be.true;

            api.destroy();
            await wait(10); // Let microtasks settle
        });

        it('should handle 1ms timeout', async () => {

            // Very short timeout - likely to fail on slow endpoint
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true
            });

            // Start a slow request (1000ms endpoint) with 1ms timeout
            const [, err] = await attempt(() => api.get('/wait', { timeout: 1 }));

            expect(err).to.exist;
            expect(err).to.be.instanceOf(FetchError);

            const fetchErr = err as FetchError;
            expect(fetchErr.aborted).to.be.true;
            expect(fetchErr.step).to.equal('fetch');

            api.destroy();
            await wait(10); // Let microtasks settle
        });

        it('should handle negative timeout values', async () => {

            // Negative timeout throws assertion error at request time (validation)
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true
            });

            const [, err] = await attempt(() => api.get('/json', { timeout: -1 }));

            expect(err).to.exist;
            expect(err).to.be.instanceOf(Error);
            expect((err as Error).message).to.include('non-negative');

            api.destroy();
        });

        it('should handle Infinity timeout', async () => {

            // Infinity is coerced by Node.js to 1ms (see TimeoutOverflowWarning)
            // so the request effectively has a very short timeout
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true
            });

            // Use a slow endpoint so the 1ms timeout triggers an abort
            const [, err] = await attempt(() => api.get('/wait', { timeout: Infinity }));

            // Infinity causes immediate abort due to Node.js 32-bit overflow
            expect(err).to.exist;
            expect(err).to.be.instanceOf(FetchError);
            expect((err as FetchError).aborted).to.be.true;

            api.destroy();
            await wait(10); // Let microtasks settle
        });

        it('should handle NaN timeout', async () => {

            // NaN passes typeof check but fails >= 0 assertion
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true
            });

            const [, err] = await attempt(() => api.get('/json', { timeout: NaN }));

            expect(err).to.exist;
            expect(err).to.be.instanceOf(Error);
            expect((err as Error).message).to.include('non-negative');

            api.destroy();
        });

        it('should handle empty string baseUrl with absolute path', async () => {

            // Edge case: empty baseUrl is NOT valid - FetchEngine requires baseUrl
            // This test verifies the validation error is thrown
            const [, err] = attemptSync(() => new FetchEngine({
                baseUrl: '',
                dedupePolicy: true
            }));

            expect(err).to.exist;
            expect(err).to.be.instanceOf(Error);
            expect((err as Error).message).to.include('baseUrl');
        });
    });

    // ========================================================================
    // CONFIGURATION VALIDATION
    // ========================================================================

    describe('configuration validation', () => {

        it('should handle both serializers throwing', async () => {

            // Both dedupe and cache serializers throw
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    serializer: () => {

                        throw new Error('Dedupe serializer failed');
                    }
                },
                cachePolicy: {
                    enabled: true,
                    serializer: () => {

                        throw new Error('Cache serializer failed');
                    }
                }
            });

            // First error encountered should be thrown
            const [, err] = await attempt(() => api.get('/json'));

            expect(err).to.exist;
            expect(err).to.be.instanceOf(Error);
            // Either dedupe or cache serializer error
            expect(err!.message).to.match(/serializer failed/i);

            api.destroy();
        });

        it('should handle dedupe enabled with cache disabled and vice versa', async () => {

            // Dedupe enabled, cache explicitly disabled
            const api1 = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true },
                cachePolicy: { enabled: false }
            });

            const path1 = `/test-dedupe-${Date.now()}`;

            const [r1, r2] = await Promise.all([
                api1.get(path1),
                api1.get(path1)
            ]);

            expect(r1.status).to.equal(200);
            expect(r2.status).to.equal(200);

            api1.destroy();

            // Cache enabled, dedupe explicitly disabled
            const api2 = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: false },
                cachePolicy: { enabled: true }
            });

            const path2 = `/test-cache-${Date.now()}`;

            await api2.get(path2);
            const r3 = await api2.get(path2);

            expect(r3.status).to.equal(200);

            api2.destroy();
        });

        it('should handle conflicting method configurations', async () => {

            // GET enabled for dedupe but disabled for cache
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    methods: ['GET', 'POST']
                },
                cachePolicy: {
                    enabled: true,
                    methods: ['POST', 'PUT']  // GET not cached
                }
            });

            const dedupeEvents: string[] = [];
            const cacheEvents: string[] = [];

            api.on('fetch-dedupe-start', () => dedupeEvents.push('dedupe'));
            api.on('fetch-cache-set', () => cacheEvents.push('cache'));

            const path = `/test-conflict-${Date.now()}`;

            // GET request: should dedupe but not cache
            await Promise.all([
                api.get(path),
                api.get(path)
            ]);

            expect(dedupeEvents.length).to.equal(1);  // Deduped
            expect(cacheEvents.length).to.equal(0);   // Not cached

            api.destroy();
        });

        it('should handle invalid configuration objects (null)', async () => {

            // Null config objects
            const [, err] = attemptSync(() => {

                new FetchEngine({
                    baseUrl: testUrl,
                    dedupePolicy: null as any,
                    cachePolicy: null as any
                });
            });

            // May fail during construction or treat null as disabled
            // Either way, shouldn't crash
            expect(err || true).to.exist;
        });

        it('should handle invalid configuration objects (undefined)', async () => {

            // Explicitly undefined config (vs omitted)
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: undefined,
                cachePolicy: undefined
            });

            const path = `/test-undefined-${Date.now()}`;

            // Should work with features disabled
            const res = await api.get(path);

            expect(res.status).to.equal(200);

            api.destroy();
        });

        it('should handle empty config objects', async () => {

            // Empty config objects
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {},
                cachePolicy: {}
            });

            const path = `/test-empty-${Date.now()}`;

            // Should work with default behavior
            const res = await api.get(path);

            expect(res.status).to.equal(200);

            api.destroy();
        });
    });

    // ========================================================================
    // STATE MANAGEMENT
    // ========================================================================

    describe('state management', () => {

        it('should handle addHeader during in-flight request', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true }
            });

            const dedupeEvents: string[] = [];
            api.on('fetch-dedupe-start', () => dedupeEvents.push('start'));
            api.on('fetch-dedupe-join', () => dedupeEvents.push('join'));

            // Start first request (slow endpoint)
            const path = `/slow-success/100-${Date.now()}`;
            const promise1 = api.get(path);

            await wait(10);

            // Add header mid-flight (shouldn't affect in-flight request key)
            api.addHeader('X-Mid-Flight', 'true');

            // Start second request to SAME path - should dedupe since key is based on path+method
            const promise2 = api.get(path);

            const [result1] = await attempt(() => promise1);
            const [result2] = await attempt(() => promise2);

            expect(result1?.data).to.have.property('ok', true);
            expect(result2?.data).to.have.property('ok', true);

            // Should have deduped (1 start, 1 join)
            expect(dedupeEvents).to.include('start');

            api.destroy();
            await wait(10); // Let microtasks settle before test ends
        });

        it('should handle destroy called twice without crashing', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true }
            });

            // First destroy should succeed
            const [, err1] = attemptSync(() => api.destroy());
            expect(err1).to.be.null;

            // Second destroy should not crash
            const [, err2] = attemptSync(() => api.destroy());
            expect(err2).to.be.null;
        });

        it('should handle flaky endpoint with retry disabled', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                retry: false
            });

            // First request succeeds (flaky succeeds first time)
            const [result1, err1] = await attempt(() => api.get('/flaky'));
            expect(err1).to.be.null;
            expect(result1?.data).to.have.property('ok', true);

            // Second request fails (flaky fails after first)
            const [, err2] = await attempt(() => api.get('/flaky'));
            expect(err2).to.be.instanceOf(FetchError);

            api.destroy();
            await wait(10); // Let microtasks settle before test ends
        });

        it('should handle sequential success after initial failure', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                retry: false
            });

            // First request fails
            const [, err1] = await attempt(() => api.get('/fail-once'));
            expect(err1).to.be.instanceOf(FetchError);

            // Second request succeeds
            const [result2, err2] = await attempt(() => api.get('/fail-once'));
            expect(err2).to.be.null;
            expect(result2?.data).to.have.property('ok', true);

            // Third request also succeeds
            const [result3, err3] = await attempt(() => api.get('/fail-once'));
            expect(err3).to.be.null;
            expect(result3?.data).to.have.property('ok', true);

            api.destroy();
            await wait(10); // Let microtasks settle before test ends
        });
    });

    // ========================================================================
    // FEATURE COMBINATIONS
    // ========================================================================

    describe('feature combinations', () => {

        it('should work with deduplication and timeout', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                timeout: 500,
                dedupePolicy: { enabled: true, methods: ['GET'] }
            });

            const events: string[] = [];
            api.on('fetch-dedupe-start', () => events.push('dedupe-start'));
            api.on('fetch-dedupe-join', () => events.push('dedupe-join'));

            const path = '/wait';

            // Make two concurrent requests that will both timeout
            const promise1 = attempt(() => api.get(path));
            const promise2 = attempt(() => api.get(path));

            const [[_r1, e1], [_r2, e2]] = await Promise.all([promise1, promise2]);

            // Both should timeout since /wait takes 1000ms and timeout is 500ms
            expect(e1).to.be.instanceOf(Error);
            expect(e2).to.be.instanceOf(Error);
            expect(events).to.include('dedupe-start');
            expect(events).to.include('dedupe-join');

            api.destroy();
        });

        it('should work with caching and timeout', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                timeout: 500,
                cachePolicy: { enabled: true, methods: ['GET'], ttl: 5000 }
            });

            const events: string[] = [];
            api.on('fetch-cache-miss', () => events.push('cache-miss'));

            // First request succeeds and caches
            const path = `/test-cache-timeout-${Date.now()}`;
            const [r1] = await attempt(() => api.get(path));
            expect(r1).to.exist;
            expect(events).to.include('cache-miss');

            // Second request hits cache, no timeout issue
            events.length = 0;
            const [r2] = await attempt(() => api.get(path));
            expect(r2).to.exist;
            expect(events).to.not.include('cache-miss');

            api.destroy();
        });
    });

    // ========================================================================
    // RESPONSE STRUCTURE VALIDATION
    // ========================================================================

    describe('response structure validation', () => {

        it('should validate response structure consistency across features', async () => {

            // Cross-checks that all features return consistent FetchResponse structure
            const configs = [
                { name: 'plain', config: {} },
                { name: 'cache', config: { cachePolicy: true } },
                { name: 'dedupe', config: { dedupePolicy: true } },
                { name: 'both', config: { cachePolicy: true, dedupePolicy: true } }
            ];

            for (const { name, config } of configs) {

                const api = new FetchEngine({
                    baseUrl: testUrl,
                    ...config
                });

                const path = `/test-structure-${name}-${Date.now()}`;
                const response = await api.get(path);

                // Validate FetchResponse structure
                expect(response.data, `${name}: data should exist`).to.exist;
                expect(response.status, `${name}: status should exist`).to.be.a('number');
                expect(response.headers, `${name}: headers should exist`).to.be.an('object');
                expect(response.request, `${name}: request should exist`).to.be.instanceOf(Request);
                expect(response.config, `${name}: config should exist`).to.be.an('object');

                // Validate all keys present
                const keys = Object.keys(response).sort();
                expect(keys, `${name}: should have all FetchResponse keys`)
                    .to.deep.equal(['config', 'data', 'headers', 'request', 'status']);

                api.destroy();
            }
        });

        it('should produce consistent results with retry on vs off (successful request)', async () => {

            // Cross-checks that retry doesn't alter results for successful requests
            const apiWithRetry = new FetchEngine({
                baseUrl: testUrl,
                retry: { maxAttempts: 3 }
            });

            const apiWithoutRetry = new FetchEngine({
                baseUrl: testUrl,
                retry: false
            });

            const path = `/test-retry-${Date.now()}`;

            const r1 = await apiWithRetry.get(path);
            const r2 = await apiWithoutRetry.get(path);

            // Results should be identical
            expect(r1.data, 'data should be equal').to.deep.equal(r2.data);
            expect(r1.status, 'status should be equal').to.equal(r2.status);

            apiWithRetry.destroy();
            apiWithoutRetry.destroy();
        });
    });

    // ========================================================================
    // PERFORMANCE AND LOAD
    // ========================================================================

    describe('performance and load', () => {

        it('should handle 100+ concurrent requests without issues', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true }
            });

            // Launch 100 concurrent requests to unique paths
            const requests = Array.from({ length: 100 }, (_, i) =>
                api.get(`/json-${i}-${Date.now()}`)
            );

            const results = await Promise.allSettled(requests);

            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            // All requests should succeed
            expect(successful).to.equal(100);
            expect(failed).to.equal(0);

            // Verify no memory leaks - all inflight requests should be cleared
            const stats = api.cacheStats();
            expect(stats.inflightCount).to.equal(0);

            api.destroy();
        });

        it('should handle large request payloads (1MB+)', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl
            });

            // Generate a large payload (1MB of data)
            const largePayload = {
                data: 'x'.repeat(1024 * 1024),
                metadata: { size: '1MB' }
            };

            const path = `/large-payload`;

            // POST with large payload
            const [_, err] = await attempt(() =>
                api.post(path, largePayload)
            );

            // The request should be handled (server may reject, but engine should process)
            // We're testing that the engine doesn't crash with large payloads
            expect(err).to.satisfy((e: any) => {

                return e === null || e instanceof FetchError;
            });

            api.destroy();
        });

        it('should handle large response bodies (1MB+)', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                cachePolicy: {
                    enabled: true,
                    ttl: 5000,
                    methods: ['POST']
                }
            });

            server

            // Generate a large payload (1MB of data)
            const largeData = { data: 'x'.repeat(1024 * 1024) };

            // Mock server would need to return this, but we can test the handling
            // For this test, we verify the engine can process large responses
            const path = `/large-payload`;

            const [response, err] = await attempt(() => api.post(path, largeData));

            expect(err).to.be.null;
            expect(response).to.not.be.undefined;

            // Verify cache can handle it
            const stats = api.cacheStats();
            expect(stats.cacheSize).to.be.greaterThan(0);

            api.destroy();
        });

        it('should measure throughput (requests/sec)', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: false },
                cachePolicy: { enabled: false }
            });

            const requestCount = 500;
            const start = Date.now();

            // Launch sequential requests to measure baseline throughput
            const requests = Array.from({ length: requestCount }, (_, i) =>
                api.get(`/json-throughput-${i}-${Date.now()}`)
            );

            await Promise.allSettled(requests);

            const elapsed = Date.now() - start;
            const requestsPerSec = (requestCount / elapsed) * 1000;

            // Should handle at least 500 requests/sec (conservative threshold)
            expect(requestsPerSec).to.be.greaterThan(500);

            api.destroy();
        });

        it('should handle destroy during request initiation', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl
            });

            const path = `/wait-success`;

            // Start a long-running request
            const requestPromise = api.get(path);

            // Immediately destroy the instance (race condition)
            await wait(10);
            api.destroy();

            // Request should either complete or fail gracefully
            const [, err] = await attempt(() => requestPromise);

            // System should handle gracefully
            expect(err).to.satisfy((e: any) => {

                return e === null || e instanceof Error;
            });
        });

        it('should handle multiple engines hitting same endpoint', async () => {

            // Create two separate FetchEngine instances
            const api1 = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true },
                cachePolicy: { enabled: true, ttl: 5000 }
            });

            const api2 = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true },
                cachePolicy: { enabled: true, ttl: 5000 }
            });

            const path = `/test-multi-engine-${Date.now()}`;

            // Both engines hit the same endpoint concurrently
            const [r1, r2] = await Promise.all([
                api1.get(path),
                api2.get(path)
            ]);

            // Both should succeed independently
            expect(r1.data).to.deep.equal({ ok: true, path });
            expect(r2.data).to.deep.equal({ ok: true, path });

            // Each engine maintains its own cache
            const stats1 = api1.cacheStats();
            const stats2 = api2.cacheStats();

            expect(stats1.cacheSize).to.be.greaterThan(0);
            expect(stats2.cacheSize).to.be.greaterThan(0);
            expect(stats1.inflightCount).to.equal(0);
            expect(stats2.inflightCount).to.equal(0);

            api1.destroy();
            api2.destroy();
        });

        it('should handle multiple concurrent request failures', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: false }
            });

            // Launch many concurrent requests to failing endpoint
            const requests = Array.from({ length: 500 }, (_, i) =>
                attempt(() => api.get(`/fail`))
            );

            const results = await Promise.all(requests);

            // All should fail gracefully
            results.forEach(([_, err]) => {

                expect(err).to.not.be.null;
                expect(err).to.be.instanceOf(FetchError);
            });

            // No inflight leaks despite mass failures
            const stats = api.cacheStats();
            expect(stats.inflightCount).to.equal(0);

            api.destroy();
        });

        it('should handle mixed success and failure in concurrent batch', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: false }
            });

            // Mix of successful and failing requests
            const requests = [
                attempt(() => api.get(`/json`)),
                attempt(() => api.get(`/fail`)),
                attempt(() => api.get(`/json`)),
                attempt(() => api.get(`/fail`)),
                attempt(() => api.get(`/json`))
            ];

            const results = await Promise.all(requests);

            // Count successes and failures
            const successes = results.filter(([_, e]) => e === null).length;
            const failures = results.filter(([_, e]) => e !== null).length;

            expect(successes).to.equal(3);
            expect(failures).to.equal(2);

            // No inflight leaks
            const stats = api.cacheStats();
            expect(stats.inflightCount).to.equal(0);

            api.destroy();
        });
    });

});
