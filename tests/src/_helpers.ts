import { readdirSync, statSync } from 'fs';
import { basename, join } from 'path';
import Sinon from 'sinon';
import { Mock, mock } from 'node:test';

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

const forwardTo = (...fns: ((...args: any[]) => void)[]) => {

    return (...args: any[]) => {
        fns.forEach(fn => fn(...args));
    }
}

export const setup = () => {

    globalThis.console = {
        ...globalConsole,
        log: forwardTo(stubLog, globalLog),
        error: forwardTo(stubError, globalError),
        warn: forwardTo(stubWarn, globalWarn),
        info: forwardTo(stubInfo, globalInfo),
        debug: forwardTo(stubDebug, globalDebug),
        trace: forwardTo(stubTrace, globalTrace)
    }
}

export const teardown = () => {

    globalThis.console = globalConsole;
}

export const importTestFiles = async (
    from: string,
    args: string[]
) => {

    const dirResults = readdirSync(
        from
    );

    const files = dirResults.filter((f) => statSync(join(from, f)).isFile());
    const folders = dirResults.filter((f) => statSync(join(from, f)).isDirectory());

    const inArgs = (file: string) => (
        args.length === 0 ||
        args.includes(
            basename(file, '.ts')
        ) ||
        args.some(
            (arg) => join(from, file).includes(arg)
        )
    )

    const importable = files.filter(
        (file) => (
            statSync(join(from, file)).isFile() &&
            file.endsWith('.ts') &&
            !file.endsWith('.d.ts') &&
            !file.startsWith('index') &&
            !file.startsWith('_') &&
            inArgs(file)
        )
    );

    for (const folder of folders) {

        await importTestFiles(
            join(from, folder),
            args
        );
    }

    for (const file of importable) {

        await import(
            join(from, file)
        );
    }
}

export const mockHelpers = (expect: Chai.ExpectStatic) => {

    const calledExactly = (mock: Mock<any>, n: number, desc?: string) => {

        expect(mock.mock.callCount(), desc).to.equal(n);
    }

    const calledMoreThan = (mock: Mock<any>, n: number, desc?: string) => {

        expect(mock.mock.callCount(), desc).to.be.greaterThan(n);
    }

    const calledAtLeast = (mock: Mock<any>, n: number, desc?: string) => {

        expect(mock.mock.callCount(), desc).to.be.at.least(n);
    }

    return {
        calledExactly,
        calledMoreThan,
        calledAtLeast
    }
}


export const nextTick = () => new Promise(resolve => process.nextTick(resolve));

// You must tick the timers first then drain the event loop,
// otherwise, the timers will only apply to the current event loop.
// setTimeout pushes functions to the next event loop.
// Any `wait()` or `setTimeout()` logic wont be run unless the next
// event loop enqueues the function.
export const runTimers = async (tickTime: number | number[] = 0, nTimes = 1) => {

    for (let i = 0; i < nTimes; i++) {

        if (Array.isArray(tickTime)) {

            for (const t of tickTime) {

                if (t > 0) {
                    mock.timers.tick(t);
                    await nextTick();
                }
            }

            continue;
        }

        if (tickTime > 0) {
            mock.timers.tick(tickTime);
        }

        await nextTick();
    }
}
