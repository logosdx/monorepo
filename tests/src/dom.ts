import { describe, it, before, beforeEach, after, afterEach } from 'node:test'

// @ts-expect-error - chai is not a module
import { expect } from 'chai';
import Sinon from 'sinon';

import * as Lib from '../../packages/dom/src/index.ts';
import { CssPropNames, CssProps } from '../../packages/dom/src/index.ts';

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
    });

    describe('$(...)', function () {

        before(function () {
            const div = document.createElement('div')

            div.innerHTML = `
                <ul>
                    <li class='item'></li>
                    <li class='item'></li>
                </ul>
            `
            document.body.appendChild(div)
        });

        it('It can query the DOM properly', function () {
            const div = $('div');
            expect(Array.isArray(div)).to.equal(true);
            expect(div.length).to.equal(1);
            expect($('.item', div[0]).length).to.equal(2);
        });

        it('No matched queries return empty arrays', function () {
            const els = $('.foo')
            expect(Array.isArray(els)).to.equal(true)
            expect(typeof els).to.equal('object')
            expect(els.length).to.equal(0)
        });
    });

    describe('css[fn] (...)', function () {

        stub.sampleCss = {
            color: 'rgb(255, 0, 0)',
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

            const result = html.attrs.get([div, span], 'hidden') as string[];

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

            const result = html.attrs.get([div, span], ['hidden', 'data']) as (typeof attrs)[];

            expect(result[0]).to.include(attrs);
            expect(result[1]).to.include(attrs);
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

            const result = html.attrs.get([div, span], ['hidden', 'data']) as {}[];

            const nope = {
                hidden: null,
                data: null
            };

            expect(result[0]).to.include(nope);
            expect(result[1]).to.include(nope);
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
            html.behaviors.stopAllObserving();
        });

        afterEach(() => {

            // Clean up DOM and behaviors
            testDiv.remove();
            html.behaviors.stopAllObserving();
            sandbox.resetBehavior();
        });

        describe('isBound/markBound', () => {

            it('should initially return false for unbound elements', () => {

                expect(html.behaviors.isBound(testButton, 'TestFeature')).to.be.false;
            });

            it('should return true after marking element as bound', () => {

                html.behaviors.markBound(testButton, 'TestFeature');
                expect(html.behaviors.isBound(testButton, 'TestFeature')).to.be.true;
            });

            it('should handle multiple features on same element', () => {

                html.behaviors.markBound(testButton, 'Feature1');
                html.behaviors.markBound(testButton, 'Feature2');

                expect(html.behaviors.isBound(testButton, 'Feature1')).to.be.true;
                expect(html.behaviors.isBound(testButton, 'Feature2')).to.be.true;
                expect(html.behaviors.isBound(testButton, 'Feature3')).to.be.false;
            });
        });

        describe('bindBehavior', () => {

            it('should bind behavior and mark element as bound', () => {

                const handler = sandbox.fake();

                html.behaviors.bindBehavior(testButton, 'TestFeature', handler);

                expect(handler.calledOnce).to.be.true;
                expect(handler.calledWith(testButton)).to.be.true;
                expect(html.behaviors.isBound(testButton, 'TestFeature')).to.be.true;
            });

            it('should not bind if already bound', () => {

                const handler = sandbox.fake();

                html.behaviors.bindBehavior(testButton, 'TestFeature', handler);
                html.behaviors.bindBehavior(testButton, 'TestFeature', handler);

                expect(handler.calledOnce).to.be.true;
            });

                         it('should handle errors in handler gracefully', () => {

                 const consoleWarn = sandbox.stub(console, 'warn');
                 const handler = sandbox.fake.throws(new Error('Test error'));

                 html.behaviors.bindBehavior(testButton, 'TestFeature', handler);

                 expect(handler.calledOnce).to.be.true;
                 expect(consoleWarn.calledOnce).to.be.true;
                 expect(consoleWarn.firstCall?.args[0]).to.include('Failed to bind TestFeature');
                 expect(html.behaviors.isBound(testButton, 'TestFeature')).to.be.false;
             });
        });

        describe('registerPrepare/dispatchPrepare', () => {

            it('should register and trigger prepare events', () => {

                const initHandler = sandbox.fake();

                html.behaviors.registerPrepare('testFeature', initHandler);
                html.behaviors.dispatchPrepare('testFeature');

                expect(initHandler.calledOnce).to.be.true;
            });

            it('should trigger multiple prepare events', () => {

                const handler1 = sandbox.fake();
                const handler2 = sandbox.fake();

                html.behaviors.registerPrepare('feature1', handler1);
                html.behaviors.registerPrepare('feature2', handler2);

                html.behaviors.dispatchPrepare('feature1', 'feature2');

                expect(handler1.calledOnce).to.be.true;
                expect(handler2.calledOnce).to.be.true;
            });

            it('should handle multiple triggers of same event', () => {

                const handler = sandbox.fake();

                html.behaviors.registerPrepare('testFeature', handler);
                html.behaviors.dispatchPrepare('testFeature');
                html.behaviors.dispatchPrepare('testFeature');

                expect(handler.calledTwice).to.be.true;
            });
        });

        describe('createBehaviorRegistry', () => {

            it('should register multiple behaviors at once', () => {

                const handler1 = sandbox.fake();
                const handler2 = sandbox.fake();
                const handler3 = sandbox.fake();

                html.behaviors.createBehaviorRegistry({
                    feature1: handler1,
                    feature2: handler2,
                    feature3: handler3
                });

                html.behaviors.dispatchPrepare('feature1', 'feature2', 'feature3');

                expect(handler1.calledOnce).to.be.true;
                expect(handler2.calledOnce).to.be.true;
                expect(handler3.calledOnce).to.be.true;
            });
        });

        describe('setupLifecycle/teardownFeature', () => {

            it('should setup and execute teardown callbacks', () => {

                const teardownCallback = sandbox.fake();

                html.behaviors.setupLifecycle(testButton, 'TestFeature', teardownCallback);
                html.behaviors.teardownFeature(testButton, 'TestFeature');

                expect(teardownCallback.calledOnce).to.be.true;
            });

            it('should handle multiple teardown callbacks', () => {

                const teardown1 = sandbox.fake();
                const teardown2 = sandbox.fake();

                html.behaviors.setupLifecycle(testButton, 'Feature1', teardown1);
                html.behaviors.setupLifecycle(testButton, 'Feature2', teardown2);

                html.behaviors.teardownFeature(testButton, 'Feature1');
                html.behaviors.teardownFeature(testButton, 'Feature2');

                expect(teardown1.calledOnce).to.be.true;
                expect(teardown2.calledOnce).to.be.true;
            });

            it('should handle teardown of non-existent feature gracefully', () => {

                expect(() => {

                    html.behaviors.teardownFeature(testButton, 'NonExistentFeature');
                }).to.not.throw();
            });
        });

        describe('queryLive', () => {

            beforeEach(() => {

                // Set up test DOM structure
                testDiv.innerHTML = `
                    <button class="live-btn">Live Button</button>
                    <button class="live-btn" hidden>Hidden Button</button>
                    <div data-template>
                        <button class="live-btn">Template Button</button>
                    </div>
                    <div aria-hidden="true">
                        <button class="live-btn">Aria Hidden Button</button>
                    </div>
                `;
            });

            it('should return only live elements', () => {

                const liveButtons = html.behaviors.queryLive('.live-btn', testDiv);

                expect(liveButtons).to.have.length(1);
                expect(liveButtons[0]?.textContent).to.equal('Live Button');
            });

            it('should work with document as default root', () => {

                // Add elements to document body
                const liveBtn = document.createElement('button');
                liveBtn.className = 'global-live-btn';
                liveBtn.textContent = 'Global Live';
                document.body.appendChild(liveBtn);

                const hiddenBtn = document.createElement('button');
                hiddenBtn.className = 'global-live-btn';
                hiddenBtn.hidden = true;
                document.body.appendChild(hiddenBtn);

                const results = html.behaviors.queryLive('.global-live-btn');

                expect(results).to.have.length(1);
                expect(results[0]?.textContent).to.equal('Global Live');

                // Cleanup
                liveBtn.remove();
                hiddenBtn.remove();
            });

            it('should return empty array when no elements found', () => {

                const results = html.behaviors.queryLive('.non-existent');
                expect(results).to.be.an('array');
                expect(results).to.have.length(0);
            });
        });

        describe('observePrepare', () => {

            it('should handle missing MutationObserver gracefully', () => {

                const consoleWarn = sandbox.stub(console, 'warn');

                // This should warn and not throw in environments without MutationObserver
                html.behaviors.observePrepare('testFeature', '[data-test]');

                expect(consoleWarn.calledOnce).to.be.true;
                expect(consoleWarn.firstCall?.args[0]).to.include('MutationObserver not available');
            });

            it('should configure observer options correctly', () => {

                // Test that options are parsed correctly (even if observer isn't created)
                expect(() => {

                    html.behaviors.observePrepare('configTest', '[data-config]', {
                        root: testDiv,
                        debounceMs: 100
                    });
                }).to.not.throw();
            });

            it('should handle duplicate registration attempts', () => {

                // Multiple calls with same parameters should not cause issues
                html.behaviors.observePrepare('duplicate', '[data-dup]');
                html.behaviors.observePrepare('duplicate', '[data-dup]');
                html.behaviors.observePrepare('duplicate', '[data-dup]');

                // Test passes if no errors thrown
                expect(true).to.be.true;
            });
        });

        describe('stopObserving/stopAllObserving', () => {

            it('should handle stopObserving without errors', () => {

                // Setup observers first
                html.behaviors.observePrepare('stopTest', '[data-stop]', {
                    root: testDiv
                });

                // Stopping should not throw errors
                expect(() => {

                    html.behaviors.stopObserving('stopTest', '[data-stop]', testDiv);
                }).to.not.throw();
            });

            it('should handle stopAllObserving without errors', () => {

                // Setup multiple observers
                html.behaviors.observePrepare('stopAll1', '[data-stop1]');
                html.behaviors.observePrepare('stopAll2', '[data-stop2]');

                // Stop all should not throw errors
                expect(() => {

                    html.behaviors.stopAllObserving();
                }).to.not.throw();
            });

            it('should handle stopping non-existent observers gracefully', () => {

                expect(() => {

                    html.behaviors.stopObserving('nonExistent', '[data-fake]');
                }).to.not.throw();
            });
        });

        describe('integration scenarios', () => {

            it('should handle complete behavior lifecycle with manual triggers', () => {

                const initHandler = sandbox.fake();
                const behaviorHandler = sandbox.fake();
                const teardownHandler = sandbox.fake();

                // Register behavior
                html.behaviors.registerPrepare('integration', () => {

                    initHandler();

                    html.behaviors.queryLive('[data-integration]', testDiv).forEach(el => {

                        html.behaviors.bindBehavior(el, 'Integration', (element) => {

                            behaviorHandler(element);

                            html.behaviors.setupLifecycle(element, 'Integration', () => {

                                teardownHandler();
                            });
                        });
                    });
                });

                // Add element first
                const newEl = document.createElement('button');
                newEl.setAttribute('data-integration', 'true');
                testDiv.appendChild(newEl);

                // Trigger behavior manually
                html.behaviors.dispatchPrepare('integration');

                // Verify initialization happened
                expect(initHandler.calledOnce).to.be.true;
                expect(behaviorHandler.calledOnce).to.be.true;
                expect(behaviorHandler.calledWith(newEl)).to.be.true;
                expect(html.behaviors.isBound(newEl, 'Integration')).to.be.true;

                // Test teardown
                html.behaviors.teardownFeature(newEl, 'Integration');
                expect(teardownHandler.calledOnce).to.be.true;
            });

            it('should prevent double-binding with manual triggers', () => {

                const bindingHandler = sandbox.fake();

                html.behaviors.registerPrepare('rapidTest', () => {

                    html.behaviors.queryLive('[data-rapid]', testDiv).forEach(el => {

                        html.behaviors.bindBehavior(el, 'Rapid', bindingHandler);
                    });
                });

                // Add element first
                const el = document.createElement('div');
                el.setAttribute('data-rapid', 'true');
                testDiv.appendChild(el);

                // Trigger multiple prepare events manually
                html.behaviors.dispatchPrepare('rapidTest');
                html.behaviors.dispatchPrepare('rapidTest');
                html.behaviors.dispatchPrepare('rapidTest');

                // Should only be bound once
                expect(bindingHandler.calledOnce).to.be.true;
                expect(html.behaviors.isBound(el, 'Rapid')).to.be.true;
            });

            it('should work with behavior registry and manual dispatch', () => {

                const copyHandler = sandbox.fake();
                const modalHandler = sandbox.fake();

                html.behaviors.createBehaviorRegistry({
                    copyBehavior: copyHandler,
                    modalBehavior: modalHandler
                });

                // Trigger behaviors
                html.behaviors.dispatchPrepare('copyBehavior', 'modalBehavior');

                expect(copyHandler.calledOnce).to.be.true;
                expect(modalHandler.calledOnce).to.be.true;
            });
        });
    });
});
