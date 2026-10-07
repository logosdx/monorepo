import { describe, it, expect, afterEach } from 'vitest';
import { isGuardedTarget, keyAction } from '../../../packages/slides/src/keys.ts';

const press = (key: string, init: KeyboardEventInit = {}) => (
    new KeyboardEvent('keydown', { key, ...init })
);

describe('slides: keys', () => {

    afterEach(() => {

        document.body.innerHTML = '';
    });

    describe('isGuardedTarget', () => {

        const mount = (html: string) => {

            document.body.innerHTML = html;

            return document.getElementById('target')!;
        };

        it.each([
            ['an input', '<input id="target">'],
            ['a textarea', '<textarea id="target"></textarea>'],
            ['a select', '<select id="target"></select>'],
            ['a button', '<button id="target">go</button>'],
            ['a summary', '<details><summary id="target">more</summary></details>'],
            ['audio with controls', '<audio id="target" controls></audio>'],
            ['video with controls', '<video id="target" controls></video>'],
            ['a contenteditable element', '<div id="target" contenteditable>edit</div>'],
            ['an element inside a button', '<button><span id="target">go</span></button>'],
            ['an element inside a contenteditable', '<div contenteditable><b id="target">x</b></div>']
        ])('guards %s, so live demos in a slide keep their keys', (_, html) => {

            expect(isGuardedTarget(mount(html))).toBe(true);
        });

        it.each([
            ['a plain element', '<div id="target">text</div>'],
            ['audio without controls', '<audio id="target"></audio>'],
            ['video without controls', '<video id="target"></video>'],
            ['contenteditable="false"', '<div id="target" contenteditable="false">x</div>']
        ])('lets keys through on %s', (_, html) => {

            expect(isGuardedTarget(mount(html))).toBe(false);
        });

        it('lets keys through when the target is the document or missing', () => {

            expect(isGuardedTarget(document)).toBe(false);
            expect(isGuardedTarget(null)).toBe(false);
        });
    });

    describe('keyAction', () => {

        it.each([
            ['ArrowRight', 'nextColumn'],
            ['ArrowLeft', 'prevColumn'],
            ['ArrowDown', 'down'],
            ['ArrowUp', 'up'],
            [' ', 'next'],
            ['PageDown', 'nextPanel'],
            ['PageUp', 'prevPanel'],
            ['Home', 'first'],
            ['End', 'last'],
            ['s', 'notes'],
            ['S', 'notes'],
            ['f', 'fullscreen'],
            ['F', 'fullscreen'],
            ['.', 'blank'],
            ['b', 'blank'],
            ['B', 'blank'],
            ['?', 'help'],
            ['Escape', 'dismiss']
        ])('maps %j to %s', (key, action) => {

            expect(keyAction(press(key))).toBe(action);
        });

        it('maps Shift+Space to prev', () => {

            expect(keyAction(press(' ', { shiftKey: true }))).toBe('prev');
        });

        it.each([
            ['Ctrl', { ctrlKey: true }],
            ['Meta', { metaKey: true }],
            ['Alt', { altKey: true }]
        ])('ignores keys with %s held, leaving browser shortcuts alone', (_, init) => {

            expect(keyAction(press('ArrowRight', init))).toBeNull();
            expect(keyAction(press('f', init))).toBeNull();
        });

        it('ignores keys the deck does not use', () => {

            expect(keyAction(press('a'))).toBeNull();
            expect(keyAction(press('Enter'))).toBeNull();
            expect(keyAction(press('toString'))).toBeNull();
        });
    });
});
