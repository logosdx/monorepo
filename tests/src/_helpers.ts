import Sinon from "sinon";

const globalConsole = globalThis.console;
const globalLog = console.log;
const globalError = console.error;
const globalWarn = console.warn;
const globalInfo = console.info;
const globalDebug = console.debug;
const globalTrace = console.trace;

export const log = Object.assign(
    globalLog.bind(globalConsole),
    {
        info: globalLog,
        error: globalError,
        warn: globalWarn,
        debug: globalDebug,
        trace: globalTrace
    }
) as typeof globalLog & Omit<typeof globalConsole, 'log'>;

export const sandbox = Sinon.createSandbox();
export const stubLog = sandbox.stub();
export const stubError = sandbox.stub();
export const stubWarn = sandbox.stub();
export const stubInfo = sandbox.stub();
export const stubDebug = sandbox.stub();
export const stubTrace = sandbox.stub();

export const setup = () => {

    // globalThis.console = {
    //     ...globalConsole,
    //     log: stubLog,
    //     error: stubError,
    //     warn: stubWarn,
    //     info: stubInfo,
    //     debug: stubDebug,
    //     trace: stubTrace
    // }
}

export const teardown = () => {

    globalThis.console = globalConsole;
}