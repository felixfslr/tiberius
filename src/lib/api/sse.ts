/**
 * Tiny SSE writer. Compatible with Next.js route handlers (return Response with
 * a ReadableStream body and `Content-Type: text/event-stream`).
 *
 * Usage:
 *   const sse = createSse();
 *   doWorkAsync(sse.send).finally(sse.close);
 *   return new Response(sse.stream, { headers: sse.headers });
 */

export type SseEvent = { type: string; data: unknown };

export type Sse = {
  stream: ReadableStream<Uint8Array>;
  headers: Record<string, string>;
  send: (event: SseEvent) => void;
  close: () => void;
};

export function createSse(): Sse {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      closed = true;
    },
  });

  function send(event: SseEvent) {
    if (closed || !controller) return;
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    try {
      controller.enqueue(encoder.encode(payload));
    } catch {
      closed = true;
    }
  }

  function close() {
    if (closed || !controller) return;
    closed = true;
    try {
      controller.close();
    } catch {
      // already closed
    }
  }

  return {
    stream,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
    send,
    close,
  };
}
