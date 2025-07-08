import { assert } from '@logosdx/utils';

export enum QueueState {
    running = 'running',
    paused = 'paused',
    stopped = 'stopped',
    draining = 'draining',
}

export class QueueStateManager {

    status: QueueState = QueueState.stopped;

    #allowedTransitions: Record<QueueState, QueueState[]> = {
        [QueueState.running]: [QueueState.paused, QueueState.draining, QueueState.stopped],
        [QueueState.draining]: [QueueState.stopped, QueueState.paused],
        [QueueState.paused]: [QueueState.running, QueueState.draining, QueueState.stopped],
        [QueueState.stopped]: [QueueState.running, QueueState.draining],
    };

    transition(to: keyof typeof QueueState) {

        assert(
            this.#allowedTransitions[this.status].includes(to as QueueState),
            `Invalid transition from ${this.status} to ${to}`
        );

        this.status = to as QueueState;
    }

    is(...states: (keyof typeof QueueState)[]) {
        return states.includes(this.status);
    }

    get state() {
        return this.status;
    }
}
