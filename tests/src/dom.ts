import { describe, it, before, beforeEach, after, afterEach } from 'node:test'

import { expect } from 'chai';
import Sinon from 'sinon';

import * as Lib from '../../packages/dom/src/index.ts';
import { CssPropNames, CssProps } from '../../packages/dom/src/index.ts';
import { MutationObserverUnavailableError } from '../../packages/dom/src/behaviors.ts';

import { sandbox } from './_helpers';

const document = window.document;

const { html, $ } = Lib;

const stub: {
    sampleCss?: CssProps
} = {};

describe('@logosdx/dom', () => {

    describe('Viewport', function () {

        it('scrollbarWidth is a number', function () {
            const result = Lib.scrollbarWidth();
            expect(typeof result).to.equal('number');
            expect(Number.isNaN(result)).to.equal(false);
        });

        it('documentHeight is a number', function () {
            const result = Lib.documentHeight();
            expect(typeof result).to.equal('number');
            expect(Number.isNaN(result)).to.equal(false);
        });

        it('documentWidth is a number', function () {
            const result = Lib.documentWidth();
            expect(typeof result).to.equal('number');
            expect(Number.isNaN(result)).to.equal(false);
        });

        it('scrollTop is a number', function () {
            const result = Lib.scrollTop();
            expect(typeof result).to.equal('number');
            expect(Number.isNaN(result)).to.equal(false);
        });

        it('scrollLeft is a number', function () {
            const result = Lib.scrollLeft();
            expect(typeof result).to.equal('number');
            expect(Number.isNaN(result)).to.equal(false);
        });

        it('elementOffsetTop is a number', function () {
            const div = document.createElement('div')
            const result = Lib.elementOffsetTop(div);
            expect(typeof result).to.equal('number');
            expect(Number.isNaN(result)).to.equal(false);
        });

        it('elementOffsetLeft is a number', function () {
            const div = document.createElement('div')
            const result = Lib.elementOffsetLeft(div);
            expect(typeof result).to.equal('number');
            expect(Number.isNaN(result)).to.equal(false);
        });

        it('should return a positive number in viewportWidth', function () {

            const result = Lib.viewportWidth();
            expect(typeof result).to.equal('number');
            expect(Number.isNaN(result)).to.equal(false);
            expect(result).to.be.greaterThan(0);
        });

        it('should return a positive number in viewportHeight', function () {

            const result = Lib.viewportHeight();
            expect(typeof result).to.equal('number');
            expect(Number.isNaN(result)).to.equal(false);
            expect(result).to.be.greaterThan(0);
        });

        describe('devicePixelRatio', function () {

            it('should return a positive number', function () {

                const result = Lib.devicePixelRatio();
                expect(typeof result).to.equal('number');
                expect(Number.isNaN(result)).to.equal(false);
                expect(result).to.be.greaterThan(0);
            });

            it('should return actual devicePixelRatio when available', function () {

                const mockRatio = 2.5;
                const originalRatio = global.window?.devicePixelRatio;

                if (global.window) {

                    (global.window as any).devicePixelRatio = mockRatio;
                }

                const result = Lib.devicePixelRatio();
                expect(result).to.equal(mockRatio);

                if (global.window && originalRatio !== undefined) {

                    (global.window as any).devicePixelRatio = originalRatio;
                }
            });
        });

        describe('scrollProgress', function () {

            it('should return a percentage between 0 and 100', function () {

                const result = Lib.scrollProgress();
                expect(result).to.be.greaterThanOrEqual(0);
                expect(result).to.be.lessThanOrEqual(100);
            });

            it('should handle element scroll progress', function () {

                const div = document.createElement('div');

                // Mock scrollable properties for JSDOM
                Object.defineProperties(div, {
                    scrollTop: { value: 0, writable: true },
                    scrollHeight: { value: 300, writable: true },
                    clientHeight: { value: 100, writable: true }
                });

                // Should be 0 at top
                div.scrollTop = 0;
                expect(Lib.scrollProgress(div)).to.equal(0);

                // Should be 50 at middle
                div.scrollTop = 100;
                const midProgress = Lib.scrollProgress(div);
                expect(midProgress).to.be.approximately(50, 1);
            });

            it('should return 0 for non-scrollable element', function () {

                const div = document.createElement('div');

                // Mock non-scrollable properties
                Object.defineProperties(div, {
                    scrollTop: { value: 0, writable: true },
                    scrollHeight: { value: 100, writable: true },
                    clientHeight: { value: 100, writable: true }
                });

                const result = Lib.scrollProgress(div);
                expect(result).to.equal(0);
            });
        });

        describe('horizontalScrollProgress', function () {

            it('should return a percentage between 0 and 100', function () {

                const result = Lib.horizontalScrollProgress();
                expect(result).to.be.greaterThanOrEqual(0);
                expect(result).to.be.lessThanOrEqual(100);
            });

            it('should handle element horizontal scroll progress', function () {

                const div = document.createElement('div');

                // Mock scrollable properties for JSDOM
                Object.defineProperties(div, {
                    scrollLeft: { value: 0, writable: true },
                    scrollWidth: { value: 300, writable: true },
                    clientWidth: { value: 100, writable: true }
                });

                // Should be 0 at left
                div.scrollLeft = 0;
                expect(Lib.horizontalScrollProgress(div)).to.equal(0);

                // Should be 50 at middle
                div.scrollLeft = 100;
                const midProgress = Lib.horizontalScrollProgress(div);
                expect(midProgress).to.be.approximately(50, 1);
            });

            it('should return 0 for non-scrollable element horizontally', function () {

                const div = document.createElement('div');

                // Mock non-scrollable properties
                Object.defineProperties(div, {
                    scrollLeft: { value: 0, writable: true },
                    scrollWidth: { value: 100, writable: true },
                    clientWidth: { value: 100, writable: true }
                });

                const result = Lib.horizontalScrollProgress(div);
                expect(result).to.equal(0);
            });
        });

        describe('isAtBottom', function () {

            it('should return boolean value', function () {

                const result = Lib.isAtBottom();
                expect(typeof result).to.equal('boolean');
            });

            it('should respect threshold parameter', function () {

                const result = Lib.isAtBottom(50);
                expect(typeof result).to.equal('boolean');
            });

            it('should use default threshold of 10px', function () {

                // Test with explicit threshold vs default
                const withThreshold = Lib.isAtBottom(10);
                const withDefault = Lib.isAtBottom();
                expect(withThreshold).to.equal(withDefault);
            });
        });

        describe('isAtTop', function () {

            const fakeScrollTo = ({ top }: { top: number }) => {

                window.scrollY = top;
            };

            const originalScrollTo = window.scrollTo;

            before(function () {

                window.scrollTo = fakeScrollTo as any;
            });

            after(function () {

                window.scrollTo = originalScrollTo;
            });

            it('should return true when at top', function () {

                const result = Lib.isAtTop();
                expect(result).to.be.true;
            });

            it('should respect threshold parameter', function () {

                window.scrollTo({ top: 5 });
                expect(Lib.isAtTop(5)).to.be.true;
                expect(Lib.isAtTop(3)).to.be.false;
            });

            it('should use default threshold of 10px', function () {

                window.scrollTo({ top: 0 });
                expect(Lib.isAtTop(10)).to.be.true;
                expect(Lib.isAtTop()).to.be.true;

                window.scrollTo({ top: 11 });
                expect(Lib.isAtTop(10)).to.be.false;
                expect(Lib.isAtTop()).to.be.false;
            });
        });

        describe('elementVisibility', function () {

            it('should return 0 for null element', function () {

                const result = Lib.elementVisibility(null as any);
                expect(result).to.equal(0);
            });

            it('should return percentage for visible element', function () {

                const testElement = document.createElement('div');

                // Mock getBoundingClientRect to simulate visible element
                testElement.getBoundingClientRect = sandbox.fake.returns({
                    top: 0,
                    left: 0,
                    bottom: 100,
                    right: 100,
                    width: 100,
                    height: 100,
                    x: 0,
                    y: 0,
                    toJSON: () => ({})
                }) as any;

                const result = Lib.elementVisibility(testElement);
                expect(result).to.be.greaterThan(0);
                expect(result).to.be.lessThanOrEqual(100);
            });

            it('should return 0 for element with zero area', function () {

                const testElement = document.createElement('div');

                // Mock getBoundingClientRect to simulate zero-size element
                testElement.getBoundingClientRect = sandbox.fake.returns({
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    width: 0,
                    height: 0,
                    x: 0,
                    y: 0,
                    toJSON: () => ({})
                }) as any;

                const result = Lib.elementVisibility(testElement);
                expect(result).to.equal(0);
            });

            it('should return 0 for completely off-screen element', function () {

                const testElement = document.createElement('div');

                // Mock getBoundingClientRect to simulate off-screen element
                testElement.getBoundingClientRect = sandbox.fake.returns({
                    top: -200,
                    left: -200,
                    bottom: -100,
                    right: -100,
                    width: 100,
                    height: 100,
                    x: -200,
                    y: -200,
                    toJSON: () => ({})
                }) as any;

                const result = Lib.elementVisibility(testElement);
                expect(result).to.equal(0);
            });
        });

        describe('isPartiallyVisible', function () {

            it('should return true for fully visible element', function () {

                const testElement = document.createElement('div');

                // Mock getBoundingClientRect to simulate visible element
                testElement.getBoundingClientRect = sandbox.fake.returns({
                    top: 0,
                    left: 0,
                    bottom: 100,
                    right: 100,
                    width: 100,
                    height: 100,
                    x: 0,
                    y: 0,
                    toJSON: () => ({})
                }) as any;

                const result = Lib.isPartiallyVisible(testElement);
                expect(result).to.be.true;
            });

            it('should return false for completely hidden element', function () {

                const testElement = document.createElement('div');

                // Mock getBoundingClientRect to simulate off-screen element
                testElement.getBoundingClientRect = sandbox.fake.returns({
                    top: -200,
                    left: -200,
                    bottom: -100,
                    right: -100,
                    width: 100,
                    height: 100,
                    x: -200,
                    y: -200,
                    toJSON: () => ({})
                }) as any;

                const result = Lib.isPartiallyVisible(testElement);
                expect(result).to.be.false;
            });

            it('should respect threshold parameter', function () {

                const testElement = document.createElement('div');

                // Mock getBoundingClientRect to simulate visible element
                testElement.getBoundingClientRect = sandbox.fake.returns({
                    top: 0,
                    left: 0,
                    bottom: 100,
                    right: 100,
                    width: 100,
                    height: 100,
                    x: 0,
                    y: 0,
                    toJSON: () => ({})
                }) as any;

                // Test with custom threshold
                const result = Lib.isPartiallyVisible(testElement, 0.5);
                expect(typeof result).to.equal('boolean');
            });

            it('should use default threshold of 0.1 (10%)', function () {

                const testElement = document.createElement('div');

                // Mock getBoundingClientRect to simulate visible element
                testElement.getBoundingClientRect = sandbox.fake.returns({
                    top: 0,
                    left: 0,
                    bottom: 100,
                    right: 100,
                    width: 100,
                    height: 100,
                    x: 0,
                    y: 0,
                    toJSON: () => ({})
                }) as any;

                const withThreshold = Lib.isPartiallyVisible(testElement, 0.1);
                const withDefault = Lib.isPartiallyVisible(testElement);
                expect(withThreshold).to.equal(withDefault);
            });
        });

        describe('elementViewportDistances', function () {

            it('should return zero distances for null element', function () {

                const result = Lib.elementViewportDistances(null as any);
                expect(result).to.deep.equal({ top: 0, bottom: 0, left: 0, right: 0 });
            });

            it('should return distance object with correct properties', function () {

                const testElement = document.createElement('div');

                // Mock getBoundingClientRect to simulate positioned element
                testElement.getBoundingClientRect = sandbox.fake.returns({
                    top: 50,
                    left: 50,
                    bottom: 150,
                    right: 150,
                    width: 100,
                    height: 100,
                    x: 50,
                    y: 50,
                    toJSON: () => ({})
                }) as any;

                const result = Lib.elementViewportDistances(testElement);

                expect(result).to.have.property('top');
                expect(result).to.have.property('bottom');
                expect(result).to.have.property('left');
                expect(result).to.have.property('right');

                expect(typeof result.top).to.equal('number');
                expect(typeof result.bottom).to.equal('number');
                expect(typeof result.left).to.equal('number');
                expect(typeof result.right).to.equal('number');
            });

            it('should calculate correct distances for positioned element', function () {

                const testElement = document.createElement('div');

                // Mock getBoundingClientRect to simulate element at 50px from top/left
                testElement.getBoundingClientRect = sandbox.fake.returns({
                    top: 50,
                    left: 50,
                    bottom: 150,
                    right: 150,
                    width: 100,
                    height: 100,
                    x: 50,
                    y: 50,
                    toJSON: () => ({})
                }) as any;

                const result = Lib.elementViewportDistances(testElement);

                // Element at 50px from top/left, so distances should reflect that
                expect(result.top).to.equal(50);
                expect(result.left).to.equal(50);
                expect(result.bottom).to.be.greaterThan(0);
                expect(result.right).to.be.greaterThan(0);
            });
        });

        describe('scrollToElement', function () {

            let testElement: HTMLElement;
            let originalScrollTo: typeof window.scrollTo;

            beforeEach(function () {

                testElement = document.createElement('div');
                testElement.style.height = '100px';
                testElement.style.marginTop = '500px';
                document.body.appendChild(testElement);

                // Mock window.scrollTo
                originalScrollTo = window.scrollTo;
                window.scrollTo = sandbox.fake() as any;
            });

            afterEach(function () {

                if (testElement && testElement.parentNode) {

                    testElement.parentNode.removeChild(testElement);
                }

                window.scrollTo = originalScrollTo;
            });

            it('should handle null element gracefully', function () {

                expect(() => {

                    Lib.scrollToElement(null as any);
                }).to.not.throw();
            });

            it('should call window.scrollTo with correct parameters', function () {

                Lib.scrollToElement(testElement);

                const scrollToSpy = window.scrollTo as Sinon.SinonSpy;
                expect(scrollToSpy.calledOnce).to.be.true;

                const call = scrollToSpy.getCall(0);
                expect(call.args[0]).to.have.property('top');
                expect(call.args[0]).to.have.property('behavior', 'smooth');
            });

            it('should apply offset correctly', function () {

                const offset = 50;
                Lib.scrollToElement(testElement, { offset });

                const scrollToSpy = window.scrollTo as Sinon.SinonSpy;
                const call = scrollToSpy.getCall(0);
                const expectedTop = Lib.elementOffsetTop(testElement) - offset;

                expect(call.args[0].top).to.equal(expectedTop);
            });

            it('should use custom scroll behavior', function () {

                Lib.scrollToElement(testElement, { behavior: 'auto' });

                const scrollToSpy = window.scrollTo as Sinon.SinonSpy;
                const call = scrollToSpy.getCall(0);
                expect(call.args[0].behavior).to.equal('auto');
            });
        });

        describe('scrollToPosition', function () {

            let originalScrollTo: typeof window.scrollTo;

            beforeEach(function () {

                originalScrollTo = window.scrollTo;
                window.scrollTo = sandbox.fake() as any;
            });

            afterEach(function () {

                window.scrollTo = originalScrollTo;
            });

            it('should call window.scrollTo with correct parameters', function () {

                const x = 100;
                const y = 200;

                Lib.scrollToPosition(x, y);

                const scrollToSpy = window.scrollTo as Sinon.SinonSpy;
                expect(scrollToSpy.calledOnce).to.be.true;

                const call = scrollToSpy.getCall(0);
                expect(call.args[0]).to.deep.include({
                    left: x,
                    top: y,
                    behavior: 'smooth'
                });
            });

            it('should use custom scroll behavior', function () {

                Lib.scrollToPosition(0, 0, { behavior: 'auto' });

                const scrollToSpy = window.scrollTo as Sinon.SinonSpy;
                const call = scrollToSpy.getCall(0);
                expect(call.args[0].behavior).to.equal('auto');
            });

            it('should handle zero coordinates', function () {

                Lib.scrollToPosition(0, 0);

                const scrollToSpy = window.scrollTo as Sinon.SinonSpy;
                expect(scrollToSpy.calledOnce).to.be.true;

                const call = scrollToSpy.getCall(0);
                expect(call.args[0].left).to.equal(0);
                expect(call.args[0].top).to.equal(0);
            });

            it('should handle negative coordinates', function () {

                Lib.scrollToPosition(-50, -100);

                const scrollToSpy = window.scrollTo as Sinon.SinonSpy;
                const call = scrollToSpy.getCall(0);
                expect(call.args[0].left).to.equal(-50);
                expect(call.args[0].top).to.equal(-100);
            });
        });

        describe('error handling and edge cases', function () {

            it('should handle missing document gracefully', function () {

                // Mock the window object temporarily
                const originalWindow = global.window;
                (global as any).window = null;

                expect(Lib.documentHeight()).to.equal(0);
                expect(Lib.documentWidth()).to.equal(0);
                expect(Lib.scrollTop()).to.equal(0);
                expect(Lib.scrollLeft()).to.equal(0);

                // Restore original window
                (global as any).window = originalWindow;
            });

            it('should handle scrollbarWidth measurement failure gracefully', function () {

                // Mock console.warn to verify error handling
                const originalWarn = console.warn;
                console.warn = sandbox.fake();

                // Mock document.createElement to throw error
                const originalCreateElement = document.createElement;
                document.createElement = sandbox.fake.throws(new Error('Test error'));

                const result = Lib.scrollbarWidth();
                expect(result).to.equal(0);
                expect((console.warn as Sinon.SinonSpy).calledOnce).to.be.true;

                // Restore mocks
                document.createElement = originalCreateElement;
                console.warn = originalWarn;
            });

            it('should handle elements with getBoundingClientRect errors gracefully', function () {

                const mockElement = {
                    getBoundingClientRect: sandbox.fake.throws(new Error('getBoundingClientRect error'))
                } as any;

                // The function should handle the error and return 0
                const result = Lib.elementOffsetTop(mockElement);
                expect(typeof result).to.equal('number');
            });
        });
    });

    describe('$(...)', function () {

        let testContainer: HTMLDivElement;

        before(function () {
            testContainer = document.createElement('div');
            testContainer.className = 'test-container';

            testContainer.innerHTML = `
                <ul>
                    <li class='item'></li>
                    <li class='item'></li>
                </ul>
            `;
            document.body.appendChild(testContainer);
        });

        after(function () {
            if (testContainer && testContainer.parentNode) {
                testContainer.parentNode.removeChild(testContainer);
            }
        });

        it('It can query the DOM properly', function () {
            const container = $('.test-container');
            expect(Array.isArray(container)).to.equal(true);
            expect(container.length).to.equal(1);
            expect($('.item', container[0]).length).to.equal(2);
        });

        it('No matched queries return empty arrays', function () {
            const els = $('.foo');
            expect(Array.isArray(els)).to.equal(true);
            expect(typeof els).to.equal('object');
            expect(els.length).to.equal(0);
        });
    });

    describe('css[fn] (...)', function () {

        stub.sampleCss = {
            color: 'rgb(100, 100, 100)',
            fontSize: '12px'
        }

        it('it can set a style attribute', function () {

            const div = document.createElement('div');
            html.css.set(div, stub.sampleCss!);

            expect(div.style.fontSize).to.equal(stub.sampleCss!.fontSize);
            expect(div.style.color).to.equal(stub.sampleCss!.color);
        });

        it('it can set a style attribute on many nodes', function () {

            const div = document.createElement('div');
            const span = document.createElement('span');
            html.css.set([div, span], stub.sampleCss!);

            expect(div.style.fontSize).to.equal(stub.sampleCss!.fontSize);
            expect(div.style.color).to.equal(stub.sampleCss!.color);

            expect(span.style.fontSize).to.equal(stub.sampleCss!.fontSize);
            expect(span.style.color).to.equal(stub.sampleCss!.color);
        });

        it('it can get style attributes', function () {

            const div = document.createElement('div');
            html.css.set(div, stub.sampleCss!);

            expect(html.css.get(div, 'color')).to.equal(stub.sampleCss!.color);

        });

        it('it can get style attributes on many nodes', function () {

            const div = document.createElement('div');
            const span = document.createElement('span');

            html.css.set([div, span], stub.sampleCss!);

            const result = html.css.get([div, span], 'color');

            expect(result[0]).to.include(stub.sampleCss!.color);
            expect(result[1]).to.include(stub.sampleCss!.color);
        });

        it('it can get many style attributes', function () {

            const div = document.createElement('div');
            html.css.set(div, stub.sampleCss!);

            expect(html.css.get(div, ['color', 'fontSize'])).to.include(stub.sampleCss!);

        });

        it('it can get many style attributes on many nodes', function () {

            const div = document.createElement('div');
            const span = document.createElement('span');
            html.css.set([div, span], stub.sampleCss!);

            const results = html.css.get([div, span], ['color', 'fontSize']);

            expect(results[0]).to.include(stub.sampleCss!);
            expect(results[1]).to.include(stub.sampleCss!);
        });

        it('it can remove style attributes', function () {

            const div = document.createElement('div');
            html.css.set(div, stub.sampleCss!);

            html.css.remove(div, 'color');

            expect(div.style.color).to.be.empty;
        });

        it('it can remove style attributes from many nodes', function () {

            const div = document.createElement('div');
            const span = document.createElement('span');
            html.css.set([div, span], stub.sampleCss!);

            html.css.remove([div, span], 'color');

            expect(div.style.color).to.be.empty;
            expect(span.style.color).to.be.empty;

        });

        it('it can remove many style attributes from many nodes', function () {

            const div = document.createElement('div');
            const span = document.createElement('span');
            html.css.set([div, span], stub.sampleCss!);

            html.css.remove([div, span], Object.keys(stub.sampleCss!) as CssPropNames[]);

            expect(div.style.color).to.be.empty;
            expect(div.style.fontSize).to.be.empty;
            expect(span.style.color).to.be.empty;
            expect(span.style.fontSize).to.be.empty;
        });
    });

    describe('events[fn] (...)', () => {

        afterEach(() => {

            sandbox.resetBehavior();
        });

        it('should add a single event', () => {

            const div = document.createElement('div');
            const listener = sandbox.fake();

            sandbox.spy(div);

            html.events.on(div, 'click', listener);


            const addEventListener = div.addEventListener as Sinon.SinonSpy;

            expect(addEventListener.calledOnce).to.be.true;
            expect(addEventListener.calledWith('click', listener)).to.be.true;
        });

        it('should add a single event to many elements', () => {

            const div = document.createElement('div');
            const span = document.createElement('span');
            const listener = sandbox.fake();

            const divSpy = sandbox.spy(div);
            const spanSpy = sandbox.spy(span);

            html.events.on([div, span], 'click', listener);

            const addEvents = [
                divSpy.addEventListener as Sinon.SinonSpy,
                spanSpy.addEventListener as Sinon.SinonSpy
            ];

            for (const addEventListener of addEvents) {

                expect(addEventListener.calledOnce).to.be.true;
                expect(addEventListener.calledWith('click', listener)).to.be.true;
            }
        });

        it('should add many events', () => {

            const div = document.createElement('div');
            const listener = sandbox.fake();

            sandbox.spy(div);

            html.events.on(div, ['click', 'mousedown', 'blur'], listener);

            const addEventListener = div.addEventListener as Sinon.SinonSpy;

            expect(addEventListener.calledThrice).to.be.true;
            expect(addEventListener.calledWith('click', listener)).to.be.true;
            expect(addEventListener.calledWith('mousedown', listener)).to.be.true;
            expect(addEventListener.calledWith('blur', listener)).to.be.true;
        });

        it('should add many events to many elements', () => {

            const div = document.createElement('div');
            const span = document.createElement('span');
            const listener = sandbox.fake();

            sandbox.spy(div);
            sandbox.spy(span);

            html.events.on([div, span], ['click', 'mousedown', 'blur'], listener);

            const addEvents = [
                div.addEventListener as Sinon.SinonSpy,
                span.addEventListener as Sinon.SinonSpy
            ];

            for (const addEventListener of addEvents) {

                expect(addEventListener.calledThrice).to.be.true;
                expect(addEventListener.calledWith('click', listener)).to.be.true;
                expect(addEventListener.calledWith('mousedown', listener)).to.be.true;
                expect(addEventListener.calledWith('blur', listener)).to.be.true;
            }
        });

        it('should remove a single event', () => {

            const div = document.createElement('div');
            const listener = sandbox.fake();

            sandbox.spy(div);

            html.events.on(div, 'click', listener);
            html.events.off(div, 'click', listener);

            const removeEventListener = div.removeEventListener as Sinon.SinonSpy;

            expect(removeEventListener.calledOnce).to.be.true;
            expect(removeEventListener.calledWith('click', listener)).to.be.true;
        });

        it('should remove many events for many elements', () => {

            const div = document.createElement('div');
            const span = document.createElement('span');
            const listener = sandbox.fake();

            sandbox.spy(div);
            sandbox.spy(span);

            html.events.on([div, span], ['click', 'mousedown', 'blur'], listener);
            html.events.off([div, span], ['click', 'mousedown', 'blur'], listener);

            const addEvents = [
                div.removeEventListener as Sinon.SinonSpy,
                span.removeEventListener as Sinon.SinonSpy
            ];

            for (const removeEventListener of addEvents) {

                expect(removeEventListener.calledThrice).to.be.true;
                expect(removeEventListener.calledWith('click', listener)).to.be.true;
                expect(removeEventListener.calledWith('mousedown', listener)).to.be.true;
                expect(removeEventListener.calledWith('blur', listener)).to.be.true;
            }
        });

        it('should emit a single event with data', () => {

            const div = document.createElement('div');
            const listener = sandbox.fake();

            const divSpy = sandbox.spy(div);

            html.events.on(div, 'click', listener);
            html.events.emit(div, 'click', { data: true });

            const dispatchEvent = divSpy.dispatchEvent;

            expect(dispatchEvent.calledOnce).to.be.true;

            const { args: [args] } = dispatchEvent.getCall(0);

            expect(args).to.be.an.instanceOf(window.CustomEvent);

            expect((args as any).detail).to.include({ data: true });
            expect(listener.calledOnce).to.be.true;
        });

        it('should only emit an event once', () => {

            const div = document.createElement('div');
            const listener = sandbox.fake();

            sandbox.spy(div);

            html.events.once(div, 'click', listener);
            html.events.emit(div, 'click');
            html.events.emit(div, 'click');
            html.events.emit(div, 'click');

            expect(listener.calledOnce).to.be.true;
        });

        it('should only emit many event once on many elements', () => {

            const div = document.createElement('div');
            const span = document.createElement('span');
            const listener = sandbox.fake();

            html.events.once([div, span], ['click', 'blur', 'focus'], listener);
            html.events.emit([div, span], 'click');
            html.events.emit([div, span], 'click');
            html.events.emit([div, span], 'blur');
            html.events.emit([div, span], 'blur');
            html.events.emit([div, span], 'focus');
            html.events.emit([div, span], 'focus');

            expect(listener.callCount).to.eq(6);
        });
    });

    describe('attrs[fn] (...)', () => {

        it('it can set an attribute', () => {

            const div = document.createElement('div');
            html.attrs.set(div, { hidden: 'true' })

            expect(div.getAttribute('hidden')).to.equal('true');
        });

        it('it can set an attribute on many nodes', () => {

            const div = document.createElement('div');
            const span = document.createElement('span');
            html.attrs.set([div, span], { hidden: 'true' })

            expect(div.getAttribute('hidden')).to.equal('true');
            expect(span.getAttribute('hidden')).to.equal('true');
        });

        it('it can set many attributes', () => {

            const div = document.createElement('div');
            html.attrs.set(div, { hidden: 'true', data: 'false' });

            expect(div.getAttribute('hidden')).to.equal('true');
            expect(div.getAttribute('data')).to.equal('false');
        });

        it('it can set many attributes on many nodes', () => {

            const div = document.createElement('div');
            const span = document.createElement('span');
            html.attrs.set([div, span], { hidden: 'true', data: 'false' });

            expect(div.getAttribute('hidden')).to.equal('true');
            expect(div.getAttribute('data')).to.equal('false');

            expect(span.getAttribute('hidden')).to.equal('true');
            expect(span.getAttribute('data')).to.equal('false');
        });

        it('it can get attributes', () => {

            const div = document.createElement('div');
            html.attrs.set(div, { hidden: 'true' })

            expect(html.attrs.get(div, 'hidden')).to.equal('true');
        });

        it('it can get attributes on many nodes', () => {

            const div = document.createElement('div');
            const span = document.createElement('div');
            html.attrs.set([div, span], { hidden: 'true' })

            const result = html.attrs.get([div, span], 'hidden');

            expect(result[0]).to.equal('true');
            expect(result[1]).to.equal('true');
        });


        it('it can get many attributes on many nodes', () => {

            const div = document.createElement('div');
            const span = document.createElement('div');

            const attrs = {
                hidden: 'true',
                data: 'false'
            };

            html.attrs.set([div, span], attrs)

            const result = html.attrs.get([div, span], ['hidden', 'data']);

            expect(result[0]?.data).to.equal(attrs.data);
            expect(result[1]?.data).to.equal(attrs.data);

            expect(result[0]?.hidden).to.equal(attrs.hidden);
            expect(result[1]?.hidden).to.equal(attrs.hidden);
        });

        it('it can remove attributes', () => {

            const div = document.createElement('div');

            html.attrs.set(div, { hidden: 'true' })
            html.attrs.remove(div, 'hidden');

            expect(div.getAttribute('hidden')).to.equal(null);
        });

        it('it can remove attributes from many nodes', () => {

            const div = document.createElement('div');
            const span = document.createElement('div');

            html.attrs.set([div, span], { hidden: 'true', data: 'false' })
            html.attrs.remove([div, span], ['hidden', 'data']);

            const result = html.attrs.get([div, span], ['hidden', 'data']);

            const nope = {
                hidden: null,
                data: null
            };

            expect(result[0]?.data).to.equal(nope.data);
            expect(result[1]?.data).to.equal(nope.data);

            expect(result[0]?.hidden).to.equal(nope.hidden);
            expect(result[1]?.hidden).to.equal(nope.hidden);
        });

        it('it can detect attributes', () => {

            const div = document.createElement('div');
            html.attrs.set(div, { hidden: 'true' })

            expect(html.attrs.has(div, 'hidden')).to.equal(true);
            expect(html.attrs.has(div, 'poops')).to.equal(false);
        });

        it('it can detect attributes on many nodes', () => {

            const div = document.createElement('div');
            const span = document.createElement('span');
            html.attrs.set([div, span], { hidden: 'true' })

            const result = html.attrs.has([div, span], 'hidden') as boolean[];
            expect(result[0]).to.equal(true);
            expect(result[1]).to.equal(true);
        });

        it('it can detect many attributes on many nodes', () => {

            const div = document.createElement('div');
            const span = document.createElement('span');
            html.attrs.set([div, span], { hidden: 'true', data: 'false' })

            const attrs = {
                hidden: true,
                data: true
            };

            const result = html.attrs.has <keyof typeof attrs>([div, span], ['hidden', 'data']);
            expect(result[0]).to.include(attrs);
            expect(result[1]).to.include(attrs);
        });

    });

    describe('behaviors[fn] (...)', () => {

        let testDiv: HTMLDivElement;
        let testButton: HTMLButtonElement;

        beforeEach(() => {

            // Create fresh test elements for each test
            testDiv = document.createElement('div');
            testButton = document.createElement('button');
            testButton.setAttribute('copy', 'test text');
            testDiv.appendChild(testButton);
            document.body.appendChild(testDiv);

            // Clean up any existing behaviors
            html.behaviors.stopAll();
        });

        afterEach(() => {

            // Clean up DOM and behaviors
            testDiv.remove();
            html.behaviors.stopAll();
            sandbox.resetBehavior();
        });

        describe('bind', () => {

            it('should bind behavior and prevent duplicate bindings', () => {

                const handler = sandbox.fake();

                html.behaviors.bind(testButton, 'TestFeature', handler);

                expect(handler.calledOnce).to.be.true;
                expect(handler.calledWith(testButton)).to.be.true;
            });

            it('should not bind if already bound', () => {

                const handler = sandbox.fake();

                html.behaviors.bind(testButton, 'TestFeature', handler);
                html.behaviors.bind(testButton, 'TestFeature', handler);

                expect(handler.calledOnce).to.be.true;
            });

            it('should handle errors in handler gracefully', () => {

                const handler = sandbox.fake.throws(new Error('Test error'));

                // The bind method handles errors internally, so it shouldn't throw
                expect(() => {
                    html.behaviors.bind(testButton, 'TestFeature', handler);
                }).to.not.throw();

                expect(handler.calledOnce).to.be.true;
            });

            it('should bind to multiple elements', () => {

                const button2 = document.createElement('button');
                testDiv.appendChild(button2);

                const handler = sandbox.fake();

                html.behaviors.bind([testButton, button2], 'TestFeature', handler);

                expect(handler.calledTwice).to.be.true;
                expect(handler.firstCall.args[0]).to.equal(testButton);
                expect(handler.secondCall.args[0]).to.equal(button2);
            });

            it('should bind using selector string', () => {

                testButton.className = 'test-btn';
                const button2 = document.createElement('button');
                button2.className = 'test-btn';
                testDiv.appendChild(button2);

                const handler = sandbox.fake();

                html.behaviors.bind('.test-btn', 'TestFeature', handler);

                expect(handler.calledTwice).to.be.true;
            });

            it('should filter out hidden elements', () => {

                testButton.className = 'live-btn';

                const hiddenButton = document.createElement('button');
                hiddenButton.className = 'live-btn';
                hiddenButton.hidden = true;
                testDiv.appendChild(hiddenButton);

                const templateButton = document.createElement('button');
                templateButton.className = 'live-btn';
                const template = document.createElement('div');
                template.setAttribute('data-template', '');
                template.appendChild(templateButton);
                testDiv.appendChild(template);

                const handler = sandbox.fake();

                html.behaviors.bind('.live-btn', 'TestFeature', handler);

                // Should only bind to the visible button
                expect(handler.calledOnce).to.be.true;
                expect(handler.calledWith(testButton)).to.be.true;
            });

            it('should return cleanup function', () => {

                const handler = sandbox.fake.returns(() => {
                    // Teardown logic
                });

                const cleanup = html.behaviors.bind(testButton, 'TestFeature', handler);

                expect(cleanup).to.be.a('function');

                // Calling cleanup should work without errors
                expect(() => cleanup?.()).to.not.throw();
            });
        });

        describe('on/dispatch', () => {

            it('should register and trigger init events', () => {

                const initHandler = sandbox.fake();

                html.behaviors.on('testFeature', initHandler);
                html.behaviors.dispatch('testFeature');

                expect(initHandler.calledOnce).to.be.true;
            });

            it('should trigger multiple events', () => {

                const handler1 = sandbox.fake();
                const handler2 = sandbox.fake();

                html.behaviors.on('feature1', handler1);
                html.behaviors.on('feature2', handler2);

                html.behaviors.dispatch('feature1', 'feature2');

                expect(handler1.calledOnce).to.be.true;
                expect(handler2.calledOnce).to.be.true;
            });

            it('should handle multiple triggers of same event', () => {

                const handler = sandbox.fake();

                html.behaviors.on('testFeature', handler);
                html.behaviors.dispatch('testFeature');
                html.behaviors.dispatch('testFeature');

                expect(handler.calledTwice).to.be.true;
            });

            it('should return cleanup function', () => {

                const handler = sandbox.fake();
                const cleanup = html.behaviors.on('testFeature', handler);

                html.behaviors.dispatch('testFeature');
                expect(handler.calledOnce).to.be.true;

                // Clean up
                cleanup();

                // Should not trigger after cleanup
                html.behaviors.dispatch('testFeature');
                expect(handler.calledOnce).to.be.true; // Still only once
            });

            it('should handle cleanup returned by init function', () => {

                const innerCleanup = sandbox.fake();
                const initHandler = sandbox.fake.returns(innerCleanup);

                const cleanup = html.behaviors.on('testFeature', initHandler);
                html.behaviors.dispatch('testFeature');

                expect(initHandler.calledOnce).to.be.true;

                // Cleanup should call the inner cleanup
                cleanup();
                expect(innerCleanup.calledOnce).to.be.true;
            });
        });

        describe('create', () => {

            it('should register multiple behaviors at once', () => {

                const handler1 = sandbox.fake();
                const handler2 = sandbox.fake();
                const handler3 = sandbox.fake();

                const { dispatch } = html.behaviors.create({
                    feature1: handler1,
                    feature2: handler2,
                    feature3: handler3
                }, { shouldDispatch: false });

                dispatch();

                expect(handler1.calledOnce).to.be.true;
                expect(handler2.calledOnce).to.be.true;
                expect(handler3.calledOnce).to.be.true;
            });

            it('should support behavior config objects', () => {

                const handler = sandbox.fake();
                testButton.setAttribute('data-test', 'true');

                html.behaviors.create({
                    testFeature: {
                        els: '[data-test]',
                        handler: handler,
                        shouldDispatch: true,
                        shouldObserve: false
                    }
                });

                expect(handler.calledOnce).to.be.true;
                expect(handler.calledWith(testButton)).to.be.true;
            });

            it('should auto-dispatch when configured', () => {

                const handler = sandbox.fake();
                testButton.setAttribute('data-auto', 'true');

                html.behaviors.create({
                    autoFeature: {
                        els: '[data-auto]',
                        handler: handler,
                        shouldDispatch: true
                    }
                }, { shouldDispatch: false });

                expect(handler.calledOnce).to.be.true;
            });

            it('should return cleanup and dispatch functions', () => {

                const handler = sandbox.fake();

                const { cleanup, dispatch } = html.behaviors.create({
                    testFeature: handler
                }, { shouldDispatch: false });

                expect(cleanup).to.be.a('function');
                expect(dispatch).to.be.a('function');

                dispatch();
                expect(handler.calledOnce).to.be.true;

                cleanup();
                dispatch();
                expect(handler.calledOnce).to.be.true; // Still only once after cleanup
            });
        });

        describe('unbind/unbindAll', () => {

            it('should unbind specific feature', () => {

                const unbindCallback = sandbox.fake();
                const handler = sandbox.fake.returns(unbindCallback);

                html.behaviors.bind(testButton, 'TestFeature', handler);
                expect(handler.calledOnce).to.be.true;

                html.behaviors.unbind(testButton, 'TestFeature');
                expect(unbindCallback.calledOnce).to.be.true;
            });

            it('should handle unbinding non-existent feature gracefully', () => {

                expect(() => {
                    html.behaviors.unbind(testButton, 'NonExistent');
                }).to.not.throw();
            });

            it('should unbind all features from element', () => {

                const unbind1 = sandbox.fake();
                const unbind2 = sandbox.fake();
                const handler1 = sandbox.fake.returns(unbind1);
                const handler2 = sandbox.fake.returns(unbind2);

                html.behaviors.bind(testButton, 'Feature1', handler1);
                html.behaviors.bind(testButton, 'Feature2', handler2);

                html.behaviors.unbindAll(testButton);

                expect(unbind1.calledOnce).to.be.true;
                expect(unbind2.calledOnce).to.be.true;
            });

            it('should handle unbindAll on element with no behaviors', () => {

                expect(() => {
                    html.behaviors.unbindAll(testButton);
                }).to.not.throw();
            });
        });

        describe('observe', () => {

            let mockMutationObserver: Sinon.SinonStub;
            let mockObserverInstance: {
                observe: Sinon.SinonStub;
                disconnect: Sinon.SinonStub;
                callback?: Function;
                trigger: (mutations: any[]) => void;
            };
            let originalMutationObserver: any;

            beforeEach(() => {

                // Save original MutationObserver
                originalMutationObserver = (global as any).MutationObserver;

                // Create mock observer instance
                mockObserverInstance = {
                    observe: sandbox.stub(),
                    disconnect: sandbox.stub(),
                    trigger: function(mutations: any[]) {
                        // Manually trigger the callback
                        if (this.callback) {
                            this.callback(mutations);
                        }
                    }
                };

                // Create mock MutationObserver constructor
                mockMutationObserver = sandbox.stub().callsFake((callback: Function) => {
                    (mockObserverInstance as any).callback = callback;
                    return mockObserverInstance;
                });

                // Replace global MutationObserver
                (global as any).MutationObserver = mockMutationObserver;
            });

            afterEach(() => {

                // Restore original MutationObserver
                (global as any).MutationObserver = originalMutationObserver;
            });

            it('should handle missing MutationObserver gracefully', () => {

                // Remove MutationObserver temporarily
                delete (global as any).MutationObserver;

                expect(() => {
                    html.behaviors.observe('testFeature', '[data-test]');
                }).to.throw(MutationObserverUnavailableError);

                // Restore for cleanup
                (global as any).MutationObserver = originalMutationObserver;
            });

            it('should create MutationObserver with correct configuration', () => {

                html.behaviors.observe('testFeature', '[data-test]', {
                    root: testDiv
                });

                expect(mockMutationObserver.calledOnce).to.be.true;
                expect(mockObserverInstance.observe.calledOnce).to.be.true;
                expect(mockObserverInstance.observe.calledWith(testDiv, {
                    childList: true,
                    subtree: true
                })).to.be.true;
            });

            it('should trigger dispatch events when matching elements are added', () => {

                const prepareHandler = sandbox.fake();
                html.behaviors.on('autoFeature', prepareHandler);

                html.behaviors.observe('autoFeature', '[data-auto]', {
                    root: testDiv
                });

                // Simulate adding a matching element
                const newElement = document.createElement('button');
                newElement.setAttribute('data-auto', 'true');

                const mockMutation = {
                    addedNodes: [newElement]
                };

                mockObserverInstance.trigger([mockMutation]);

                expect(prepareHandler.calledOnce).to.be.true;
            });

            it('should handle debounced event dispatching', async () => {

                const prepareHandler = sandbox.fake();
                html.behaviors.on('debouncedFeature', prepareHandler);

                html.behaviors.observe('debouncedFeature', '[data-debounced]', {
                    root: testDiv,
                    debounceMs: 50
                });

                // Simulate rapid mutations
                const element1 = document.createElement('div');
                element1.setAttribute('data-debounced', 'true');

                const element2 = document.createElement('div');
                element2.setAttribute('data-debounced', 'true');

                const mutations = [
                    { addedNodes: [element1] },
                    { addedNodes: [element2] }
                ];

                mockObserverInstance.trigger(mutations);
                mockObserverInstance.trigger(mutations);
                mockObserverInstance.trigger(mutations);

                // Should be debounced - only call once after delay
                expect(prepareHandler.called).to.be.false;

                await new Promise(resolve => setTimeout(resolve, 100));
                expect(prepareHandler.calledOnce).to.be.true;
            });

            it('should reuse observers for same root element', () => {

                html.behaviors.observe('feature1', '[data-f1]', { root: testDiv });
                html.behaviors.observe('feature2', '[data-f2]', { root: testDiv });

                // Should only create one observer for the same root
                expect(mockMutationObserver.calledOnce).to.be.true;
                expect(mockObserverInstance.observe.calledOnce).to.be.true;
            });

            it('should create separate observers for different roots', () => {

                const root2 = document.createElement('div');
                document.body.appendChild(root2);

                html.behaviors.observe('feature1', '[data-f1]', { root: testDiv });
                html.behaviors.observe('feature2', '[data-f2]', { root: root2 });

                expect(mockMutationObserver.calledTwice).to.be.true;
                expect(mockObserverInstance.observe.calledTwice).to.be.true;

                root2.remove();
            });

            it('should handle child element matching', () => {

                const prepareHandler = sandbox.fake();
                html.behaviors.on('childFeature', prepareHandler);

                html.behaviors.observe('childFeature', '[data-child]', {
                    root: testDiv
                });

                // Add a parent element that contains a matching child
                const parentEl = document.createElement('div');
                const childEl = document.createElement('span');
                childEl.setAttribute('data-child', 'true');
                parentEl.appendChild(childEl);

                const mockMutation = {
                    addedNodes: [parentEl]
                };

                mockObserverInstance.trigger([mockMutation]);

                expect(prepareHandler.calledOnce).to.be.true;
            });

            it('should ignore non-element nodes', () => {

                const prepareHandler = sandbox.fake();
                html.behaviors.on('textFeature', prepareHandler);

                html.behaviors.observe('textFeature', '[data-text]', {
                    root: testDiv
                });

                // Add text node (should be ignored)
                const textNode = document.createTextNode('some text');

                const mockMutation = {
                    addedNodes: [textNode]
                };

                mockObserverInstance.trigger([mockMutation]);

                expect(prepareHandler.called).to.be.false;
            });

            it('should handle duplicate registration attempts', () => {

                html.behaviors.observe('duplicate', '[data-dup]');
                html.behaviors.observe('duplicate', '[data-dup]');
                html.behaviors.observe('duplicate', '[data-dup]');

                // Should only create one observer
                expect(mockMutationObserver.calledOnce).to.be.true;
            });

            it('should validate parameters correctly', () => {

                expect(() => {
                    html.behaviors.on('', () => {});
                }).to.throw('Feature name must be a non-empty string');

                expect(() => {
                    html.behaviors.on('test', null as any);
                }).to.throw('Init must be a function');
            });
        });

        describe('stop/stopAll', () => {

            let mockMutationObserver: Sinon.SinonStub;
            let mockObserverInstance: {
                observe: Sinon.SinonStub;
                disconnect: Sinon.SinonStub;
            };
            let originalMutationObserver: any;

            beforeEach(() => {

                originalMutationObserver = (global as any).MutationObserver;

                mockObserverInstance = {
                    observe: sandbox.stub(),
                    disconnect: sandbox.stub()
                };

                mockMutationObserver = sandbox.stub().returns(mockObserverInstance);
                (global as any).MutationObserver = mockMutationObserver;
            });

            afterEach(() => {

                (global as any).MutationObserver = originalMutationObserver;
            });

            it('should disconnect observer when no features remain for root', () => {

                // Setup single feature
                html.behaviors.observe('stopTest', '[data-stop]', {
                    root: testDiv
                });

                expect(mockObserverInstance.disconnect.called).to.be.false;

                // Stop the only feature - should disconnect observer
                html.behaviors.stop('stopTest', '[data-stop]', testDiv);

                expect(mockObserverInstance.disconnect.calledOnce).to.be.true;
            });

            it('should not disconnect when other features remain for root', () => {

                // Setup multiple features for same root
                html.behaviors.observe('feature1', '[data-f1]', { root: testDiv });
                html.behaviors.observe('feature2', '[data-f2]', { root: testDiv });

                // Stop one feature
                html.behaviors.stop('feature1', '[data-f1]', testDiv);

                // Should not disconnect because feature2 still exists
                expect(mockObserverInstance.disconnect.called).to.be.false;

                // Stop remaining feature
                html.behaviors.stop('feature2', '[data-f2]', testDiv);

                // Now should disconnect
                expect(mockObserverInstance.disconnect.calledOnce).to.be.true;
            });

            it('should handle multiple roots independently', () => {

                const root2 = document.createElement('div');
                document.body.appendChild(root2);

                // Create multiple observers for different roots
                const observer1Instance = { observe: sandbox.stub(), disconnect: sandbox.stub() };
                const observer2Instance = { observe: sandbox.stub(), disconnect: sandbox.stub() };

                mockMutationObserver.onFirstCall().returns(observer1Instance);
                mockMutationObserver.onSecondCall().returns(observer2Instance);

                html.behaviors.observe('root1Feature', '[data-r1]', { root: testDiv });
                html.behaviors.observe('root2Feature', '[data-r2]', { root: root2 });

                // Stop feature on first root
                html.behaviors.stop('root1Feature', '[data-r1]', testDiv);

                expect(observer1Instance.disconnect.calledOnce).to.be.true;
                expect(observer2Instance.disconnect.called).to.be.false;

                root2.remove();
            });

            it('should disconnect all observers when stopping all', () => {

                const root2 = document.createElement('div');
                document.body.appendChild(root2);

                const observer1Instance = { observe: sandbox.stub(), disconnect: sandbox.stub() };
                const observer2Instance = { observe: sandbox.stub(), disconnect: sandbox.stub() };

                mockMutationObserver.onFirstCall().returns(observer1Instance);
                mockMutationObserver.onSecondCall().returns(observer2Instance);

                html.behaviors.observe('feature1', '[data-f1]', { root: testDiv });
                html.behaviors.observe('feature2', '[data-f2]', { root: root2 });

                html.behaviors.stopAll();

                expect(observer1Instance.disconnect.calledOnce).to.be.true;
                expect(observer2Instance.disconnect.calledOnce).to.be.true;

                root2.remove();
            });

            it('should handle stopping non-existent observers gracefully', () => {

                expect(() => {

                    html.behaviors.stop('nonExistent', '[data-fake]');
                }).to.not.throw();
            });

            it('should clear all registries when stopping all observing', () => {

                html.behaviors.observe('feature1', '[data-f1]');
                html.behaviors.observe('feature2', '[data-f2]');

                html.behaviors.stopAll();

                // Subsequent operations should work as if starting fresh
                expect(() => {
                    html.behaviors.observe('newFeature', '[data-new]');
                }).to.not.throw();
            });
        });

        describe('integration scenarios', () => {

            it('should handle complete behavior lifecycle with manual triggers', () => {

                const initHandler = sandbox.fake();
                const behaviorHandler = sandbox.fake();
                const teardownHandler = sandbox.fake.returns(() => {
                    // Teardown logic
                });

                // Register behavior
                html.behaviors.on('integration', () => {

                    initHandler();

                    const els = $('[data-integration]', testDiv);
                    els.forEach((el: Element) => {

                        html.behaviors.bind(el, 'Integration', (element) => {

                            behaviorHandler(element);
                            return teardownHandler();
                        });
                    });
                });

                // Add element first
                const newEl = document.createElement('button');
                newEl.setAttribute('data-integration', 'true');
                testDiv.appendChild(newEl);

                // Trigger behavior manually
                html.behaviors.dispatch('integration');

                // Verify initialization happened
                expect(initHandler.calledOnce).to.be.true;
                expect(behaviorHandler.calledOnce).to.be.true;
                expect(behaviorHandler.calledWith(newEl)).to.be.true;

                // Test teardown
                html.behaviors.unbind(newEl, 'Integration');
                expect(teardownHandler.calledOnce).to.be.true;
            });

            it('should prevent double-binding with manual triggers', () => {

                const bindingHandler = sandbox.fake();

                html.behaviors.on('rapidTest', () => {

                    const els = $('[data-rapid]', testDiv);
                    els.forEach((el: Element) => {

                        html.behaviors.bind(el, 'Rapid', bindingHandler);
                    });
                });

                // Add element first
                const el = document.createElement('div');
                el.setAttribute('data-rapid', 'true');
                testDiv.appendChild(el);

                // Trigger multiple prepare events manually
                html.behaviors.dispatch('rapidTest');
                html.behaviors.dispatch('rapidTest');
                html.behaviors.dispatch('rapidTest');

                // Should only be bound once
                expect(bindingHandler.calledOnce).to.be.true;
            });

            it('should work with behavior registry and manual dispatch', () => {

                const copyHandler = sandbox.fake();
                const modalHandler = sandbox.fake();

                const { dispatch } = html.behaviors.create({
                    copyBehavior: copyHandler,
                    modalBehavior: modalHandler
                }, { shouldDispatch: false });

                // Trigger behaviors
                dispatch();

                expect(copyHandler.calledOnce).to.be.true;
                expect(modalHandler.calledOnce).to.be.true;
            });

            it('should handle complete automatic behavior lifecycle with DOM mutations', () => {

                // Mock MutationObserver for this test
                const originalMutationObserver = (global as any).MutationObserver;
                let mockCallback: Function | undefined;
                const mockObserver = {
                    observe: sandbox.stub(),
                    disconnect: sandbox.stub()
                };

                (global as any).MutationObserver = sandbox.stub().callsFake((callback: Function) => {
                    mockCallback = callback;
                    return mockObserver;
                });

                try {
                    const initHandler = sandbox.fake();
                    const behaviorHandler = sandbox.fake();

                    // Register automatic behavior
                    html.behaviors.on('autoTest', () => {
                        initHandler();

                        const els = $('[data-auto-test]', testDiv);
                        els.forEach((el: Element) => {
                            html.behaviors.bind(el, 'AutoTest', behaviorHandler);
                        });
                    });

                    // Set up automatic observation
                    html.behaviors.observe('autoTest', '[data-auto-test]', {
                        root: testDiv
                    });

                    // Verify observer was set up
                    expect(mockObserver.observe.calledOnce).to.be.true;

                    // Simulate DOM mutation - add new element
                    const newElement = document.createElement('button');
                    newElement.setAttribute('data-auto-test', 'true');

                    // Actually add the element to the DOM so $ can find it
                    testDiv.appendChild(newElement);

                    // Trigger mutation observer with new element
                    if (mockCallback) {
                        mockCallback([{
                            addedNodes: [newElement]
                        }]);
                    }

                    // Verify automatic behavior binding occurred
                    expect(initHandler.calledOnce).to.be.true;
                    expect(behaviorHandler.calledOnce).to.be.true;

                } finally {
                    // Restore original MutationObserver
                    (global as any).MutationObserver = originalMutationObserver;
                }
            });

            it('should handle create with auto-observe and DOM mutations', () => {

                // Mock MutationObserver for this test
                const originalMutationObserver = (global as any).MutationObserver;
                let mockCallback: Function | undefined;
                const mockObserver = {
                    observe: sandbox.stub(),
                    disconnect: sandbox.stub()
                };

                (global as any).MutationObserver = sandbox.stub().callsFake((callback: Function) => {
                    mockCallback = callback;
                    return mockObserver;
                });

                try {
                    const handler = sandbox.fake();

                    // Create behavior with auto-observe
                    html.behaviors.create({
                        autoCreateTest: {
                            els: '[data-create-test]',
                            handler: handler,
                            shouldObserve: true,
                            shouldDispatch: false
                        }
                    }, { shouldObserve: true });

                    // Verify observer was set up
                    expect(mockObserver.observe.called).to.be.true;

                    // Simulate adding new element
                    const newElement = document.createElement('div');
                    newElement.setAttribute('data-create-test', 'true');
                    testDiv.appendChild(newElement);

                    // Trigger mutation
                    if (mockCallback) {
                        mockCallback([{
                            addedNodes: [newElement]
                        }]);
                    }

                    // Manually dispatch since the mock won't trigger real events
                    html.behaviors.dispatch('autoCreateTest');

                    // Verify behavior was bound
                    expect(handler.calledOnce).to.be.true;
                    expect(handler.calledWith(newElement)).to.be.true;

                } finally {
                    (global as any).MutationObserver = originalMutationObserver;
                }
            });
        });
    });
});
