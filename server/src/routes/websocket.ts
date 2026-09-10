import { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { WebSocketManager } from '../services/websocketManager.js';
import { FeedManager } from '../models/feedManager.js';
import { AppError } from '../utils/errors.js';

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const pair of cookieHeader.split(';')) {
    const [name, ...rest] = pair.trim().split('=');
    if (name) {
      cookies[name.trim()] = decodeURIComponent(rest.join('=').trim());
    }
  }
  return cookies;
}

export function setupWebSocket(
  server: HttpServer,
  wsManager: WebSocketManager,
  feedManager: FeedManager,
  options: { heartbeatIntervalMs?: number } = {},
): () => void {
  const wss = new WebSocketServer({ noServer: true });

  const alive = new Set<WebSocket>();
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.delete(ws)) {
        ws.terminate();
        continue;
      }
      ws.ping();
    }
  }, options.heartbeatIntervalMs ?? 30000);
  heartbeat.unref();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearInterval(heartbeat);
    for (const ws of wss.clients) ws.terminate();
    alive.clear();
    wss.close();
  };
  server.once('close', dispose);

  server.on('upgrade', (req, socket, head) => {
    if (disposed) {
      socket.destroy();
      return;
    }
    socket.on('error', () => socket.destroy());
    let feedName: string;
    let secret: string;
    try {
      const url = new URL(req.url || '', 'http://localhost');
      const match = url.pathname.match(/^\/ws\/(.+)$/);

      if (!match) {
        socket.destroy();
        return;
      }

      feedName = decodeURIComponent(match[1]);

      // Extract secret from query params or cookies
      secret = url.searchParams.get('secret') || '';
      if (!secret) {
        const cookies = parseCookies(req.headers.cookie);
        secret = cookies['Secret'] || '';
      }

    } catch {
      socket.destroy();
      return;
    }

    // Validate auth
    try {
      feedManager.getFeedWithAuth(feedName, secret);
    } catch (err) {
      // Complete the upgrade, then close with error code
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.on('error', () => ws.terminate());
        const statusCode = err instanceof AppError ? err.statusCode : 500;
        ws.close(4000 + statusCode);
      });
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.on('error', () => ws.terminate());
      alive.add(ws);
      ws.on('pong', () => alive.add(ws));
      wsManager.addConnection(feedName, ws);

      ws.on('message', (data) => {
        const message = data.toString();
        wsManager.handleMessage(feedName, ws, message);
      });

      ws.on('close', () => {
        alive.delete(ws);
        wsManager.removeConnection(feedName, ws);
      });
    });
  });
  return dispose;
}
