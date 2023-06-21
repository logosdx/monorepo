/**
 * In order for LogosUI to work on the backend
 * as well as the frontend, we need to stub some things.
 * Obviously, there are many tools that will be useless
 * on the backend, but things like observable, localize,
 * and state machine should be able to work just fine.
 */

const windowStub = {

    addEventListener() {},
    postMessage() {},
    getComputedStyle(): any {},
    CustomEvent: Event,
    scrollY: 0,
    pageYOffset: 0,
    scrollX: 0,
    pageXOffset: 0,

    document: {
        querySelectorAll(): any[] { return []; },
        createElement(): any {},

        body: {

            appendChild() {},
            removeChild() {},
            scrollHeight: 0,
            offsetHeight: 0,
            scrollWidth: 0,
            offsetWidth: 0,
            documentElement: {
                clientHeight: 0,
                scrollHeight: 0,
                offsetHeight: 0,
                clientWidth: 0,
                scrollWidth: 0,
                offsetWidth: 0,
                scrollLeft: 0,
                scrollTop: 0,
            }
        }
    }
};

global.window = global.window || windowStub;
