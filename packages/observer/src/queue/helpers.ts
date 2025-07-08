import { type EventData } from '../helpers.ts';
import { type Events } from '../types.ts';

export enum QueueRejectionReason {
    full = 'Queue is full',
    notRunning = 'Queue is not running',
}

export type QueueItem<S, E extends Events<S> | RegExp = Events<S>> = {
    data: EventData<S, E>,
    _taskId: string,
    priority?: number
};

export type QueueEventNames = (
  | `added`
  | `start`
  | `started`
  | `stopped`
  | `processing`
  | `success`
  | `error`
  | `timeout`
  | `rate-limited`
  | `empty`
  | `idle`
  | `rejected`
  | `drain`
  | `drained`
  | `flush`
  | `flushed`
  | `paused`
  | `resumed`
  | `cleanup`
  | `purged`
  | `shutdown`
);

export type QueueEvents<S extends Record<string, any>, E extends Events<S> | RegExp = Events<S>> = {
    added: QueueItem<S, E>;
    start: void;
    started: void;
    stopped: void;
    processing: QueueItem<S, E> & { startedAt: number, rateLimited: boolean };
    success: QueueItem<S, E> & { startedAt: number, elapsed: number, rateLimited: boolean };
    error: QueueItem<S, E> & { error: Error, rateLimited: boolean };
    timeout: QueueItem<S, E> & { error: Error, rateLimited: boolean };
    rejected: QueueItem<S, E> & { reason: QueueRejectionReason };
    'rate-limited': QueueItem<S, E> & { rateLimited: boolean };
    empty: void;
    idle: void;
    drain: { pending: number };
    drained: { pending?: number, drained?: number };
    flush: { pending: number };
    flushed: { flushed: number };
    paused: void;
    resumed: void;
    cleanup: void;
    purged: { count: number };
    shutdown: { force: boolean, pending?: number };
}
