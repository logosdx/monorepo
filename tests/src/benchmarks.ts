import { EventEmitter } from 'node:stream';
import { describe, it, before, beforeEach, after, afterEach } from 'node:test'

// @ts-expect-error - chai is not a module
import { expect } from 'chai';

import Sinon from 'sinon';
import { Bench } from '@hapi/hoek';

import { ObserverEngine } from '../../packages/observer/src/index.ts';

const skip = process.env.CI;

describe('Benchmarks', { skip }, () => {

    const listeners = Array.from({ length: 500 }, () => Sinon.spy());

    const average = () => {

        const total = listeners.reduce((acc, listener) => acc + listener.callCount, 0);
        return Math.round(total / listeners.length);
    }

    const benchmarkTime = 1000;

    const benchmark = (emitter: any) => {

        listeners.forEach(listener => emitter.on('event', listener));

        const bench = new Bench();

        while (bench.elapsed() < benchmarkTime) {
            emitter.emit('event');
        }
    };

    const timeout = benchmarkTime * 1.1;

    class EventTargetShim extends EventTarget {

        on: EventTarget['addEventListener'];
        off: EventTarget['removeEventListener'];
        emit: (event: string, data: any) => boolean;

        constructor() {

            super();

            this.on = this.addEventListener;
            this.off = this.removeEventListener;
            this.emit = (event: string, data: any) => this.dispatchEvent(new CustomEvent(event, { detail: data }));
        }
    }

    const store = {
        EventEmitter: 0,
        ObserverEngine: 0,
        EventTarget: 0
    }

    beforeEach(() => listeners.forEach(listener => listener.resetHistory()));

    after(() => {

        const { EventEmitter, ObserverEngine, EventTarget } = store;

        const obsVsEv = 100 - Math.round(ObserverEngine / EventEmitter * 100);
        const obsVsTarget = 100 - Math.round(ObserverEngine / EventTarget * 100);

        const entries = Object.entries(store);
        const sorted = entries.sort((a, b) => b[1] - a[1]);

        const sym = (n: number) => {
            if (n > 0) return '+' + n;
            if (n < 0) return '-' + Math.abs(n);
            return '';
        }

        console.log(
            JSON.stringify(
                {
                    fastest: `${sorted[0]![0]} emits ${sorted[0]![1]} ops/s`,
                    slowest: `${sorted[2]![0]} emits ${sorted[2]![1]} ops/s`,
                    diff: {
                        EventEmitter: `${sym(sorted[0]![1] - ObserverEngine)} ops/s`,
                        EventTarget: `${sym(sorted[2]![1] - ObserverEngine)} ops/s`,
                    },
                    opsPerSecond: {
                        EventEmitter,
                        ObserverEngine,
                        EventTarget,
                    },
                    percent: {
                        EventEmitter: `${sym(obsVsEv)}%`,
                        EventTarget: `${sym(obsVsTarget)}%`,
                    }
                },
                null, 4
            )
                .replaceAll('"', '')
                .replaceAll('{', '')
                .replaceAll('}', '')
                .replaceAll(',', '')
                .replaceAll('"', '')
        );
    });

    it('benchmarks event emitter', { timeout }, function () {

        benchmark(new EventEmitter());

        store.EventEmitter = average();
    });

    it('benchmarks ObserverEngine', { timeout }, function () {

        benchmark(new ObserverEngine());

        store.ObserverEngine = average();
    });

    it('benchmarks EventTarget', { timeout }, function () {

        benchmark(new EventTargetShim());

        store.EventTarget = average();
    });
});