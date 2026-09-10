import { Router, Request, Response } from 'express';
import path from 'node:path';
import { FeedManager } from '../models/feedManager.js';
import { getSecret } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

function getContentType(itemName: string): string {
  const ext = path.extname(itemName).toLowerCase();
  switch (ext) {
    case '.txt':
      return 'text/plain';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
}

export function itemsRouter(feedManager: FeedManager): Router {
  const router = Router({ mergeParams: true });

  // GET /api/feeds/:feedName/items/:itemName
  router.get('/:itemName', (req: Request, res: Response) => {
    try {
      const feedName = req.params.feedName;
      const itemName = req.params.itemName;
      const { secret } = getSecret(req);
      const feed = feedManager.getFeedWithAuth(feedName, secret);

      const data = feed.getItemData(itemName);
      res.set('Content-Type', getContentType(itemName));
      res.send(data);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).send(err.message);
      } else {
        res.status(500).send(String(err));
      }
    }
  });

  // POST /api/feeds/:feedName/items/:itemName
  router.post('/:itemName', (req: Request, res: Response) => {
    try {
      const feedName = req.params.feedName;
      const itemName = req.params.itemName;
      const { secret } = getSecret(req);
      const feed = feedManager.getFeedWithAuth(feedName, secret);

      const name = req.body?.name;
      if (typeof name !== 'string' || name.length === 0) {
        res.status(400).send('Name must be a nonempty string');
        return;
      }
      feed.setItemNameOverride(itemName, name);

      res.json({ originalName: itemName, displayName: name });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).send(err.message);
      } else {
        res.status(500).send(String(err));
      }
    }
  });

  // DELETE /api/feeds/:feedName/items/:itemName
  router.delete('/:itemName', (req: Request, res: Response) => {
    try {
      const feedName = req.params.feedName;
      const itemName = req.params.itemName;
      const { secret } = getSecret(req);
      const feed = feedManager.getFeedWithAuth(feedName, secret);

      feed.removeItem(itemName, true);
      res.send('Item Removed');
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).send(err.message);
      } else {
        res.status(500).send(String(err));
      }
    }
  });

  // DELETE /api/feeds/:feedName/items
  router.delete('/', (req: Request, res: Response) => {
    try {
      const feedName = req.params.feedName;
      const { secret } = getSecret(req);
      const feed = feedManager.getFeedWithAuth(feedName, secret);

      feed.empty();
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
