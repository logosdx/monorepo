/**
 * @jest-environment jsdom
 * @jest-environment-options {'url': 'http://localhost'}
 */
import {
    describe,
    it,
    before,
    beforeEach,
    after,
    afterEach
} from 'node:test'

// @ts-expect-error - chai is not a module
import { expect } from 'chai';

import Hapi, { Lifecycle } from '@hapi/hapi';
import Boom from '@hapi/boom';
import Hoek from '@hapi/hoek';
import Joi from 'joi';

import {
    FetchError,
    FetchEvent,
    FetchEngine
} from '../../packages/fetch/src/index.ts';

import { attempt } from '../../packages/utils/src/index.ts';

import { sandbox, log } from './_helpers';

const mkHapiRoute = (
    path: string,
    handler: Lifecycle.Method,
    options: Hapi.RouteOptions = {}
) => ({
    method: '*' as const,
    path,
    handler,
    options
});
const wait = (n: number, r: any = 'ok') => new Promise(res => setTimeout(() => res(r), n));

describe('@logosdx/fetch', () => {

    const callStub = sandbox.stub<[Hapi.Request]>();
    const testUrl = 'http://localhost:3456';
    const server = Hapi.server({ port: 3456 });

    server.route(
        [
            mkHapiRoute('/bad-content-type', (_, h) => h.response().header('content-type', 'habibti/allah')),
            mkHapiRoute('/json{n?}', (req) => { callStub(req); return { ok: true }; }),
            mkHapiRoute('/fail', () => { return Boom.badRequest('message', { the: 'data' }); }),
            mkHapiRoute('/wait', () => wait(1000, 'ok')),
            mkHapiRoute('/drop', (_, h) => h.close),
            mkHapiRoute('/abandon', (_, h) => h.abandon),
            mkHapiRoute('/empty', () => { return null; }),
            mkHapiRoute('/empty2', (_, h) => { return h.response().code(204); }),

            mkHapiRoute('/validate', () => 'ok', {
                validate: {
                    query: Joi.object({
                        name: Joi.string().required(),
                        age: Joi.number().min(18).max(65)
                    }),
                    failAction: async (req, h, err) => {

                        if (err) {

                            return err;
                        }

                        if ((req as unknown as Boom.Boom).isBoom) {

                            return req;
                        }

                        return h.continue;
                    }
                },
            }),
        ]
    );

    before(async () => {

        await server.start();
    });

    after(async () => {

        await server.stop();
    });

    beforeEach(() => callStub.reset());


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
        opts.formatHeaders = 'not a function';
        test(/formatHeaders must be/i);

        opts.formatHeaders = true;
        test(/formatHeaders must be/i);
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
            formatHeaders: (h) => h,
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

        expect(await api.get('/json')).to.contain(expectation);
        expect(await api.post('/json')).to.contain(expectation);
        expect(await api.patch('/json')).to.contain(expectation);
        expect(await api.put('/json')).to.contain(expectation);
        expect(await api.delete('/json')).to.contain(expectation);
        expect(await api.options('/json')).to.contain(expectation);
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

        expect(await api.get('/json')).to.contain(expectation);

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

            return fn.call(api, '/json').catch(Hoek.ignore);
        };

        await anyReq('get');
        await anyReq('delete');
        await anyReq('patch');
        await anyReq('options');
        await anyReq('post');
        await anyReq('put');

        const calls = onReq.getCalls().map(
            c => (c.args[0] as FetchEvent).headers
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

            return fn.call(api, '/json').catch(Hoek.ignore);
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
            retryConfig: {
                maxAttempts: 0
            }
        });

        const errRes = {
            message: 'Bad Request',
            statusCode: 400
        };

        try {
            await api.get('/fail', {
                onAfterReq: didAfter,
                onBeforeReq: didBefore,
                onError: didError
            });
        }
        catch (e) {}

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

    it('status code 999 for unhandled errors', async () => {

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

            return fn.call(api, '/json').catch(Hoek.ignore);
        };

        await anyReq('get');
        await anyReq('delete');

        expect(modifyOptions.called).to.be.false;

        await anyReq('post');
        await anyReq('put');

        expect(modifyOptions.calledTwice).to.be.true;

        await anyReq('patch');

        expect(modifyOptions.calledTwice).to.be.true;

        const calls = onReq.getCalls().map(
            c => (c.args[0] as FetchEvent).headers
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
            headers,
            formatHeaders: false
        });

        api.on('*', listener);

        const assertNonRemoteEv = (ev: FetchEvent) => {

            expect(ev.state, `${ev.type} state`).to.exist;
            expect(ev.state, `${ev.type} specific state`).to.contain(state);
        }

        const assertRemoteEv = (
            path: string,
            method: string,
            ev: FetchEvent
        ) => {

            assertNonRemoteEv(ev);

            expect(ev.method, `${ev.type} method`).to.exist;
            expect(ev.url, `${ev.type} url`).to.exist;
            expect(ev.headers, `${ev.type} headers`).to.exist;

            expect(ev.url, `${ev.type} specific url`).to.eq(`${testUrl}${path}`);
            expect(ev.method, `${ev.type} specific method`).to.eq(method);
            expect(ev.headers, `${ev.type} specific headers`).to.contain(headers);
        }

        /**
         * Test Error events
         */

        try { await api.get('/fail'); }
        catch (e) {}

        expect(listener.calledThrice).to.be.true

        const [[evBefore1], [evAfter1], [evError1]] = listener.args as [[FetchEvent],[FetchEvent],[FetchEvent]];

        expect(evBefore1.type).to.eq('fetch-before');
        expect(evAfter1.type).to.eq('fetch-after');
        expect(evError1.type).to.eq('fetch-error');

        for (const ev of [evBefore1, evAfter1, evError1] as FetchEvent[]) {

            assertRemoteEv('/fail', 'GET', ev);
        }

        /**
         * Test Abort events
         */

        listener.reset();

        try { await api.get('/wait', { timeout: 1 }); }
        catch (e) {}

        expect(listener.calledTwice).to.be.true

        const [[evBefore2], [evAbort2]] = listener.args as [[FetchEvent],[FetchEvent]];

        expect(evBefore2.type).to.eq('fetch-before');
        expect(evAbort2.type).to.eq('fetch-abort');

        for (const ev of [evBefore2, evAbort2] as FetchEvent[]) {

            assertRemoteEv('/wait', 'GET', ev);
        }

        /**
         * Test Successful events
         */
        listener.reset();

        const payload = { wee: true };
        await api.post('/json', payload);

        expect(listener.calledThrice).to.be.true

        const [[evBefore3], [evAfter3], [evResponse3]] = listener.args as [[FetchEvent],[FetchEvent],[FetchEvent]];

        expect(evBefore3.type).to.eq('fetch-before');
        expect(evAfter3.type).to.eq('fetch-after');
        expect(evResponse3.type).to.eq('fetch-response');

        for (const ev of [evBefore3, evAfter3, evResponse3] as FetchEvent[]) {

            assertRemoteEv('/json', 'POST', ev);
            expect(ev.payload, `${ev.type} payload`).to.exist;
            expect(ev.payload, `${ev.type} specific payload`).to.contain(payload);

        }

        expect(evResponse3.data, `${evResponse3.type} data`).to.contain({ ok: true });

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
            [evResetState],
            [evSetState],
            [evAddHeader],
            [evRmHeader],
            [evChangeUrl]
        ] = listener.args as [
            [FetchEvent],
            [FetchEvent],
            [FetchEvent],
            [FetchEvent],
            [FetchEvent]
        ];

        const evs = [
            evSetState,
            evAddHeader,
            evRmHeader,
            evChangeUrl
        ];

        expect(evResetState.state).to.exist;
        expect(evResetState.state).to.be.empty;

        for (const ev of evs as FetchEvent[]) {

            assertNonRemoteEv(ev);
        }

        expect(evResetState.type).to.eq('fetch-state-reset');
        expect(evSetState.type).to.eq('fetch-state-set');
        expect(evAddHeader.type).to.eq('fetch-header-add');
        expect(evRmHeader.type).to.eq('fetch-header-remove');
        expect(evChangeUrl.type).to.eq('fetch-url-change');

        /**
         * Test off event function
         */

        listener.reset();
        api.off('*', listener);

        expect(listener.called).to.be.false

        listener.reset();

        api.resetState();
        (state as any).flowers = true;

        api.setState({ flowers: true });
        api.addHeader({ wee: 'woo' });
        api.rmHeader(['wee']);
        api.changeBaseUrl(testUrl);

        await api.post('/json', payload);

        try { await api.get('/fail'); }
        catch (e) {}

        try { await api.get('/wait', { timeout: 1 }); }
        catch (e) {}

        expect(listener.called).to.be.false

    });

    it('handles empty responses', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
        });

        const res1 = await api.get('/empty');
        const res2 = await api.get('/empty2');

        expect(res1).to.be.null;
        expect(res2).to.be.null;
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

            res.ok === true;
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
            retryConfig: {
                maxAttempts: 0,
            }
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

    it('retries a configured number of requests', async () => {

        const onError = sandbox.stub();

        const api = new FetchEngine({
            baseUrl: testUrl + 1,
            retryConfig: {
                maxAttempts: 2,
                baseDelay: 10
            },
        });

        await attempt(() => api.get('/', { onError }))

        expect(onError.called).to.be.true;
        expect(onError.callCount).to.eq(2);

        const [[c1], [c2]] = onError.args as [[FetchError], [FetchError], [FetchError]];

        expect(c1.status).to.eq(499);
        expect(c2.status).to.eq(499);

        expect(c1.attempt).to.eq(1);
        expect(c2.attempt).to.eq(2);
    });

    const calculateDelay = (
        baseDelay: number,
        attempts: number,
    ) => {

        return Array.from(
            { length: attempts },
            (_, i) => baseDelay * Math.pow(2, i)
        )
        .reduce((a, b) => a + b, 0);
    }

    it('retries requests with exponential backoff', async () => {

        const baseDelay = 10;

        const api = new FetchEngine({
            baseUrl: testUrl + 1,
            retryConfig: {
                maxAttempts: 3,
                baseDelay,
                useExponentialBackoff: true,
            },
        });

        const start = Date.now();

        await attempt(() => api.get('/'))

        const end = Date.now();

        const calc = calculateDelay(baseDelay, 3);

        expect(end - start).to.be.greaterThan(calc);
    });

    it('retries requests with exponential backoff and max delay', async () => {

        const baseDelay = 10;

        const api = new FetchEngine({
            baseUrl: testUrl + 1,
            retryConfig: {
                maxAttempts: 5,
                baseDelay,
                useExponentialBackoff: true,
                maxDelay: 30,
            },
        });

        const start = Date.now();

        await attempt(() => api.get('/'))

        const end = Date.now();

        const calc = calculateDelay(baseDelay, 5);

        expect(end - start).to.be.lessThan(calc);
    });

    it('retries without exponential backoff', async () => {

        const baseDelay = 10;

        const api = new FetchEngine({
            baseUrl: testUrl + 1,
            retryConfig: {
                maxAttempts: 3,
                baseDelay,
                useExponentialBackoff: false,
            },
        });

        const start = Date.now();

        await attempt(() => api.get('/'))

        const end = Date.now();

        const calc = (baseDelay * 3) + 15; // Give some buffer

        expect(end - start).to.be.lessThan(calc);
    });

    it('retries on specific status codes', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            retryConfig: {
                maxAttempts: 3,
                baseDelay: 10,
                useExponentialBackoff: false,
                retryableStatusCodes: [400],
            },
        });

        const onError = sandbox.stub();

        api.on('fetch-error', onError);

        await attempt(() => api.get('/validate?name=&age=17'))

        expect(onError.called).to.be.true;
        expect(onError.callCount).to.eq(3);
    })

    it('retries with custom shouldRetry', async () => {

        const onError = sandbox.stub();
        const api = new FetchEngine({
            baseUrl: testUrl,
            retryConfig: {
                maxAttempts: 3,
                baseDelay: 10,
                useExponentialBackoff: false,
                shouldRetry: (error) => error.status === 400,
            },
        });

        api.on('fetch-error', onError);

        await attempt(() => api.get('/validate?name=&age=17'))

        expect(onError.called).to.be.true;
        expect(onError.callCount).to.eq(3);

        await attempt(() => api.get('/not-found'))

        expect(onError.callCount).to.eq(4);
    });

    it('retries with custom shouldRetry that returns a number', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            retryConfig: {
                maxAttempts: 3,
                baseDelay: 10,
                useExponentialBackoff: false,
                shouldRetry: (error) => {

                    if (error.status === 400) {

                        return 50;
                    }

                    return false;
                },
            },
        });

        const onError = sandbox.stub();

        api.on('fetch-error', onError);

        const start = Date.now();

        await attempt(() => api.get('/validate?name=&age=17'))

        expect(onError.called).to.be.true;
        expect(onError.callCount).to.eq(3);

        const end = Date.now();

        expect(end - start).to.be.greaterThan(149);
    });

    it('retries with custom baseDelay', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            retryConfig: {
                maxAttempts: 3,
                useExponentialBackoff: false,
                retryableStatusCodes: [400],
                baseDelay: (_, attempt) => {
                    if (attempt === 1) {
                        return 100;
                    }
                    return 10;
                },
            },
        });

        const onError = sandbox.stub();

        api.on('fetch-retry', onError);

        await attempt(() => api.get('/validate?name=&age=17'))

        expect(onError.called).to.be.true;
        expect(onError.callCount).to.eq(3);

        const [[c1], [c2], [c3]] = onError.args as [[FetchEvent], [FetchEvent], [FetchEvent]];

        expect(c1.delay).to.eq(100);
        expect(c2.delay).to.eq(10);
        expect(c3.delay).to.eq(10);
    });

    it('can configure a retry per request', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            retryConfig: {
                maxAttempts: 5,
                baseDelay: 20,
                useExponentialBackoff: true,
            },
        });

        const onError = sandbox.stub();

        const reqConfig: FetchEngine.CallOptions = {
            retryConfig: {
                maxAttempts: 2,
                baseDelay: 10,
                useExponentialBackoff: false,
                retryableStatusCodes: [400],
            },
            onError,
        }

        const start = Date.now();

        await attempt(() => api.get('/validate?name=&age=17', reqConfig))

        const end = Date.now();

        const calc = (10 * 2) + 20; // Give some buffer

        expect(end - start).to.be.lessThan(calc);

        expect(onError.called).to.be.true;
        expect(onError.callCount).to.eq(2);

        await attempt(() => api.get('/validate?name=&age=17', { onError }))

        expect(onError.callCount).to.eq(3);
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

});
