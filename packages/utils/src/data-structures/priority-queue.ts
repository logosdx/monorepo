interface Node<T> {
    value: T;
    priority: number;
    order: number;
}

export interface PriorityQueueOptions<T> {
    /**
     * When true, items with equal priority are dequeued in LIFO order (newest first).
     * When false (default), items with equal priority are dequeued in FIFO order (oldest first).
     */
    lifo?: boolean;

    /**
     * The compare function to use for sorting the queue.
     *
     * @default (a, b) => a.priority - b.priority
     */
    compare?: (a: Node<T>, b: Node<T>) => number;

    /**
     * Invert the priority order.
     *
     * @default false
     */
    maxHeap?: boolean;
}

const fifoCompare = <T>(a: Node<T>, b: Node<T>): number => {

    if (a.priority === b.priority) {

        return a.order - b.order;
    }

    return a.priority - b.priority;
}

const lifoCompare = <T>(a: Node<T>, b: Node<T>): number => {

    if (a.priority === b.priority) {

        return b.order - a.order;
    }

    return a.priority - b.priority;
}

/**
 * A pure data structure that maintains a set of ordered items by numeric priority.
 * Lower priority numbers dequeue first. Ties are broken by insertion order.
 *
 * Time Complexity:
 * - Enqueue: O(log n)
 * - Dequeue: O(log n)
 * - Peek: O(1)
 *
 * Space Complexity: O(n) where n is the number of items in the queue
 */
export class PriorityQueue<T> {
    private heap: Node<T>[] = [];
    private insertionCounter = 0;
    private compare: (a: Node<T>, b: Node<T>) => number;

    private options: PriorityQueueOptions<T>;

    constructor(options: PriorityQueueOptions<T> = {}) {

        /**
         * Default compare function
         */
        this.compare = options.lifo ? lifoCompare : fifoCompare;

        if (options.compare) {
            this.compare = options.compare;
        }

        if (options.maxHeap) {

            const originalCompare = this.compare;
            this.compare = (a, b) => -originalCompare(a, b);
        }

        this.options = options;

    }

    /**
     * Adds a new item into the queue.
     * @param value The payload associated with the item
     * @param priority Numeric priority (lower = higher priority)
     *
     * Time Complexity: O(log n)
     * Space Complexity: O(1)
     */
    push(value: T, priority: number = 0): void {

        const node: Node<T> = { value, priority, order: this.insertionCounter++ };
        this.heap.push(node);
        this.bubbleUp(this.heap.length - 1);
    }

    /**
     * Removes and returns the highest-priority item.
     * Returns null if the queue is empty.
     *
     * Time Complexity: O(log n)
     * Space Complexity: O(1)
     */
    pop(): T | null {

        if (this.heap.length === 0) return null;

        const top = this.heap[0];
        const last = this.heap.pop()!;

        if (this.heap.length > 0) {

            this.heap[0] = last;
            this.bubbleDown(0);
        }

        return top!.value;
    }

    /**
     * Removes and returns many items from the queue.
     * Returns an empty array if the queue is empty.
     */
    popMany(count: number = 1): T[] {

        const items: T[] = [];

        if (count === 0) {
            return items;
        }

        if (count > this.heap.length) {
            count = this.heap.length;
        }

        for (let i = count; i > 0; i--) {
            items.push(this.pop()!);
        }

        return items;
    }

    /**
     * Returns the next item to be dequeued without removing it.
     */
    peek(): T | null {

        return this.isEmpty() ? null : this.heap[0]!.value;
    }

    /**
     * Returns the next item to be dequeued without removing it.
     */
    peekMany(count: number = 1): T[] {
        return this.heap.slice(0, count).map(node => node.value);
    }

    /**
     * Find an item in the queue by predicate.
     */
    find(predicate: (value: T) => boolean): T | null {

        return this.heap.find(node => predicate(node.value))?.value ?? null;
    }

    /**
     * Heapify the queue.
     *
     * Time Complexity: O(n)
     * Space Complexity: O(n)
     */
    heapify(items: Node<T>[]): void {

        this.heap = items.slice(0);
        this.insertionCounter = items.length;

        for (let i = Math.floor(this.heap.length / 2); i >= 0; i--) {
            this.bubbleDown(i);
        }
    }

    clone(): PriorityQueue<T> {

        const clone = new PriorityQueue<T>(this.options);

        clone.heapify(this.heap);

        return clone;
    }

    /**
     * Returns a sorted array of the queue.
     */
    toSortedArray(): T[] {

        const clone = this.clone();
        const sorted: T[] = [];

        while (clone.heap.length > 0) {
            sorted.push(clone.pop()!);
        }

        return sorted;
    }

    /**
     * Returns an iterator over the queue.
     */
    *[Symbol.iterator](): IterableIterator<T> {

        const clone = this.clone();

        while (clone.heap.length > 0) {
            yield clone.pop()!;
        }
    }

    /**
     * Returns the number of items in the queue.
     */
    size(): number {

        return this.heap.length;
    }

    /**
     * Returns true if the queue is empty.
     */
    isEmpty(): boolean {

        return this.heap.length === 0;
    }

    /**
     * Clears all items and resets the insertion counter.
     */
    clear(): void {

        this.heap = [];
        this.insertionCounter = 0;
    }

    /**
     * Moves the node at index up to restore heap invariant.
     *
     * Time Complexity: O(log n)
     * Space Complexity: O(1)
     */
    private bubbleUp(index: number): void {

        let idx = index;

        while (idx > 0) {

            const parentIdx = (idx - 1) >> 1;

            if (this.compare(this.heap[idx]!, this.heap[parentIdx]!) < 0) {

                this.swap(idx, parentIdx);
                idx = parentIdx;
            }
            else {

                break;
            }
        }
    }

    /**
     * Moves the node at index down to restore heap invariant.
     *
     * Time Complexity: O(log n)
     * Space Complexity: O(1)
     */
    private bubbleDown(index: number): void {

        const length = this.heap.length;
        let idx = index;

        while (true) {

            const left = (idx << 1) + 1;
            const right = left + 1;
            let smallest = idx;

            if (left < length && this.compare(this.heap[left]!, this.heap[smallest]!) < 0) {

                smallest = left;
            }
            if (right < length && this.compare(this.heap[right]!, this.heap[smallest]!) < 0) {

                smallest = right;
            }
            if (smallest === idx) {

                break;
            }

            this.swap(idx, smallest);
            idx = smallest;
        }
    }

    /**
     * Swaps two nodes in the heap.
     */
    private swap(i: number, j: number): void {

        [this.heap[i], this.heap[j]] = [this.heap[j]!, this.heap[i]!];
    }
}
