import { EventEmitter } from 'node:stream';
import { describe, it, before, beforeEach, after, afterEach } from 'node:test'

import { expect } from 'chai';
import Sinon from 'sinon';
import { Bench } from '@hapi/hoek';
import { ObserverFactory } from '@logos-ui/observer';

const skip = process.env.CI;

describe('Benchmarks', { skip }, () => {

    const listener = Sinon.spy();

    const store = {
        EventEmitter: 0,
        ObserverFactory: 0
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

        console.log('EventEmitter:', store.EventEmitter);
        console.log('ObserverFactory:', store.ObserverFactory);

        const { EventEmitter, ObserverFactory } = store;

        const evVsObs = 100 - Math.round(EventEmitter / ObserverFactory * 100);
        const obsVsEv = 100 - Math.round(ObserverFactory / EventEmitter * 100);

        if (evVsObs > 0) {
            console.log('ObserverFactory is', evVsObs, '% faster than EventEmitter');
        }
        else {
            console.log('EventEmitter is', obsVsEv, '% faster than ObserverFactory');
        }
    });

    it('benchmarks event emitter', { timeout }, function () {

        benchmark(new EventEmitter());

        store.EventEmitter = listener.callCount;
    });

    it('benchmarks ObserverFactory', { timeout }, function () {

        benchmark(new ObserverFactory());

        store.ObserverFactory = listener.callCount;
    });
});