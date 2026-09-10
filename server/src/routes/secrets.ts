import { Router, Request, Response } from 'express';
import { FeedManager } from '../models/feedManager.js';

export function secretsRouter(feedManager: FeedManager): Router {
  const router = Router();

  // POST /api/secrets
  router.post('/', (_req: Request, res: Response) => {
    feedManager.dumpSecrets();
    res.sendStatus(200);
  });

  return router;
}
