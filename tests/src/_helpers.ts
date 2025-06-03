import { readdirSync, statSync } from 'fs';
import { basename, join } from 'path';
import Sinon from 'sinon';

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

    const importable = files.filter(
        (file) => (
            statSync(join(from, file)).isFile() &&
            file.endsWith('.ts') &&
            !file.endsWith('.d.ts') &&
            !file.startsWith('index') &&
            !file.startsWith('_') &&
            (
                args.length === 0 ||
                args.includes(
                    basename(file, '.ts')
                )
            )
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