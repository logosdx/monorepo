const { JSDOM } = require('jsdom');

const DOM = new JSDOM('', {
    url: 'http://localhost'
});

global.window = DOM.window;
global.document = DOM.document;
