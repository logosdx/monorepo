import { JSDOM } from 'jsdom';
import { readdirSync } from 'fs';

const DOM = new JSDOM('', {
    url: 'http://localhost'
});

global.window = DOM.window as never;
global.document = DOM.window.document;

readdirSync(
    __dirname
).forEach(
    (file) => import(`./${file}`)
);