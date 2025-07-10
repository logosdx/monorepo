import { type EventData } from '../helpers.ts';
import { type Events } from '../types.ts';

export enum QueueRejectionReason {
    full = 'Queue is full',
    notRunning = 'Queue is not running',
}

export type QueueEventData<S, E extends Events<S> | RegExp = Events<S>> = {
    data?: EventData<S, E>,
    _taskId?: string,
    priority?: number,
    reason?: QueueRejectionReason,
    startedAt?: number,
    rateLimited?: boolean,
    elapsed?: number,
    error?: Error,
    force?: boolean,
    pending?: number,
    flushed?: number,
    drained?: number,
    count?: number,
}

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
    added: QueueEventData<S, E>;
    start: void;
    started: void;
    stopped: void;
    processing: QueueEventData<S, E> & { startedAt: number, rateLimited: boolean };
    success: QueueEventData<S, E> & { startedAt: number, elapsed: number, rateLimited: boolean };
    error: QueueEventData<S, E> & { error: Error, rateLimited: boolean };
    timeout: QueueEventData<S, E> & { error: Error, rateLimited: boolean };
    rejected: QueueEventData<S, E> & { reason: QueueRejectionReason };
    'rate-limited': QueueEventData<S, E> & { rateLimited: boolean };
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
