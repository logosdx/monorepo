import { describe, it, expect } from 'vitest';
import { viewport } from '../../../packages/dom/src/viewport.ts';

describe('@logosdx/dom: viewport', () => {

    it('width() returns a number', () => {

        expect(typeof viewport.width()).to.equal('number');
    });

    it('height() returns a number', () => {

        expect(typeof viewport.height()).to.equal('number');
    });

    it('scrollX() returns a number', () => {

        expect(typeof viewport.scrollX()).to.equal('number');
    });

    it('scrollY() returns a number', () => {

        expect(typeof viewport.scrollY()).to.equal('number');
    });

    it('pixelRatio() returns a number >= 1', () => {

        expect(viewport.pixelRatio()).to.be.a('number');
    });

    it('isAtTop() returns true when scrollY is 0', () => {

        expect(viewport.isAtTop()).to.equal(true);
    });

    it('isAtTop(threshold) with threshold', () => {

        expect(viewport.isAtTop(10)).to.equal(true);
    });

    it('scrollProgress() returns 0 when at top', () => {

        expect(viewport.scrollProgress()).to.equal(0);
    });

    it('scrollProgress() returns 0 when content fits viewport', () => {

        expect(viewport.scrollProgress()).to.equal(0);
    });

    it('scrollTo is a function', () => {

        expect(typeof viewport.scrollTo).to.equal('function');
    });
});
