import type { DeliveryTracking } from '@/services/tracking';
import type { StreamFailure, TrackingStreamHandlers } from '@/services/tracking-stream';

/**
 * - connecting: first attempt, nothing received yet
 * - open: the stream is up; it is the primary source and polling is off
 * - reconnecting: the stream dropped or failed; a retry is scheduled and polling is the fallback
 * - closed: stopped for good (ended, not allowed, screen left); polling alone continues if needed
 */
export type ConnectionState = 'connecting' | 'open' | 'reconnecting' | 'closed';

/** Delay before retry n (1-based); the last value repeats. Bounded: at most one try per 30 s. */
export const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 20_000, 30_000];

type OpenStream = (deliveryId: string, handlers: TrackingStreamHandlers) => () => void;

export type RealtimeCallbacks = {
  onSnapshot(snapshot: DeliveryTracking): void;
  /** `since` is when the state began (ms epoch). */
  onState(state: ConnectionState, since: number): void;
};

type Clock = {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

function devLog(message: string) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.info(`[tracking] ${message}`);
}

/**
 * Keeps one realtime tracking stream alive for one delivery while the order screen is focused: one
 * connection at a time, capped backoff between attempts, stops on ENDED, on a final (auth/not found)
 * failure, or when stopped. Knows nothing about what snapshots mean or how they are shown.
 */
export class TrackingRealtime {
  private state: ConnectionState = 'closed';
  private closeStream: (() => void) | null = null;
  private retryTimer: unknown = null;
  private failures = 0;
  private running = false;
  private attempt = 0;

  constructor(
    private readonly deliveryId: string,
    private readonly openStream: OpenStream,
    private readonly callbacks: RealtimeCallbacks,
    private readonly clock: Clock = realClock,
  ) {}

  get connection(): ConnectionState {
    return this.state;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.failures = 0;
    this.connect();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.attempt += 1;
    this.clearRetry();
    this.closeStream?.();
    this.closeStream = null;
    this.setState('closed');
  }

  private connect(): void {
    if (!this.running || this.closeStream) return;
    this.setState(this.failures === 0 ? 'connecting' : 'reconnecting');
    // Callbacks from an attempt that is no longer current (stopped, failed, replaced) are ignored.
    const attempt = ++this.attempt;
    const current = () => this.running && attempt === this.attempt;
    const close = this.openStream(this.deliveryId, {
      onOpen: () => {
        if (!current()) return;
        if (this.failures > 0) devLog(`realtime recovered after ${this.failures} failed attempt(s)`);
        this.failures = 0;
        this.setState('open');
      },
      onSnapshot: (snapshot) => {
        if (!current()) return;
        this.callbacks.onSnapshot(snapshot);
        if (snapshot.tracking === 'ENDED') this.finish('ended');
      },
      onFailure: (failure) => {
        if (current()) this.handleFailure(failure);
      },
      onEnd: () => {
        if (current()) this.finish('ended');
      },
    });
    // The stream may already have failed synchronously; only keep the closer of a live attempt.
    if (current() && this.retryTimer === null) this.closeStream = close;
  }

  private handleFailure(failure: StreamFailure): void {
    this.closeStream = null;
    this.attempt += 1;
    if (failure.kind === 'auth') {
      devLog(`realtime refused (${failure.statusCode ?? 'no session'}); polling only`);
      this.finish('refused');
      return;
    }
    const delay = RECONNECT_DELAYS_MS[Math.min(this.failures, RECONNECT_DELAYS_MS.length - 1)];
    this.failures += 1;
    devLog(`realtime unavailable (${failure.statusCode ?? 'network'}); polling fallback, retry ${this.failures} in ${delay} ms`);
    this.setState('reconnecting');
    this.clearRetry();
    this.retryTimer = this.clock.setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }

  private finish(reason: string): void {
    devLog(`realtime closed: ${reason}`);
    this.running = false;
    this.attempt += 1;
    this.clearRetry();
    this.closeStream?.();
    this.closeStream = null;
    this.setState('closed');
  }

  private clearRetry(): void {
    if (this.retryTimer !== null) this.clock.clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private setState(state: ConnectionState): void {
    if (state === this.state) return;
    this.state = state;
    this.callbacks.onState(state, this.clock.now());
  }
}

/**
 * Applies a snapshot (pushed or polled) on top of the one on screen. Snapshots are full states, so
 * the newer one wins, except:
 * - ENDED is terminal: nothing replaces it (a late poll can't bring the driver back);
 * - for the same driver, a position older than the one shown is ignored (out-of-order delivery).
 * A different driver (reassignment) or a state without a position is always applied.
 */
export function mergeTracking(current: DeliveryTracking | undefined, incoming: DeliveryTracking): DeliveryTracking {
  if (!current) return incoming;
  if (current.tracking === 'ENDED') return current;
  if (
    incoming.tracking !== 'ENDED' &&
    current.location &&
    incoming.location &&
    (current.driverId ?? null) === (incoming.driverId ?? null) &&
    Date.parse(incoming.location.updatedAt) < Date.parse(current.location.updatedAt)
  ) {
    return current;
  }
  return incoming;
}
