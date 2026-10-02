import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';

/** A failed verified upstream connection remains a structured API failure. */
export function proxyUnavailable(_error: Error, request: IncomingMessage, response: ServerResponse | Socket): void {
  if (request.aborted || response.destroyed || !('writeHead' in response) || response.headersSent || response.writableEnded) return;
  const requestId = randomUUID();
  const problem = {
    type: 'about:blank', title: 'Service unavailable', status: 503,
    detail: 'API connection unavailable', code: 'service_unavailable',
    instance: (request.url ?? '/').split('?')[0], requestId, traceId: requestId,
  };
  response.writeHead(503, { 'Content-Type': 'application/problem+json', 'Cache-Control': 'no-store', 'X-Request-Id': requestId });
  response.end(request.method === 'HEAD' ? undefined : JSON.stringify(problem));
}
