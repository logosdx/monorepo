/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "http://localhost"}
 */

import Sinon, { SinonSpiedInstance, SinonSpy } from 'sinon';
import { expect } from 'chai';

import Hapi, { Lifecycle, ResponseToolkit } from '@hapi/hapi';
import Boom from '@hapi/boom';

import { FetchError, FetchEvent, FetchFactory, FetchHeaders, FetchReqOpts, RequestHeaders } from '@logos-ui/fetch';

const mkHapiRoute = (path: string, handler: Lifecycle.Method) => ({ method: '*', path, handler })
const wait = (n: number, r: any = 'ok') => new Promise(res => setTimeout(() => res(r), n));

describe('@logos-ui/fetch', () => {

    const callStub = Sinon.stub<[Hapi.Request]>();
    const testUrl = 'http://localhost:3456';
    const server = Hapi.server({ port: 3456 });

    let throwBadContentType = false;

    server.ext('onRequest', (_, h) => {

        if (throwBadContentType) {
            return h.response(
                null as any
            ).header(
                'content-type',
                'habibti/allah'
            ).takeover()
        }

        return h.continue;
    });

    server.route(
        [
            mkHapiRoute('/json{n?}', (req) => { callStub(req); return { ok: true }; }),
            mkHapiRoute('/fail', () => { return Boom.badRequest(); }),
            mkHapiRoute('/wait', () => wait(1000, 'ok')),
            mkHapiRoute('/drop', (_, h) => h.close),
            mkHapiRoute('/abandon', (_, h) => h.abandon),
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
        const type = 'json';


        expect(() => new FetchFactory({} as any)).to.throw(/baseUrl.+required/);
        expect(() => new FetchFactory({ baseUrl: ':p' } as any)).to.throw(/type.+required/);
        expect(() => new FetchFactory({ baseUrl: ':p', type } as any)).to.throw(/invalid url/i);
        expect(() => new FetchFactory({ baseUrl, type: ':p' } as any)).to.throw(/invalid type/i);
    });

    it('accepts a proper config', () => {

        const api = new FetchFactory({
            baseUrl: testUrl,
            type: 'json'
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

        const api = new FetchFactory({
            baseUrl: testUrl,
            type: 'json'
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

        const api = new FetchFactory({
            baseUrl: testUrl,
            type: 'json',
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

    it('sets and removes headers', async () => {

        const api = new FetchFactory({
            baseUrl: testUrl,
            type: 'json'
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

        const api = new FetchFactory({
            baseUrl: testUrl,
            type: 'json'
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

    it('sends payloads', async () => {

        const payload = { pay: 'load' };
        const expectedPayload = JSON.stringify(payload);

        const api = new FetchFactory({
            baseUrl: testUrl,
            type: 'json'
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

        const didError = Sinon.stub();
        const didBefore = Sinon.stub();
        const didAfter = Sinon.stub();

        const api = new FetchFactory({
            baseUrl: testUrl,
            type: 'json'
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
        expect(errArgs.data.message).to.contain(errRes.message);
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

        const onError = Sinon.stub();
        throwBadContentType = true;

        const api = new FetchFactory({
            baseUrl: testUrl,
            type: 'json',
            headers: {
                'content-type': 'application/json'
            }
        });

        try { await api.get('/json', { onError }); }
        catch(e) {}

        const [[dropReq]] = onError.args as [[FetchError]];
        expect(dropReq.status).to.equal(999);

        throwBadContentType = false;
    });

    it('status code 997 for missing content type', async () => {

        const onError = Sinon.stub();

        const api = new FetchFactory({
            baseUrl: testUrl,
            type: 'json',
        });

        try { await api.get('/drop', { onError }); }
        catch(e) {}

        const [[dropReq]] = onError.args as [[FetchError]];
        expect(dropReq.status).to.equal(997);

        throwBadContentType = false;
    });

    it('can abort requests', async () => {

        const onError = Sinon.stub();
        const onBeforeReq = (opts: FetchReqOpts) => {

            setTimeout(() => {

                opts.controller.abort();
            }, 10);
        }

        const api = new FetchFactory({
            baseUrl: testUrl,
            type: 'json',
        });

        try { await api.get('/wait', { onError, onBeforeReq }); }
        catch (e) {}

        const [[errArgs]] = onError.args as [[FetchError]];
        expect(errArgs.status).to.equal(998);
    });

    it('can timeout requests', async () => {

        const onError = Sinon.stub();
        const timeout = 100;

        const api = new FetchFactory({
            baseUrl: testUrl,
            type: 'json',
            timeout
        });

        const now = () => +(new Date());

        let pre = now();

        try { await api.get('/wait', { onError }); }
        catch (e) {}

        let post = now();

        expect(post - pre).to.lessThan(timeout + 30)


        pre = now();

        try { await api.get('/wait', { onError, timeout: 10 }); }
        catch (e) {}

        post = now();

        expect(post - pre).to.lessThan(timeout + 30)

        const [[configWait],[reqWait]] = onError.args as [[FetchError], [FetchError]];

        expect(configWait.status).to.equal(998);
        expect(reqWait.status).to.equal(998);

    });

    it('can make options', async () => {

        const api = new FetchFactory({
            baseUrl: testUrl,
            type: 'json',
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

    it('can set a state for use in make options', async () => {

        type TestState = {
            theValue: string;
        }

        const api = new FetchFactory <TestState>({
            baseUrl: testUrl,
            type: 'json',
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

        const listener = Sinon.stub();

        const headers: RequestHeaders = {
            "content-type": 'application/json',
            authorization: 'weeee'
        }

        const state = {};

        const api = new FetchFactory<any>({
            baseUrl: testUrl,
            type: 'json',
            headers
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
        (state as any).flowers = true;

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
            evResetState,
            evSetState,
            evAddHeader,
            evRmHeader,
            evChangeUrl
        ];

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

        api.setState(state);
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

});
