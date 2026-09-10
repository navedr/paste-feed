import express, { type ErrorRequestHandler } from 'express';
import { AppError } from './utils/errors.js';
import { createServer as createHttpServer, Server as HttpServer } from 'node:http';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { FeedManager } from './models/feedManager.js';
import { WebSocketManager } from './services/websocketManager.js';
import { feedsRouter } from './routes/feeds.js';
import { itemsRouter } from './routes/items.js';
import { subscriptionsRouter } from './routes/subscriptions.js';
import { secretsRouter } from './routes/secrets.js';
import { setupWebSocket } from './routes/websocket.js';

interface ServerConfig {
  feedManager: FeedManager;
  wsManager: WebSocketManager;
  version: string;
  vapidPublicKey: string;
  maxBodySize: number;
  uiDistPath: string;
}

export function createServer(config: ServerConfig): { app: express.Express; server: HttpServer; shutdown: () => Promise<void> } {
  const app = express();

  app.use(cookieParser());
  app.use(morgan('dev'));

  // Custom headers
  app.use((_req, res, next) => {
    res.setHeader('Feed-Version', config.version);
    res.setHeader('Feed-VAPIDPublicKey', config.vapidPublicKey);
    next();
  });

  // Parse JSON bodies
  app.use(express.json());

  // API routes
  app.get('/api', (_req, res) => {
    res.send('OK');
  });

  app.use('/api/secrets', secretsRouter(config.feedManager));
  app.use('/api/feeds/:feedName/items', itemsRouter(config.feedManager));
  app.use('/api/feeds/:feedName/subscription', subscriptionsRouter(config.feedManager));
  app.use('/api/feeds/:feedName', feedsRouter(config.feedManager, config.maxBodySize));

  const handleError: ErrorRequestHandler = (err, _req, res, _next) => {
    const status = err instanceof AppError ? err.statusCode : (err.status ?? 500);
    res.status(status).send(status >= 500 ? 'Internal server error' : err.message);
  };
  app.use(handleError);

  // Static files
  const uiDist = path.resolve(config.uiDistPath);
  app.use(express.static(uiDist));

  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(uiDist, 'index.html'));
  });

  const server = createHttpServer(app);
  const disposeWebSockets = setupWebSocket(server, config.wsManager, config.feedManager);

  let closing: Promise<void> | undefined;
  const shutdown = () => {
    if (!closing) {
      disposeWebSockets();
      closing = new Promise<void>((resolve, reject) => {
        server.close(err => err ? reject(err) : resolve());
      });
    }
    return closing;
  };
  return { app, server, shutdown };
}
