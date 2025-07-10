import { type ObserverEngine } from '../engine.ts';

export class QueueStats {

    #processing: number = 0;
    #processed: number = 0;
    #avgProcessingTime: number = 0;
    #success: number = 0;
    #error: number = 0;
    #rejected: number = 0;

    constructor(
        private observer: ObserverEngine<any>,
        private queueName: string
    ) {

        this.observer.on(
            `queue:${this.queueName}:processing`,
            () => {
                this.#processing++;
            }
        );

        this.observer.on(
            `queue:${this.queueName}:success`,
            ({ elapsed }) => {

                this.#processed++
                this.#success++;
                this.#processing--;
                this.#calculateAvg(elapsed);
            }
        );

        this.observer.on(
            `queue:${this.queueName}:error`,
            () => {
                this.#processed++
                this.#error++;
                this.#processing--;
            }
        );

        this.observer.on(
            `queue:${this.queueName}:rejected`,
            () => this.#rejected++
        );
    }

    #calculateAvg(elapsed: number) {
        this.#avgProcessingTime = (
            ((this.#avgProcessingTime * (this.#success - 1)) +
            elapsed) /
            this.#success
        );
    }

    get stats() {
        return {
            processed: this.#processed,
            processing: this.#processing,
            avgProcessingTime: this.#avgProcessingTime,
            success: this.#success,
            error: this.#error,
            rejected: this.#rejected,
        }
    }
}
