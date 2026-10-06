import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getSessionSnapshot } from '@/services/session';
import type { DeliveryTracking } from '@/services/tracking';

import { STREAM_INACTIVITY_MS, createSseParser, openTrackingStream, type TrackingStreamHandlers } from './tracking-stream';

vi.mock('@/services/stream-fetch', () => ({ streamingFetch: vi.fn() }));
vi.mock('@/services/session', () => ({ getSessionSnapshot: vi.fn(() => ({ session: { token: 'jwt-1' } })) }));

/** A response whose body the test feeds chunk by chunk. */
function streamingResponse(status = 200) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const encoder = new TextEncoder();
  return {
    response: { ok: status >= 200 && status < 300, status, body } as unknown as Response,
    push: (text: string) => controller.enqueue(encoder.encode(text)),
    end: () => controller.close(),
  };
}

function recorder() {
  const calls: string[] = [];
  const snapshots: DeliveryTracking[] = [];
  const handlers: TrackingStreamHandlers = {
    onOpen: () => calls.push('open'),
    onSnapshot: (s) => snapshots.push(s),
    onFailure: (f) => calls.push(`failure:${f.kind}:${f.statusCode ?? ''}`),
    onEnd: () => calls.push('end'),
  };
  return { calls, snapshots, handlers };
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

const frame = (snapshot: Partial<DeliveryTracking>) => `event: tracking\ndata: ${JSON.stringify(snapshot)}\n\n`;

describe('createSseParser', () => {
  it('emits complete events across chunk boundaries and skips comments', () => {
    const events: { event: string; data: string }[] = [];
    const push = createSseParser((e) => events.push(e));
    push(': ping\n\nevent: track');
    push('ing\ndata: {"a":1}\n');
    expect(events).toEqual([]);
    push('\nevent: error\r\ndata: {"statusCode":403}\r\n\r\n');
    expect(events).toEqual([
      { event: 'tracking', data: '{"a":1}' },
      { event: 'error', data: '{"statusCode":403}' },
    ]);
  });

  it('joins multi-line data and defaults the event name', () => {
    const events: { event: string; data: string }[] = [];
    createSseParser((e) => events.push(e))('data: one\ndata: two\n\n');
    expect(events).toEqual([{ event: 'message', data: 'one\ntwo' }]);
  });
});

describe('openTrackingStream', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getSessionSnapshot).mockReturnValue({ session: { token: 'jwt-1' } } as ReturnType<typeof getSessionSnapshot>);
  });
  afterEach(() => vi.useRealTimers());

  it('opens the stream with the session token, then reports snapshots as they arrive', async () => {
    const s = streamingResponse();
    const fetchImpl = vi.fn(async () => s.response);
    const r = recorder();

    openTrackingStream('d-1', r.handlers, fetchImpl as never);
    await flush();
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/tracking\/delivery\/d-1\/stream$/),
      expect.objectContaining({ headers: { Accept: 'text/event-stream', Authorization: 'Bearer jwt-1' } }),
    );
    expect(r.calls).toEqual(['open']);

    s.push(frame({ tracking: 'LIVE', locationAgeSeconds: 0 }));
    await flush();
    s.push(': ping\n\n' + frame({ tracking: 'STALE', locationAgeSeconds: 61 }));
    await flush();
    expect(r.snapshots.map((x) => x.tracking)).toEqual(['LIVE', 'STALE']);
  });

  it('ENDED then a server close → onEnd (no reconnect needed)', async () => {
    const s = streamingResponse();
    const r = recorder();
    openTrackingStream('d-1', r.handlers, vi.fn(async () => s.response) as never);
    await flush();
    s.push(frame({ tracking: 'ENDED', location: null }));
    s.end();
    await flush();
    expect(r.calls).toEqual(['open', 'end']);
  });

  it('a server close without ENDED is a drop (retry)', async () => {
    const s = streamingResponse();
    const r = recorder();
    openTrackingStream('d-1', r.handlers, vi.fn(async () => s.response) as never);
    await flush();
    s.end();
    await flush();
    expect(r.calls).toEqual(['open', 'failure:retry:']);
  });

  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [404, 'auth'],
    [503, 'retry'],
  ])('HTTP %i before the stream → %s failure', async (status, kind) => {
    const r = recorder();
    openTrackingStream('d-1', r.handlers, vi.fn(async () => streamingResponse(status).response) as never);
    await flush();
    expect(r.calls).toEqual([`failure:${kind}:${status}`]);
  });

  it('an error event inside the stream ends it: final for 403, retryable for 503', async () => {
    for (const [statusCode, kind] of [[403, 'auth'], [503, 'retry']] as const) {
      const s = streamingResponse();
      const r = recorder();
      openTrackingStream('d-1', r.handlers, vi.fn(async () => s.response) as never);
      await flush();
      s.push(`event: error\ndata: {"statusCode":${statusCode},"message":"x"}\n\n`);
      await flush();
      expect(r.calls).toEqual(['open', `failure:${kind}:${statusCode}`]);
    }
  });

  it('a network failure (offline, gateway down) → retry', async () => {
    const r = recorder();
    openTrackingStream('d-1', r.handlers, vi.fn(async () => Promise.reject(new TypeError('Network request failed'))) as never);
    await flush();
    expect(r.calls).toEqual(['failure:retry:']);
  });

  it('silence longer than the keepalive window → treated as dead (retry)', async () => {
    const s = streamingResponse();
    const r = recorder();
    openTrackingStream('d-1', r.handlers, vi.fn(async () => s.response) as never);
    await flush();
    s.push(': ping\n\n');
    await flush();
    vi.advanceTimersByTime(STREAM_INACTIVITY_MS - 1);
    expect(r.calls).toEqual(['open']);
    vi.advanceTimersByTime(1);
    expect(r.calls).toEqual(['open', 'failure:retry:']);
  });

  it('a malformed frame is ignored; the stream keeps going', async () => {
    const s = streamingResponse();
    const r = recorder();
    openTrackingStream('d-1', r.handlers, vi.fn(async () => s.response) as never);
    await flush();
    s.push('event: tracking\ndata: {not json\n\n' + frame({ tracking: 'LIVE' }));
    await flush();
    expect(r.snapshots.map((x) => x.tracking)).toEqual(['LIVE']);
    expect(r.calls).toEqual(['open']);
  });

  it('without a session it does not connect (auth failure)', async () => {
    vi.mocked(getSessionSnapshot).mockReturnValue({ session: null } as unknown as ReturnType<typeof getSessionSnapshot>);
    const fetchImpl = vi.fn();
    const r = recorder();
    openTrackingStream('d-1', r.handlers, fetchImpl as never);
    await flush();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(r.calls).toEqual(['failure:auth:401']);
  });

  it('close() (screen left) aborts the request and reports nothing afterwards', async () => {
    const s = streamingResponse();
    let signal: AbortSignal | undefined;
    const r = recorder();
    const close = openTrackingStream(
      'd-1',
      r.handlers,
      vi.fn(async (_url: string, init: { signal: AbortSignal }) => {
        signal = init.signal;
        return s.response;
      }) as never,
    );
    await flush();
    close();
    expect(signal?.aborted).toBe(true);
    s.push(frame({ tracking: 'LIVE' }));
    vi.advanceTimersByTime(STREAM_INACTIVITY_MS * 2);
    await flush();
    expect(r.snapshots).toHaveLength(0);
    expect(r.calls).toEqual(['open']);
  });
});
