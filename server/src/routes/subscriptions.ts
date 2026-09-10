import { Router, Request, Response } from 'express';
import { FeedManager } from '../models/feedManager.js';
import { getSecret } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import type { PushSubscription } from '../models/types.js';

export function subscriptionsRouter(feedManager: FeedManager): Router {
  const router = Router({ mergeParams: true });

  // POST /api/feeds/:feedName/subscription
  router.post('/', (req: Request, res: Response) => {
    try {
      const feedName = req.params.feedName;
      const { secret } = getSecret(req);
      const feed = feedManager.getFeedWithAuth(feedName, secret);

      const subscription = req.body as PushSubscription;
      feed.config.addSubscription(subscription);
      res.sendStatus(200);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).send(err.message);
      } else {
        res.status(500).send(String(err));
      }
    }
  });

  // DELETE /api/feeds/:feedName/subscription
  router.delete('/', (req: Request, res: Response) => {
    try {
      const feedName = req.params.feedName;
      const { secret } = getSecret(req);
      const feed = feedManager.getFeedWithAuth(feedName, secret);

      const subscription = req.body as PushSubscription;
      feed.config.deleteSubscription(subscription);
      res.sendStatus(200);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).send(err.message);
      } else {
        res.status(500).send(String(err));
      }
    }
  });

  return router;
}
