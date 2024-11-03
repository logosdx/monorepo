import { JSDOM } from 'jsdom';
import { readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { setup, teardown } from './_helpers';
import { afterEach, beforeEach } from 'node:test';

const DOM = new JSDOM('', {
    url: 'http://localhost'
});

global.window = DOM.window as never;
global.document = DOM.window.document;

const args = process.argv.slice(2);

const run = async () => {

    beforeEach(setup);
    afterEach(teardown);

    const files = readdirSync(
        __dirname
    )
    .filter(
        (file) => (
            statSync(join(__dirname, file)).isFile() &&
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
    )

    for (const file of files) {

        await import(
            join(__dirname, file)
        );
    }
}

run();