import { API_BASE_URL } from '@/config/api';
import { getSessionSnapshot } from '@/services/session';
import { streamingFetch } from '@/services/stream-fetch';
import type { DeliveryTracking } from '@/services/tracking';

/**
 * No bytes at all for this long means the connection is dead even if no error surfaced (the server
 * sends a keepalive comment every 15 s).
 */
export const STREAM_INACTIVITY_MS = 40_000;

export type SseEvent = { event: string; data: string };

/**
 * Incremental Server-Sent Events parser: feed it decoded text as it arrives, it emits complete events.
 * Comments (`: ping`) count as activity but produce no event.
 */
export function createSseParser(onEvent: (event: SseEvent) => void) {
  let buffer = '';
  return (text: string) => {
    buffer += text.replace(/\r\n?/g, '\n');
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      let event = 'message';
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith(':')) continue;
        const colon = line.indexOf(':');
        const field = colon < 0 ? line : line.slice(0, colon);
        const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
        if (field === 'event') event = value;
        else if (field === 'data') data.push(value);
      }
      if (data.length > 0) onEvent({ event, data: data.join('\n') });
      boundary = buffer.indexOf('\n\n');
    }
  };
}

/** Why a stream stopped. `auth` = not allowed / not found: retrying won't help. */
export type StreamFailure = { kind: 'auth' | 'retry'; statusCode?: number };

export type TrackingStreamHandlers = {
  onOpen(): void;
  onSnapshot(snapshot: DeliveryTracking): void;
  /** The connection failed or dropped. */
  onFailure(failure: StreamFailure): void;
  /** The server ended the stream after the final (ENDED) snapshot. */
  onEnd(): void;
};

const FINAL_STATUSES = new Set([401, 403, 404]);

/**
 * Opens `GET /api/tracking/delivery/:id/stream` (backend #135) with the session token and reports
 * through `handlers`; exactly one of onFailure/onEnd ends it. Returns `close()`, after which nothing
 * is reported. Transport only: what the snapshots mean is decided elsewhere (describeTracking).
 */
export function openTrackingStream(
  deliveryId: string,
  handlers: TrackingStreamHandlers,
  fetchImpl: typeof streamingFetch = streamingFetch,
): () => void {
  const controller = new AbortController();
  let done = false;
  let sawEnded = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;

  const finish = (outcome: StreamFailure | 'end') => {
    if (done) return;
    done = true;
    if (watchdog) clearTimeout(watchdog);
    controller.abort();
    if (outcome === 'end') handlers.onEnd();
    else handlers.onFailure(outcome);
  };
  const touch = () => {
    if (watchdog) clearTimeout(watchdog);
    watchdog = setTimeout(() => finish({ kind: 'retry' }), STREAM_INACTIVITY_MS);
  };

  const parse = createSseParser(({ event, data }) => {
    if (done) return;
    if (event === 'tracking') {
      let snapshot: DeliveryTracking;
      try {
        snapshot = JSON.parse(data) as DeliveryTracking;
      } catch {
        return; // a malformed frame is ignored; the next one or a resync replaces it
      }
      if (snapshot.tracking === 'ENDED') sawEnded = true;
      handlers.onSnapshot(snapshot);
    } else if (event === 'error') {
      let statusCode: number | undefined;
      try {
        statusCode = (JSON.parse(data) as { statusCode?: number }).statusCode;
      } catch {
        statusCode = undefined;
      }
      finish({ kind: statusCode && FINAL_STATUSES.has(statusCode) ? 'auth' : 'retry', statusCode });
    }
  });

  void (async () => {
    const token = getSessionSnapshot().session?.token;
    if (!token) {
      finish({ kind: 'auth', statusCode: 401 });
      return;
    }
    try {
      touch();
      const response = await fetchImpl(`${API_BASE_URL}/api/tracking/delivery/${deliveryId}/stream`, {
        headers: { Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        finish({ kind: FINAL_STATUSES.has(response.status) ? 'auth' : 'retry', statusCode: response.status });
        return;
      }
      if (done) return;
      handlers.onOpen();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        touch();
        parse(decoder.decode(value, { stream: true }));
        if (done) return;
      }
      finish(sawEnded ? 'end' : { kind: 'retry' });
    } catch {
      finish({ kind: 'retry' });
    }
  })();

  return () => {
    if (done) return;
    done = true;
    if (watchdog) clearTimeout(watchdog);
    controller.abort();
  };
}
