import { EventEmitter } from 'node:stream';
import { describe, it, before, beforeEach, after, afterEach } from 'node:test'

// @ts-expect-error - chai is not a module
import { expect } from 'chai';

import Sinon from 'sinon';
import { Bench } from '@hapi/hoek';

import { ObserverEngine } from '../../packages/observer/src/index.ts';

const skip = process.env.CI;

describe('Benchmarks', { skip }, () => {

    const listener = Sinon.spy();

    const store = {
        EventEmitter: 0,
        ObserverEngine: 0
    }

    const benchmarkTime = 1000;
    const benchmark = (emitter: any) => {

        emitter.on('event', listener);

        const bench = new Bench();

        while (bench.elapsed() < benchmarkTime) {
            emitter.emit('event');
        }
    };

    const timeout = benchmarkTime * 1.1;

    beforeEach(() => listener.resetHistory());

    after(() => {

        const { EventEmitter, ObserverEngine } = store;

        const evVsObs = 100 - Math.round(EventEmitter / ObserverEngine * 100);
        const obsVsEv = 100 - Math.round(ObserverEngine / EventEmitter * 100);

        if (evVsObs > 0) {
            console.log('ObserverEngine is', evVsObs, '% faster than EventEmitter');
        }
        else {
            console.log('EventEmitter is', obsVsEv, '% faster than ObserverEngine');
        }
    });

    it('benchmarks event emitter', { timeout }, function () {

        benchmark(new EventEmitter());

        store.EventEmitter = listener.callCount;
    });

    it('benchmarks ObserverEngine', { timeout }, function () {

        benchmark(new ObserverEngine());

        store.ObserverEngine = listener.callCount;
    });
});