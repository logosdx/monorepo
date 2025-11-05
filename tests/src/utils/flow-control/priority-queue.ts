import { test, describe } from 'node:test'

import { expect } from 'chai';

import { PriorityQueue } from '../../../../packages/utils/src/index.ts';

describe('PriorityQueue', () => {

    test('empty queue behavior', () => {
        const pq = new PriorityQueue<number>();
        expect(pq.size()).to.equal(0);
        expect(pq.isEmpty()).to.be.true;
        expect(pq.peek()).to.be.null;
        expect(pq.pop()).to.be.null;
    });

    test('enqueue and size', () => {
        const pq = new PriorityQueue<string>();
        pq.push('a', 1);
        pq.push('b', 2);
        expect(pq.size()).to.equal(2);
        expect(pq.isEmpty()).to.be.false;
    });

    test('priority ordering', () => {
        const pq = new PriorityQueue<string>();
        pq.push('low1', 10);
        pq.push('low2', 10);
        pq.push('high1', 1);
        pq.push('high2', 1);
        pq.push('medium1', 5);
        pq.push('medium2', 5);

        expect(pq.pop()).to.equal('high1');
        expect(pq.pop()).to.equal('high2');
        expect(pq.pop()).to.equal('medium1');
        expect(pq.pop()).to.equal('medium2');
        expect(pq.pop()).to.equal('low1');
        expect(pq.pop()).to.equal('low2');
    });

    test('FIFO tie-breaking (default)', () => {
        const pq = new PriorityQueue<string>();
        pq.push('first', 0);
        pq.push('second', 0);
        expect(pq.pop()).to.equal('first');
        expect(pq.pop()).to.equal('second');
    });

    test('LIFO tie-breaking', () => {
        const pq = new PriorityQueue<string>({ lifo: true });
        pq.push('first', 0);
        pq.push('second', 0);
        expect(pq.pop()).to.equal('second');
        expect(pq.pop()).to.equal('first');
    });

    test('peek does not remove', () => {
        const pq = new PriorityQueue<number>();
        pq.push(42, 0);
        expect(pq.peek()).to.equal(42);
        expect(pq.size()).to.equal(1);
        expect(pq.pop()).to.equal(42);
    });

    test('clear resets queue', () => {
        const pq = new PriorityQueue<number>();
        pq.push(1, 1);
        pq.push(2, 2);
        pq.clear();
        expect(pq.size()).to.equal(0);
        expect(pq.isEmpty()).to.be.true;
        expect(pq.peek()).to.be.null;
        expect(pq.pop()).to.be.null;
    });

    test('find', () => {
        const pq = new PriorityQueue<number>();
        pq.push(1, 1);
        pq.push(2, 2);
        expect(pq.find((v) => v === 1)).to.equal(1);
        expect(pq.find((v) => v === 2)).to.equal(2);
        expect(pq.find((v) => v === 3)).to.be.null;
    });

    test('peekMany', () => {
        const pq = new PriorityQueue<number>();
        pq.push(1, 1);
        pq.push(2, 2);
        expect(pq.peekMany()).to.deep.equal([1]);
        expect(pq.peekMany(2)).to.deep.equal([1, 2]);
    });

    test('popMany', () => {
        const pq = new PriorityQueue<number>();
        pq.push(1, 2);
        pq.push(2, 1);
        expect(pq.popMany(2)).to.deep.equal([2, 1]);
        expect(pq.popMany(1)?.length).to.equal(0);
    });

    test('heapify', () => {
        const pq = new PriorityQueue<number>();

        pq.heapify([
            { value: 1, priority: 5, order: 0 },
            { value: 2, priority: 5, order: 1 },
            { value: 3, priority: 3, order: 2 },
            { value: 4, priority: 3, order: 3 },
            { value: 5, priority: 5, order: 4 },
        ]);

        expect(pq.toSortedArray()).to.deep.equal([3, 4, 1, 2, 5]);
    });

    test('toSortedArray', () => {

        const pq = new PriorityQueue<number>();
        pq.push(1, 2);
        pq.push(2, 1);
        expect(pq.toSortedArray()).to.deep.equal([2, 1]);
    });

    test('iterator', () => {
        const pq = new PriorityQueue<number>();
        pq.push(1, 2);
        pq.push(2, 1);
        expect(Array.from(pq)).to.deep.equal([2, 1]);
    });

});
