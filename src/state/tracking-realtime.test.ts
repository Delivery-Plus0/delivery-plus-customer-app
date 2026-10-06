import { describe, expect, it, vi } from 'vitest';

import type { DeliveryTracking } from '@/services/tracking';
import type { TrackingStreamHandlers } from '@/services/tracking-stream';

import { RECONNECT_DELAYS_MS, TrackingRealtime, mergeTracking, type ConnectionState } from './tracking-realtime';

/** A controllable stand-in for openTrackingStream: each call is one connection attempt. */
function fakeStreams() {
  const attempts: { handlers: TrackingStreamHandlers; closed: boolean }[] = [];
  const open = vi.fn((_deliveryId: string, given: TrackingStreamHandlers) => {
    // Like the real stream, an attempt that reported a failure or its end has already shut itself.
    const attempt = { handlers: given, closed: false };
    attempt.handlers = {
      ...given,
      onFailure: (failure) => {
        attempt.closed = true;
        given.onFailure(failure);
      },
      onEnd: () => {
        attempt.closed = true;
        given.onEnd();
      },
    };
    attempts.push(attempt);
    return () => {
      attempt.closed = true;
    };
  });
  return { open, attempts, last: () => attempts[attempts.length - 1] };
}

/** Manual clock: timers run only when `advance` passes their time. */
function fakeClock() {
  let now = 0;
  let timers: { at: number; fn: () => void; id: number }[] = [];
  let nextId = 1;
  return {
    now: () => now,
    setTimeout: (fn: () => void, ms: number) => {
      const id = nextId++;
      timers.push({ at: now + ms, fn, id });
      return id;
    },
    clearTimeout: (id: unknown) => {
      timers = timers.filter((t) => t.id !== id);
    },
    advance(ms: number) {
      now += ms;
      const due = timers.filter((t) => t.at <= now);
      timers = timers.filter((t) => t.at > now);
      due.forEach((t) => t.fn());
    },
    pending: () => timers.length,
  };
}

const snapshot = (overrides: Partial<DeliveryTracking> = {}): DeliveryTracking => ({
  deliveryId: 'd-1',
  status: 'IN_TRANSIT',
  driverId: 'driver-1',
  location: { latitude: 30.0444, longitude: 31.2357, updatedAt: '2026-10-06T12:00:00.000Z' },
  tracking: 'LIVE',
  locationAgeSeconds: 0,
  ...overrides,
});

function setup() {
  const streams = fakeStreams();
  const clock = fakeClock();
  const states: ConnectionState[] = [];
  const snapshots: DeliveryTracking[] = [];
  const realtime = new TrackingRealtime(
    'd-1',
    streams.open,
    { onSnapshot: (s) => snapshots.push(s), onState: (s) => states.push(s) },
    clock,
  );
  return { realtime, streams, clock, states, snapshots };
}

describe('TrackingRealtime', () => {
  it('connects once, opens, and hands every pushed snapshot to the data source', () => {
    const { realtime, streams, states, snapshots } = setup();
    realtime.start();
    realtime.start();
    expect(streams.open).toHaveBeenCalledTimes(1);

    streams.last().handlers.onOpen();
    streams.last().handlers.onSnapshot(snapshot());
    expect(states).toEqual(['connecting', 'open']);
    expect(snapshots).toHaveLength(1);
    expect(realtime.connection).toBe('open');
  });

  it('a dropped stream → reconnecting (polling fallback) → retries with capped backoff → recovers', () => {
    const { realtime, streams, clock, states } = setup();
    realtime.start();
    streams.last().handlers.onOpen();

    streams.last().handlers.onFailure({ kind: 'retry' });
    expect(realtime.connection).toBe('reconnecting');

    // Each failed retry waits longer, up to the cap; never two connections at once.
    for (let i = 0; i < RECONNECT_DELAYS_MS.length + 2; i++) {
      const delay = RECONNECT_DELAYS_MS[Math.min(i, RECONNECT_DELAYS_MS.length - 1)];
      clock.advance(delay - 1);
      expect(streams.open).toHaveBeenCalledTimes(1 + i);
      clock.advance(1);
      expect(streams.open).toHaveBeenCalledTimes(2 + i);
      expect(streams.attempts.filter((a) => !a.closed)).toHaveLength(1);
      streams.last().handlers.onFailure({ kind: 'retry', statusCode: 503 });
    }
    expect(Math.max(...RECONNECT_DELAYS_MS)).toBe(30_000);

    // Back: the next attempt opens and the backoff resets.
    clock.advance(30_000);
    streams.last().handlers.onOpen();
    expect(realtime.connection).toBe('open');
    streams.last().handlers.onFailure({ kind: 'retry' });
    clock.advance(RECONNECT_DELAYS_MS[0]);
    expect(states.filter((s) => s === 'open')).toHaveLength(2);
    expect(streams.attempts.filter((a) => !a.closed).length).toBeLessThanOrEqual(1);
  });

  it('stops for good after ENDED: no reconnect, no more snapshots', () => {
    const { realtime, streams, clock, snapshots } = setup();
    realtime.start();
    streams.last().handlers.onOpen();
    streams.last().handlers.onSnapshot(snapshot({ tracking: 'ENDED', status: 'DELIVERED', location: null }));

    expect(realtime.connection).toBe('closed');
    streams.last().handlers.onFailure({ kind: 'retry' });
    streams.last().handlers.onSnapshot(snapshot());
    clock.advance(60_000);
    expect(streams.open).toHaveBeenCalledTimes(1);
    expect(snapshots).toHaveLength(1);
  });

  it('a refused stream (401/403/404) is not retried; polling remains the source', () => {
    const { realtime, streams, clock } = setup();
    realtime.start();
    streams.last().handlers.onFailure({ kind: 'auth', statusCode: 403 });
    clock.advance(120_000);
    expect(streams.open).toHaveBeenCalledTimes(1);
    expect(realtime.connection).toBe('closed');
  });

  it('stop (screen blur or unmount) closes the connection, cancels the retry, ignores late callbacks', () => {
    const { realtime, streams, clock, snapshots } = setup();
    realtime.start();
    const first = streams.last();
    first.handlers.onFailure({ kind: 'retry' });
    expect(clock.pending()).toBe(1);

    realtime.stop();
    expect(clock.pending()).toBe(0);
    expect(realtime.connection).toBe('closed');

    first.handlers.onSnapshot(snapshot());
    clock.advance(60_000);
    expect(snapshots).toHaveLength(0);
    expect(streams.open).toHaveBeenCalledTimes(1);
  });

  it('can start again after a stop (screen focused again) with a fresh stream', () => {
    const { realtime, streams } = setup();
    realtime.start();
    realtime.stop();
    expect(streams.attempts[0].closed).toBe(true);
    realtime.start();
    expect(streams.open).toHaveBeenCalledTimes(2);
  });

  it('a stream that fails synchronously still gets retried (no stuck state)', () => {
    const clock = fakeClock();
    let calls = 0;
    const open = vi.fn((_id: string, handlers: TrackingStreamHandlers) => {
      calls += 1;
      if (calls === 1) handlers.onFailure({ kind: 'retry' });
      return () => undefined;
    });
    const realtime = new TrackingRealtime('d-1', open, { onSnapshot: vi.fn(), onState: vi.fn() }, clock);
    realtime.start();
    clock.advance(RECONNECT_DELAYS_MS[0]);
    expect(open).toHaveBeenCalledTimes(2);
  });
});

describe('mergeTracking (duplicates, out of order, terminal)', () => {
  it('takes the incoming snapshot when there is nothing yet', () => {
    expect(mergeTracking(undefined, snapshot())).toEqual(snapshot());
  });

  it('a newer position for the same driver replaces the shown one', () => {
    const newer = snapshot({ location: { latitude: 30.05, longitude: 31.24, updatedAt: '2026-10-06T12:00:10.000Z' } });
    expect(mergeTracking(snapshot(), newer)).toBe(newer);
  });

  it('an older position for the same driver (late poll or reordered push) is ignored', () => {
    const shown = snapshot({ location: { latitude: 30.05, longitude: 31.24, updatedAt: '2026-10-06T12:00:10.000Z' } });
    const older = snapshot();
    expect(mergeTracking(shown, older)).toBe(shown);
  });

  it('a duplicate leaves the same position', () => {
    expect(mergeTracking(snapshot(), snapshot()).location).toEqual(snapshot().location);
  });

  it("a reassigned driver's state always applies, even with an older timestamp", () => {
    const reassigned = snapshot({ driverId: 'driver-2', location: { latitude: 1, longitude: 1, updatedAt: '2026-10-06T11:00:00.000Z' } });
    expect(mergeTracking(snapshot(), reassigned)).toBe(reassigned);
  });

  it('ENDED is final: a late LIVE snapshot cannot bring the driver back', () => {
    const ended = snapshot({ tracking: 'ENDED', status: 'DELIVERED', location: null });
    expect(mergeTracking(ended, snapshot())).toBe(ended);
  });

  it('ENDED always applies', () => {
    const ended = snapshot({ tracking: 'ENDED', status: 'CANCELLED', location: null });
    expect(mergeTracking(snapshot(), ended)).toBe(ended);
  });
});
