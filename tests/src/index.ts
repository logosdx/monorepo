import { JSDOM } from 'jsdom';
import { importTestFiles, setup, teardown } from './_helpers';
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

    await importTestFiles(
        __dirname,
        args
    );
}

run();