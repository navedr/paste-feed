import { Router, Request, Response, text } from 'express';
import path from 'node:path';
import multer from 'multer';
import { FeedManager } from '../models/feedManager.js';
import { Feed } from '../models/feed.js';
import { getSecret } from '../middleware/auth.js';
import {
  AppError,
  FeedNotFoundError,
  PinIncorrectLengthError,
} from '../utils/errors.js';

export function feedsRouter(feedManager: FeedManager, maxBodySize: number): Router {
  const router = Router({ mergeParams: true });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBodySize + 1, files: 1, fields: 0, parts: 2 } });

  // GET /api/feeds/:feedName
  router.get('/', (req: Request, res: Response) => {
    try {
      const feedName = req.params.feedName;
      let feed: Feed;
      let created = false;

      try {
        feed = feedManager.getFeed(feedName);
      } catch (err) {
        if (err instanceof FeedNotFoundError) {
          Feed.newFeed(path.join(feedManager.path, feedName));
          created = true;
          feed = feedManager.getFeed(feedName);
        } else {
          throw err;
        }
      }

      // Existing feed — validate secret
      const { secret } = getSecret(req);
      if (!created) {
        feed.isSecretValid(secret);
      }

      const publicFeed = feed.public();

      res.cookie('Secret', publicFeed.secret, {
        path: `/api/feeds/${feedName}`,
        maxAge: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years in ms
      });

      res.json(publicFeed);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).send(err.message);
      } else {
        res.status(500).send(String(err));
      }
    }
  });

  // POST /api/feeds/:feedName
  router.post('/', (req, res, next) => {
    try {
      const { secret } = getSecret(req);
      feedManager.getFeedWithAuth(req.params.feedName, secret);
      next();
    } catch (err) {
      next(err);
    }
  }, (req, res, next) => {
    upload.any()(req, res, err => {
      if (err) {
        res.status(err instanceof multer.MulterError ? 413 : 400).send('Invalid or oversized upload');
        return;
      }
      next();
    });
  }, (req: Request, res: Response) => {
    try {
      const feedName = req.params.feedName;
      const { secret } = getSecret(req);
      const feed = feedManager.getFeedWithAuth(feedName, secret);

      const files = req.files as Express.Multer.File[] | undefined;
      const file = files?.[0];
      if (!file) {
        res.status(400).send('No file uploaded');
        return;
      }

      if (file.buffer.length > maxBodySize) {
        res.status(413).send('Upload too large');
        return;
      }

      feed.addItem(file.mimetype, file.originalname, file.buffer);
      res.send('OK');
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).send(err.message);
      } else {
        res.status(500).send(String(err));
      }
    }
  });

  // PATCH /api/feeds/:feedName
  router.patch('/', text({ type: ['text/plain', 'application/x-www-form-urlencoded'], limit: '1kb' }), (req: Request, res: Response) => {
    try {
      const feedName = req.params.feedName;
      const { secret } = getSecret(req);
      const feed = feedManager.getFeedWithAuth(feedName, secret);

      const pin = req.body as string;
      feed.setPIN(pin);
      res.sendStatus(200);
    } catch (err) {
      if (err instanceof PinIncorrectLengthError) {
        res.status(400).send('PIN should be 4 digits');
      } else if (err instanceof AppError) {
        res.status(err.statusCode).send(err.message);
      } else {
        res.status(500).send(String(err));
      }
    }
  });

  return router;
}
